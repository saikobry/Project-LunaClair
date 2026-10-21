param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string[]]$Workers,
    [ValidateSet("All", "Any")]
    [string]$Mode = "All",
    [int]$TimeoutSeconds = 600,
    [int]$DebounceMilliseconds = 3600,
    # Set by dispatch.ps1: fail if an agent was never observed working.
    # Note: Herdr working/idle statuses are diagnostic lifecycle hints, not proof of task completion.
    # Delegated work should prefer explicit task completion callbacks (complete-task.ps1).
    [switch]$RequireActivity
)

function Resolve-HerdrTarget([string]$target) {
    if ($target -match "^w\d+:p[0-9a-fA-F]+$") { return $target }
    try {
        $raw = herdr agent list 2>$null
        if ($raw) {
            $json = $raw | ConvertFrom-Json
            $found = $json.result.agents | Where-Object { $_.name -eq $target -or $_.agent -eq $target } | Select-Object -First 1
            if ($found -and $found.pane_id) { return $found.pane_id }
        }
    } catch {}
    return $target
}

# 1. Normalize worker list
$workerList = @()
foreach ($w in $Workers) {
    if ($w.Contains(",")) {
        $workerList += ($w -split "," | ForEach-Object { $_.Trim() })
    } else {
        $workerList += $w.Trim()
    }
}
$workerList = @($workerList | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { Resolve-HerdrTarget $_ } | Select-Object -Unique)

if ($workerList.Count -eq 0) {
    Write-Error "No valid workers specified to wait on."
    exit 1
}

Write-Host "Waiting for [$($workerList -join ', ')] to complete in Herdr (Mode: $Mode, Timeout: ${TimeoutSeconds}s)..." -ForegroundColor Cyan

$startTime = [DateTime]::UtcNow
$timeoutMs = $TimeoutSeconds * 1000

function Get-RemainingTimeoutMs {
    $spent = ([DateTime]::UtcNow - $startTime).TotalMilliseconds
    $remaining = [int]($timeoutMs - $spent)
    if ($remaining -lt 100) { return 100 }
    return $remaining
}

function Test-AgentStableIdle([string]$targetAgent) {
    if ($DebounceMilliseconds -le 0) { return $true }

    # Multi-stage diff guard: check consecutive quiet windows to reduce false idle
    # transitions during streaming pauses or tool switches (heuristic diagnostic).
    $stageDurationMs = [Math]::Max([int]($DebounceMilliseconds / 2), 1800)

    $currentSnap = herdr agent read $targetAgent --source visible 2>$null
    $currentStr = ($currentSnap -join "`n")

    for ($stage = 1; $stage -le 2; $stage++) {
        Start-Sleep -Milliseconds $stageDurationMs

        # Check 1: Did agent status flip back to working or blocked?
        $chkRaw = herdr agent get $targetAgent 2>$null
        if ($chkRaw) {
            try {
                $chkJson = $chkRaw | ConvertFrom-Json
                $chkStatus = $chkJson.result.agent.agent_status
                if ($chkStatus -eq "working" -or $chkStatus -eq "blocked") {
                    return $false
                }
            } catch {}
        }

        # Check 2: Did visible terminal output change during this stage?
        $nextSnap = herdr agent read $targetAgent --source visible 2>$null
        $nextStr = ($nextSnap -join "`n")
        if ($currentStr -and $nextStr -and ($currentStr -ne $nextStr)) {
            # Active token streaming or tool execution detected
            return $false
        }

        $currentStr = $nextStr
    }

    return $true
}

function Ensure-AgentStartedWorking([string]$targetAgent) {
    try {
        $chkRaw = herdr agent get $targetAgent 2>$null
        if ($chkRaw) {
            $chkJson = $chkRaw | ConvertFrom-Json
            $curStatus = $chkJson.result.agent.agent_status
            if ($curStatus -eq "working" -or $curStatus -eq "blocked") { return $true }

            # Wait up to 6s for the newly dispatched agent to transition to working or blocked
            $null = herdr agent wait $targetAgent --until working --until blocked --timeout 6000 2>$null

            $afterRaw = herdr agent get $targetAgent 2>$null
            if ($afterRaw) {
                $afterStatus = ($afterRaw | ConvertFrom-Json).result.agent.agent_status
                return ($afterStatus -eq "working" -or $afterStatus -eq "blocked")
            }
        }
    } catch {}
    return $false
}

# Fast path: Single worker - 100% reactive socket wait with zero polling delay
if ($workerList.Count -eq 1) {
    $target = $workerList[0]
    $activitySeen = Ensure-AgentStartedWorking $target

    if (-not $activitySeen -and $RequireActivity) {
        Write-Warning "'$target' never transitioned to 'working' after dispatch -- the prompt may be pasted but unsubmitted. Nudging Enter and allowing a second window."
        herdr pane send-keys $target enter 2>$null
        $activitySeen = Ensure-AgentStartedWorking $target
    }

    while ((Get-RemainingTimeoutMs) -gt 100) {
        $curTimeout = Get-RemainingTimeoutMs
        $raw = herdr agent wait $target --timeout $curTimeout 2>$null
        if ($raw) {
            try {
                $json = $raw | ConvertFrom-Json
                $agent = $json.result.agent
                $status = $agent.agent_status
                $pane = $agent.pane_id

                if ($status -eq "working") {
                    $activitySeen = $true
                    continue
                }

                if ($status -eq "blocked") {
                    $activitySeen = $true
                    Write-Warning "[BLOCKED] Worker '$target' is BLOCKED waiting on human input or approval at pane $pane!"
                    Start-Sleep -Milliseconds 500
                    continue
                }

                if ($status -eq "done" -or $status -eq "idle") {
                    if (Test-AgentStableIdle $target) {
                        if ($RequireActivity -and -not $activitySeen) {
                            Write-Error "Worker '$target' was never observed entering 'working' or 'blocked' state after dispatch (prompt may be unsubmitted or absorbed in composer). Failing wait because -RequireActivity was requested."
                            exit 1
                        }
                        Write-Host "  -> Worker '$target' reached idle state. (Status: $status, Pane: $pane)" -ForegroundColor Green
                        Write-Output "TERMINAL_ORCHESTRATOR_LIFECYCLE_IDLE: $target"
                        exit 0
                    }
                    continue
                }
            } catch {}
        } else {
            if ((Get-RemainingTimeoutMs) -le 200) { break }
            Start-Sleep -Milliseconds 250
        }
    }

    Write-Error "Timeout waiting for worker '$target' (${TimeoutSeconds}s elapsed)"
    exit 1
}

