param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string[]]$Workers,
    [ValidateSet("All", "Any")]
    [string]$Mode = "All",
    [int]$TimeoutSeconds = 600,
    [int]$DebounceMilliseconds = 3600
)

# 1. Normalize worker list
$workerList = @()
foreach ($w in $Workers) {
    if ($w.Contains(",")) {
        $workerList += ($w -split "," | ForEach-Object { $_.Trim() })
    } else {
        $workerList += $w.Trim()
    }
}
$workerList = @($workerList | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)

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

    # Multi-stage diff guard: require 2 consecutive quiet windows of at least 1800ms
    # This guarantees that streaming stalls, TTFT network lag, or tool-to-thinking transitions cannot fool the watcher
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
            if ($curStatus -ne "working" -and $curStatus -ne "blocked") {
                # Wait up to 6s for the newly dispatched agent to transition to working or blocked
                $null = herdr agent wait $targetAgent --until working --until blocked --timeout 6000 2>$null
            }
        }
    } catch {}
}

# Fast path: Single worker - 100% reactive socket wait with zero polling delay
if ($workerList.Count -eq 1) {
    $target = $workerList[0]
    Ensure-AgentStartedWorking $target

    while ((Get-RemainingTimeoutMs) -gt 100) {
        $curTimeout = Get-RemainingTimeoutMs
        $raw = herdr agent wait $target --timeout $curTimeout 2>$null
        if ($raw) {
            try {
                $json = $raw | ConvertFrom-Json
                $agent = $json.result.agent
                $status = $agent.agent_status
                $pane = $agent.pane_id

                if ($status -eq "blocked") {
                    Write-Warning "[BLOCKED] Worker '$target' is BLOCKED waiting on human input or approval at pane $pane!"
                    Start-Sleep -Milliseconds 500
                    continue
                }

                if ($status -eq "done" -or $status -eq "idle") {
                    if (Test-AgentStableIdle $target) {
                        Write-Host "  -> Worker '$target' finished! (Status: $status, Pane: $pane)" -ForegroundColor Green
                        Write-Output "TERMINAL_ORCHESTRATOR_TASK_COMPLETED: $target"
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
        Ensure-AgentStartedWorking $target
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

                    if ($status -eq "blocked") {
                        Write-Warning "[BLOCKED] Worker '$target' is BLOCKED waiting on human input or approval at pane $pane!"
                        Start-Sleep -Milliseconds 500
                        $curTimeout = Get-RemainingTimeoutMs
                        continue
                    }

                    if ($status -eq "done" -or $status -eq "idle") {
                        if (Test-AgentStableIdle $target) {
                            Write-Host "  -> Worker '$target' finished! (Status: $status, Pane: $pane)" -ForegroundColor Green
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
        Write-Output "TERMINAL_ORCHESTRATOR_TASK_COMPLETED: $doneList"
        exit 0
    }
} else {
    # Mode: Any (First-responder wins)
    # Rapid reactive polling with low-latency socket checks across candidates
    while ((Get-RemainingTimeoutMs) -gt 100) {
        foreach ($target in $workerList) {
            $raw = herdr agent wait $target --timeout 250 2>$null
            if ($raw) {
                try {
                    $json = $raw | ConvertFrom-Json
                    $agent = $json.result.agent
                    $status = $agent.agent_status
                    $pane = $agent.pane_id

                    if ($status -eq "blocked") {
                        Write-Warning "[BLOCKED] Worker '$target' is BLOCKED waiting on human input or approval at pane $pane!"
                    }

                    if ($status -eq "done" -or $status -eq "idle") {
                        if (Test-AgentStableIdle $target) {
                            Write-Host "  -> Worker '$target' finished first! (Status: $status, Pane: $pane)" -ForegroundColor Green
                            Write-Output "TERMINAL_ORCHESTRATOR_TASK_COMPLETED: $target"
                            exit 0
                        }
                    }
                } catch {}
            }
        }
    }
}

Write-Error "Timeout waiting for worker(s): $($pending.Keys -join ', ') (${TimeoutSeconds}s elapsed)"
exit 1
