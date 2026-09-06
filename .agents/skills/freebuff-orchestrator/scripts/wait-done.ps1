param(
    [string]$Sentinel = ".freebuff_done",
    [int]$TimeoutSeconds = 1800
)

$elapsed = 0
while (-not (Test-Path $Sentinel)) {
    Start-Sleep -Seconds 2
    $elapsed += 2
    if ($elapsed -ge $TimeoutSeconds) {
        Write-Error "Timeout waiting for sentinel: $Sentinel ($TimeoutSeconds seconds elapsed)"
        exit 1
    }
}

Remove-Item $Sentinel -Force -ErrorAction SilentlyContinue
Write-Output "FREEBUFF_TASK_COMPLETED"
exit 0
