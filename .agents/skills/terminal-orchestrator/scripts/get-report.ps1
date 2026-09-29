param(
    [string[]]$Workers,
    [string]$SessionId,
    [string]$OutputFile,
    [int]$Limit = 3,
    [switch]$NoSync,
    # ISO-8601 UTC instant captured immediately before dispatch. Assistant turns older than
    # this are never reported: without it, a worker whose prompt was never submitted (or whose
    # turn is still in flight) yields its PREVIOUS turn as if it were this task's answer.
    [string]$SinceIso
)

# 0. Fast incremental sync to ensure AgentsView database has ingested latest WAL/JSONL frames
if (-not $NoSync) {
    try {
        agentsview sync 2>$null | Out-Null
    } catch {}
}

# 1. Normalize worker list
$workerList = @()
if ($Workers) {
    foreach ($w in $Workers) {
        if ($w.Contains(",")) {
            $workerList += ($w -split "," | ForEach-Object { $_.Trim() })
        } else {
            $workerList += $w.Trim()
        }
    }
}
$workerList = $workerList | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique

if ($workerList.Count -eq 0 -and -not $SessionId) {
    Write-Error "Please specify at least one worker (-Workers 'kilo-scout,codex') or a -SessionId."
    exit 1
}

$reports = @()

# Pre-fetch Herdr inventory
$herdrAgents = @()
$herdrPanes = @()
try {
    $raw = herdr agent list 2>$null
    if ($raw) { $herdrAgents = @(($raw | ConvertFrom-Json).result.agents) }
} catch {}
try {
    $rawPanes = herdr pane list 2>$null
    if ($rawPanes) { $herdrPanes = @(($rawPanes | ConvertFrom-Json).result.panes) }
} catch {}

