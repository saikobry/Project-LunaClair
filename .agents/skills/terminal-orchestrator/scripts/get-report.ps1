param(
    [string[]]$Workers,
    [string]$SessionId,
    [string]$OutputFile
)

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
    Write-Error "Please specify at least one worker (-Workers 'freebuff,opencode2') or a -SessionId."
    exit 1
}

$reports = @()

function Get-SingleReport {
    param(
        [string]$TargetWorker,
        [string]$TargetSessionId
    )

    if (-not $TargetSessionId) {
        # Normalize agent name for agentsview matching
        $agentName = $TargetWorker
        if ($TargetWorker -like "opencode*") { $agentName = "opencode" }

        try {
            $raw = agentsview session list --since 4h --include-one-shot --json 2>$null
            $json = $raw | ConvertFrom-Json
            $match = $json.sessions | Where-Object {
                $_.agent -eq $agentName -or
                $_.id -like "${agentName}:*" -or
                $_.id -like "${TargetWorker}:*"
            } | Select-Object -First 1

            if ($match) {
                $TargetSessionId = $match.id
            }
        } catch {
            $lines = agentsview session list --since 4h --include-one-shot 2>$null
            $regexMatch = $lines | Select-String "(${agentName}|${TargetWorker}):[^\s]+" | Select-Object -First 1
            if ($regexMatch) {
                $TargetSessionId = $regexMatch.Matches[0].Value
            }
        }
    }

    $reportText = $null
    if ($TargetSessionId) {
        $rawMsgs = agentsview session messages $TargetSessionId --role assistant --direction desc --limit 5 2>$null
        $meaningful = @()
        foreach ($line in $rawMsgs) {
            if ($line -notmatch '^---\s*#\d+' -and -not [string]::IsNullOrWhiteSpace($line)) {
                $meaningful += $line
            }
        }
        if ($meaningful.Count -gt 0) {
            $reportText = ($meaningful -join [Environment]::NewLine)
        }
    }

    # Fallback to direct tmux pane buffer if agentsview message is blank or unavailable
    if (-not $reportText) {
        $paneLines = wsl tmux capture-pane -p -t $TargetWorker -S -25 2>$null
        if ($paneLines) {
            $trimmedPane = ($paneLines -join [Environment]::NewLine).Trim()
            if ($trimmedPane) {
                $reportText = $trimmedPane
            }
        }
    }

    if (-not $reportText) {
        Write-Warning "Could not retrieve report or tmux pane for worker '$TargetWorker'."
        return $null
    }

    $effectiveSessionId = $TargetSessionId
    if (-not $effectiveSessionId) { $effectiveSessionId = "tmux-pane" }

    return [PSCustomObject]@{
        Worker = $TargetWorker
        SessionId = $effectiveSessionId
        Report = $reportText
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
$outputLines += "Generated at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$outputLines += ""

foreach ($r in $reports) {
    $outputLines += "## Worker: $($r.Worker) (Session: $($r.SessionId))"
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
