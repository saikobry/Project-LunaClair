param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$SpecPath,
    [string]$Session = "freebuff"
)

# 1. Verify tmux session exists
$sessions = wsl tmux list-sessions 2>$null
if ($sessions -notmatch $Session) {
    Write-Error "tmux session '$Session' not found in WSL. Start freebuff in tmux first: tmux new -s $Session"
    exit 1
}

# 2. Verify spec file exists
if (-not (Test-Path $SpecPath)) {
    Write-Error "Specification file '$SpecPath' does not exist."
    exit 1
}

# 3. Clean any stale sentinel file in the repo root
$sentinel = ".freebuff_done"
if (Test-Path $sentinel) {
    Remove-Item $sentinel -Force
}

# 4. Format prompt
$prompt = "Please read $SpecPath and implement the task. Remember to run touch .freebuff_done when completely finished."

# 5. Dispatch to tmux: clear line, type prompt literally, pause, fire Enter
wsl bash -c "tmux send-keys -t $Session End; for i in {1..150}; do tmux send-keys -t $Session BSpace; done"
Start-Sleep -Milliseconds 200
wsl bash -c "tmux send-keys -t $Session -l '$prompt'"
Start-Sleep -Milliseconds 300
wsl tmux send-keys -t $Session Enter
Write-Host "Dispatched task to '$Session' using spec: $SpecPath" -ForegroundColor Green