# Multi-worker path
$pending = @{}
foreach ($w in $workerList) { $pending[$w] = $true }
$completed = @{}

if ($Mode -eq "All") {
    # Sequentially wait on each worker via reactive socket wait
    # Since workers execute concurrently in Herdr, waiting on W1 allows W2..WN to progress in parallel
    foreach ($target in $workerList) {
        $activitySeen = Ensure-AgentStartedWorking $target
        if (-not $activitySeen -and $RequireActivity) {
            Write-Warning "'$target' never transitioned to 'working' after dispatch -- the prompt may be pasted but unsubmitted. Nudging Enter and allowing a second window."
            herdr pane send-keys $target enter 2>$null
            $activitySeen = Ensure-AgentStartedWorking $target
        }
        $curTimeout = Get-RemainingTimeoutMs
        if ($curTimeout -le 100) { break }

        while ($curTimeout -gt 100) {
            $raw = herdr agent wait $target --timeout $curTimeout 2>$null
            if ($raw) {
                try {
                    $json = $raw | ConvertFrom-Json
                    $agent = $json.result.agent
                    $status = $agent.agent_status
                    $pane = $agent.pane_id

                    if ($status -eq "working") {
                        $activitySeen = $true
                        $curTimeout = Get-RemainingTimeoutMs
                        continue
                    }

                    if ($status -eq "blocked") {
                        $activitySeen = $true
                        Write-Warning "[BLOCKED] Worker '$target' is BLOCKED waiting on human input or approval at pane $pane!"
                        Start-Sleep -Milliseconds 500
                        $curTimeout = Get-RemainingTimeoutMs
                        continue
                    }

                    if ($status -eq "done" -or $status -eq "idle") {
                        if (Test-AgentStableIdle $target) {
                            if ($RequireActivity -and -not $activitySeen) {
                                Write-Error "Worker '$target' was never observed entering 'working' or 'blocked' state after dispatch (prompt may be unsubmitted or absorbed in composer). Failing wait because -RequireActivity was requested."
                                exit 1
                            }
                            Write-Host "  -> Worker '$target' reached idle state. (Status: $status, Pane: $pane)" -ForegroundColor Green
                            $completed[$target] = $true
                            $pending.Remove($target)
                            break
                        }
                        continue
                    }
                } catch {}
            }
            $curTimeout = Get-RemainingTimeoutMs
            if ($curTimeout -le 100) { break }
            Start-Sleep -Milliseconds 250
        }
    }

    if ($pending.Count -eq 0) {
        $doneList = $completed.Keys -join ", "
        Write-Output "TERMINAL_ORCHESTRATOR_LIFECYCLE_IDLE: $doneList"
        exit 0
    }
} else {
    # Mode: Any (First-responder wins)
    $candidateActivity = @{}
    foreach ($target in $workerList) {
        $candidateActivity[$target] = Ensure-AgentStartedWorking $target
    }

    while ((Get-RemainingTimeoutMs) -gt 100) {
        foreach ($target in $workerList) {
            $raw = herdr agent wait $target --timeout 250 2>$null
            if ($raw) {
                try {
                    $json = $raw | ConvertFrom-Json
                    $agent = $json.result.agent
                    $status = $agent.agent_status
                    $pane = $agent.pane_id

                    if ($status -eq "working" -or $status -eq "blocked") {
                        $candidateActivity[$target] = $true
                    }

                    if ($status -eq "blocked") {
                        Write-Warning "[BLOCKED] Worker '$target' is BLOCKED waiting on human input or approval at pane $pane!"
                    }

                    if ($status -eq "done" -or $status -eq "idle") {
                        if (Test-AgentStableIdle $target) {
                            if ($RequireActivity -and -not $candidateActivity[$target]) {
                                # Nudge Enter once to check if unsubmitted paste was absorbed
                                herdr pane send-keys $target enter 2>$null
                                if (Ensure-AgentStartedWorking $target) {
                                    $candidateActivity[$target] = $true
                                    continue
                                }
                                # Activity was never established; refuse to accept as finished
                                continue
                            }
                            Write-Host "  -> Worker '$target' reached idle state first! (Status: $status, Pane: $pane)" -ForegroundColor Green
                            Write-Output "TERMINAL_ORCHESTRATOR_LIFECYCLE_IDLE: $target"
                            exit 0
                        }
                    }
                } catch {}
            }
        }
    }

    if ($RequireActivity) {
        $anyActivity = $false
        foreach ($act in $candidateActivity.Values) { if ($act) { $anyActivity = $true } }
        if (-not $anyActivity) {
            Write-Error "None of the workers ($($workerList -join ', ')) exhibited activity after dispatch. Failing wait because -RequireActivity was requested."
            exit 1
        }
    }
}

Write-Error "Timeout waiting for worker(s): $($pending.Keys -join ', ') (${TimeoutSeconds}s elapsed)"
exit 1
