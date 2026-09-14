param(
    [switch]$All
)

# Clean legacy sentinels directory if present
$sentinelsDir = ".orchestrator/sentinels"
if (Test-Path $sentinelsDir) {
    Remove-Item $sentinelsDir -Recurse -Force -ErrorAction SilentlyContinue
}

# Clean any root fallback sentinel files
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
} else {
    Write-Host "Cleaned orchestrator staging." -ForegroundColor Green
}
