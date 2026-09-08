param(
    [switch]$All
)

$sentinelsDir = ".orchestrator/sentinels"
if (Test-Path $sentinelsDir) {
    Get-ChildItem -Path $sentinelsDir -Filter "*.done" -ErrorAction SilentlyContinue | Remove-Item -Force
    Write-Host "Cleaned active sentinels in $sentinelsDir" -ForegroundColor Green
}

# Clean any root fallback sentinels
Get-ChildItem -Path . -Filter ".done_*" -ErrorAction SilentlyContinue | Remove-Item -Force
if (Test-Path ".freebuff_done") {
    Remove-Item ".freebuff_done" -Force
}

if ($All) {
    $specsDir = ".orchestrator/specs"
    $reportsDir = ".orchestrator/reports"
    if (Test-Path $specsDir) { Remove-Item "$specsDir/*" -Recurse -Force -ErrorAction SilentlyContinue }
    if (Test-Path $reportsDir) { Remove-Item "$reportsDir/*" -Recurse -Force -ErrorAction SilentlyContinue }
    Write-Host "Cleaned all temporary specs and reports in .orchestrator/" -ForegroundColor Green
}
