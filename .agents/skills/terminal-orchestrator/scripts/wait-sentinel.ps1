param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string[]]$Workers,
    [ValidateSet("All", "Any")]
    [string]$Mode = "All",
    [int]$TimeoutSeconds = 1800
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
$workerList = $workerList | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique

if ($workerList.Count -eq 0) {
    Write-Error "No valid workers specified to wait on."
    exit 1
}

$pending = @{}
foreach ($w in $workerList) {
    $pending[$w] = $true
}
$completed = @{}

$sentinelsDir = ".orchestrator/sentinels"
$elapsed = 0

Write-Host "Waiting for sentinels from [$($workerList -join ', ')] (Mode: $Mode, Timeout: ${TimeoutSeconds}s)..." -ForegroundColor Cyan

while ($elapsed -lt $TimeoutSeconds) {
    Start-Sleep -Seconds 2
    $elapsed += 2

    foreach ($w in @($pending.Keys)) {
        $primary = "$sentinelsDir/$w.done"
        $alt1 = ".done_$w"
        $alt2 = ".freebuff_done"

        $found = $null
        if (Test-Path $primary) {
            $found = $primary
        } elseif (Test-Path $alt1) {
            $found = $alt1
        } elseif (($workerList.Count -eq 1) -and (Test-Path $alt2)) {
            $found = $alt2
        }

        if ($found) {
            Write-Host "  -> Worker '$w' finished! (sentinel: $found)" -ForegroundColor Green
            Remove-Item $found -Force -ErrorAction SilentlyContinue
            $completed[$w] = $true
            $pending.Remove($w)
        }
    }

    if ($Mode -eq "Any" -and $completed.Count -gt 0) {
        $doneList = $completed.Keys -join ", "
        Write-Output "TERMINAL_ORCHESTRATOR_TASK_COMPLETED: $doneList"
        exit 0
    }

    if ($Mode -eq "All" -and $pending.Count -eq 0) {
        $doneList = $completed.Keys -join ", "
        Write-Output "TERMINAL_ORCHESTRATOR_TASK_COMPLETED: $doneList"
        exit 0
    }
}

Write-Error "Timeout waiting for sentinel(s) from: $($pending.Keys -join ', ') (${TimeoutSeconds}s elapsed)"
exit 1
