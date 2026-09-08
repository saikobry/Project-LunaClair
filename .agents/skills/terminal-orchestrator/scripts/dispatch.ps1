param(
    [string]$Worker,
    [string[]]$Workers,
    [string]$Spec,
    [hashtable]$Target
)

# 1. Normalize targets into a hashtable: SessionName -> SpecPath
$dispatchPlan = @{}

if ($Target -and $Target.Count -gt 0) {
    $dispatchPlan = $Target
} elseif ($Worker -and $Spec) {
    $dispatchPlan[$Worker] = $Spec
} elseif ($Workers -and $Spec) {
    $workerList = @()
    foreach ($w in $Workers) {
        if ($w.Contains(",")) {
            $workerList += ($w -split "," | ForEach-Object { $_.Trim() })
        } else {
            $workerList += $w.Trim()
        }
    }
    foreach ($w in $workerList) {
        if ($w) {
            $dispatchPlan[$w] = $Spec
        }
    }
} else {
    Write-Error "Usage:
  dispatch.ps1 -Worker <session> -Spec <specPath>
  dispatch.ps1 -Workers <session1,session2> -Spec <specPath>
  dispatch.ps1 -Target @{ session1 = 'spec1.md'; session2 = 'spec2.md' }"
    exit 1
}

# 2. Verify WSL tmux sessions exist
$sessions = wsl tmux list-sessions 2>$null
foreach ($session in $dispatchPlan.Keys) {
    if (-not ($sessions -match "^${session}:")) {
        Write-Error "tmux session '$session' not found in WSL. Start it first: tmux new -s $session"
        exit 1
    }
}

# 3. Verify all spec files exist
foreach ($specPath in $dispatchPlan.Values) {
    if (-not (Test-Path $specPath)) {
        Write-Error "Specification file '$specPath' does not exist."
        exit 1
    }
}

# 4. Ensure runtime sentinels directory exists
$sentinelsDir = ".orchestrator/sentinels"
if (-not (Test-Path $sentinelsDir)) {
    New-Item -ItemType Directory -Path $sentinelsDir -Force | Out-Null
}

# 5. Dispatch each worker
foreach ($session in $dispatchPlan.Keys) {
    $specPath = $dispatchPlan[$session]

    # Clean any stale sentinel files for this worker
    $primarySentinel = "$sentinelsDir/$session.done"
    $altSentinel1 = ".done_$session"
    $altSentinel2 = ".freebuff_done"

    if (Test-Path $primarySentinel) { Remove-Item $primarySentinel -Force }
    if (Test-Path $altSentinel1) { Remove-Item $altSentinel1 -Force }
    if (Test-Path $altSentinel2) { Remove-Item $altSentinel2 -Force }

    # Format agent-agnostic prompt with clear sentinel instructions
    $prompt = "Please read $specPath and implement the task. When completely finished, create your completion sentinel file: .orchestrator/sentinels/$session.done (in PowerShell: New-Item -ItemType File -Path .orchestrator/sentinels/$session.done -Force | Out-Null ; in Bash: touch .orchestrator/sentinels/$session.done)"

    # Dispatch to tmux: clear line, type prompt literally, pause, fire Enter
    wsl bash -c "tmux send-keys -t $session End; for i in {1..150}; do tmux send-keys -t $session BSpace; done"
    Start-Sleep -Milliseconds 200
    wsl bash -c "tmux send-keys -t $session -l '$prompt'"
    Start-Sleep -Milliseconds 300
    wsl tmux send-keys -t $session Enter

    Write-Host "Dispatched task to '$session' using spec: $specPath" -ForegroundColor Green
}