function Get-SingleReport {
    param(
        [string]$TargetWorker,
        [string]$TargetSessionId
    )

    $usedAgentsView = $false

    if (-not $TargetSessionId) {
        # Normalize agent name for agentsview matching
        $agentName = $TargetWorker
        if ($TargetWorker -like "opencode*") { $agentName = "opencode" }
        elseif ($TargetWorker -like "kilo*") { $agentName = "kilo" }
        elseif ($TargetWorker -like "freebuff*") { $agentName = "freebuff" }
        elseif ($TargetWorker -like "cline*") { $agentName = "cline" }
        elseif ($TargetWorker -like "codex*") { $agentName = "codex" }
        elseif ($TargetWorker -like "agy*" -or $TargetWorker -like "antigravity*") { $agentName = "antigravity-cli" }

        # Strategy 1: Check Herdr agent list inventory for live agent_session
        $matchedAgent = $herdrAgents | Where-Object {
            $_.name -eq $TargetWorker -or $_.agent -eq $TargetWorker -or $_.pane_id -eq $TargetWorker
        } | Select-Object -First 1

        if ($matchedAgent -and $matchedAgent.agent_session -and $matchedAgent.agent_session.value) {
            $val = $matchedAgent.agent_session.value
            $kind = $matchedAgent.agent_session.agent
            if (-not $kind) { $kind = $agentName }
            if ($val -like "*:*") {
                $TargetSessionId = $val
            } else {
                $TargetSessionId = "${kind}:${val}"
            }
        }

        # Strategy 2: Targeted AgentsView search (--agent <agentName> --include-one-shot --limit 5)
        if (-not $TargetSessionId) {
            try {
                $raw = agentsview session list --agent $agentName --include-one-shot --limit 5 --json 2>$null
                if ($raw) {
                    $json = $raw | ConvertFrom-Json
                    if ($json.sessions -and $json.sessions.Count -gt 0) {
                        # Prefer session matching current workspace / working directory
                        $currCwd = (Get-Location).Path.Replace('\', '/').TrimEnd('/')
                        $cwdMatch = $json.sessions | Where-Object {
                            $_.cwd -and ($_.cwd.Replace('\', '/').TrimEnd('/') -eq $currCwd)
                        } | Select-Object -First 1

                        if ($cwdMatch) {
                            $TargetSessionId = $cwdMatch.id
                        } else {
                            $TargetSessionId = $json.sessions[0].id
                        }
                    }
                }
            } catch {}
        }

        # Strategy 3: Broader AgentsView search (--since 4h --include-one-shot)
        if (-not $TargetSessionId) {
            try {
                $raw = agentsview session list --since 4h --include-one-shot --json 2>$null
                if ($raw) {
                    $json = $raw | ConvertFrom-Json
                    $match = $json.sessions | Where-Object {
                        $_.agent -eq $agentName -or
                        $_.id -like "${agentName}:*" -or
                        $_.id -like "${TargetWorker}:*"
                    } | Select-Object -First 1

                    if ($match) {
                        $TargetSessionId = $match.id
                    }
                }
            } catch {
                $lines = agentsview session list --since 4h --include-one-shot 2>$null
                $regexMatch = $lines | Select-String "(${agentName}|${TargetWorker}):[^\s]+" | Select-Object -First 1
                if ($regexMatch) {
                    $TargetSessionId = $regexMatch.Matches[0].Value
                }
            }
        }
    }

    $reportText = $null
    $effectiveSessionId = $TargetSessionId
    $noNewTurn = $false

    if ($TargetSessionId) {
        # A turn that has just gone idle may not be flushed to JSONL and indexed yet, so retry
        # briefly when a freshness bound is in force.
        $attempts = if ($SinceIso) { 4 } else { 1 }
        for ($attempt = 1; $attempt -le $attempts -and -not $reportText; $attempt++) {
            if ($attempt -gt 1) {
                Start-Sleep -Milliseconds 1200
                try { agentsview sync 2>$null | Out-Null } catch {}
            }
            try {
                $fetchLimit = [Math]::Max($Limit, 10)
                $rawJson = agentsview session messages $TargetSessionId --role assistant --direction desc --limit $fetchLimit --json 2>$null
                if ($rawJson) {
                    $parsed = $rawJson | ConvertFrom-Json
                    $msgs = @()
                    if ($parsed.messages) { $msgs = @($parsed.messages) }
                    elseif ($parsed -is [System.Array]) { $msgs = @($parsed) }

                    $msgs = @($msgs | Where-Object {
                        $_.role -eq "assistant" -and -not [string]::IsNullOrWhiteSpace($_.content)
                    })

                    if ($SinceIso -and $msgs.Count -gt 0) {
                        # Accommodate agents that record timestamps with minute-only precision (e.g. Freebuff logs HH:mm:00Z).
                        # Subtracting 60 seconds avoids rejecting turns dispatched in the middle of a minute.
                        $since = [DateTime]::Parse($SinceIso, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AdjustToUniversal -bor [System.Globalization.DateTimeStyles]::AssumeUniversal).AddSeconds(-60)
                        $msgs = @($msgs | Where-Object {
                            $ts = [DateTime]::MinValue
                            if ($_.timestamp -and [DateTime]::TryParse($_.timestamp, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AdjustToUniversal -bor [System.Globalization.DateTimeStyles]::AssumeUniversal, [ref]$ts)) {
                                $ts -ge $since
                            } else { $false }
                        })
                    }

                    if ($msgs.Count -gt 0) {
                        $ordered = @($msgs | Sort-Object {
                            $ts = [DateTime]::MinValue
                            [void][DateTime]::TryParse($_.timestamp, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AdjustToUniversal -bor [System.Globalization.DateTimeStyles]::AssumeUniversal, [ref]$ts)
                            $ts
                        })
                        if ($SinceIso) {
                            # A freshness-bound report is exactly one turn: the newest after dispatch.
                            $reportText = ($ordered | Select-Object -Last 1).content
                        } else {
                            $reportText = ((@($ordered | Select-Object -Last ([Math]::Min($Limit, $ordered.Count))) | ForEach-Object { $_.content }) -join ([Environment]::NewLine + [Environment]::NewLine))
                        }
                        $usedAgentsView = $true
                    } elseif ($SinceIso) {
                        $noNewTurn = $true
                    }
                }
            } catch {}
        }
    }

    # If the initial session ID failed or was stale, query AgentsView for any valid session for this agent.
    # With a freshness bound this is skipped: another session's older turn is not this task's answer.
    if (-not $reportText -and -not $SinceIso) {
        try {
            $raw = agentsview session list --agent $agentName --include-one-shot --limit 5 --json 2>$null
            if ($raw) {
                $json = $raw | ConvertFrom-Json
                if ($json.sessions -and $json.sessions.Count -gt 0) {
                    $currCwd = (Get-Location).Path.Replace('\', '/').TrimEnd('/')
                    $candidates = @($json.sessions | Where-Object {
                        $_.cwd -and ($_.cwd.Replace('\', '/').TrimEnd('/') -eq $currCwd)
                    })
                    if ($candidates.Count -eq 0) { $candidates = @($json.sessions) }

                    foreach ($cand in $candidates) {
                        if ($cand.id -eq $TargetSessionId) { continue }
                        $altMsgs = agentsview session messages $cand.id --role assistant --direction desc --limit $Limit 2>$null
                        $altMeaningful = @()
                        foreach ($line in $altMsgs) {
                            if ($line -notmatch '^---\s*#\d+' -and -not [string]::IsNullOrWhiteSpace($line)) {
                                $altMeaningful += $line
                            }
                        }
                        if ($altMeaningful.Count -gt 0) {
                            $reportText = ($altMeaningful -join [Environment]::NewLine)
                            $effectiveSessionId = $cand.id
                            $usedAgentsView = $true
                            break
                        }
                    }
                }
            }
        } catch {}
    }

    # Strategy 4: Fallback to direct Herdr terminal buffer capture. Never used under a
    # freshness bound (a viewport cannot be time-filtered), and never used to mask a missing turn.
    if (-not $reportText -and -not $SinceIso) {
        $herdrLines = herdr agent read $TargetWorker --source recent-unwrapped --lines 80 2>$null

        # If agent read failed, resolve pane ID from Herdr inventory
        if (-not $herdrLines) {
            $resolvedPaneId = $null
            if ($TargetWorker -match "^w\d+:p[0-9a-fA-F]+$") {
                $resolvedPaneId = $TargetWorker
            } else {
                $matched = $herdrAgents | Where-Object {
                    $_.name -eq $TargetWorker -or $_.agent -eq $TargetWorker
                } | Select-Object -First 1
                if ($matched) {
                    $resolvedPaneId = $matched.pane_id
                } else {
                    $matchedPane = $herdrPanes | Where-Object {
                        $_.pane_id -eq $TargetWorker -or $_.agent -eq $TargetWorker
                    } | Select-Object -First 1
                    if ($matchedPane) { $resolvedPaneId = $matchedPane.pane_id }
                }
            }

            if ($resolvedPaneId) {
                $herdrLines = herdr pane read $resolvedPaneId --source recent-unwrapped --lines 80 2>$null
            }
        }

        if ($herdrLines) {
            $reportText = ($herdrLines -join [Environment]::NewLine).Trim()
        }
    }

    if (-not $reportText) {
        if ($SinceIso) {
            $reportText = "(no assistant turn indexed after $SinceIso)" + [Environment]::NewLine +
                "The worker's previous turn is deliberately not reported. Either the prompt was never submitted" + [Environment]::NewLine +
                "(check the pane's composer) or the turn is still in flight. Re-read with: " + [Environment]::NewLine +
                "  agentsview session messages $effectiveSessionId --role assistant --direction desc --limit 1"
        } else {
            Write-Warning "Could not retrieve report or terminal buffer for worker '$TargetWorker'."
            return $null
        }
    }

    if (-not $effectiveSessionId) { $effectiveSessionId = $TargetSessionId }
    if (-not $effectiveSessionId) { $effectiveSessionId = "herdr-pane" }

    $source = if ($noNewTurn) { "AgentsView (no turn after dispatch)" }
              elseif ($usedAgentsView) { "AgentsView" }
              else { "Herdr Terminal Buffer" }

    return [PSCustomObject]@{
        Worker = $TargetWorker
        SessionId = $effectiveSessionId
        Source = $source
        Report = $reportText
        NoNewTurn = $noNewTurn
    }
}

if ($SessionId) {
    $single = Get-SingleReport -TargetWorker "custom" -TargetSessionId $SessionId
    if ($single) { $reports += $single }
} else {
    foreach ($w in $workerList) {
        $single = Get-SingleReport -TargetWorker $w
        if ($single) { $reports += $single }
    }
}

$outputLines = @()
$outputLines += "# Terminal Orchestrator Multi-Report"
$outputLines += "Generated at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') via Herdr"
$outputLines += ""

foreach ($r in $reports) {
    if ($r.NoNewTurn) {
        Write-Warning "'$($r.Worker)': no assistant turn was indexed after $SinceIso. The previous turn is deliberately withheld -- the prompt may be unsubmitted (check the pane) or the turn is still in flight."
        $outputLines += "TERMINAL_ORCHESTRATOR_NO_NEW_TURN: $($r.Worker)"
    }
    $outputLines += "## Worker: $($r.Worker) (Session: $($r.SessionId) | Source: $($r.Source))"
    $outputLines += '```text'
    $outputLines += $r.Report
    $outputLines += '```'
    $outputLines += ""
}

$combinedText = $outputLines -join [Environment]::NewLine
Write-Output $combinedText

if ($OutputFile) {
    $parentDir = Split-Path -Parent $OutputFile
    if ($parentDir -and -not (Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }
    Set-Content -Path $OutputFile -Value $combinedText -Encoding UTF8
    Write-Host ""
    Write-Host "Report saved to: $OutputFile" -ForegroundColor Cyan
}
