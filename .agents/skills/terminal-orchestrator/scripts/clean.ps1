param(
    [switch]$All
)

$workspaceRoot = (Get-Item -LiteralPath ".").FullName.Replace('\', '/')
$orchestratorDir = [System.IO.Path]::GetFullPath((Join-Path $workspaceRoot ".orchestrator")).Replace('\', '/')

# Verify containment: orchestratorDir must reside under workspaceRoot
if (-not $orchestratorDir.StartsWith($workspaceRoot, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $orchestratorDir)) {
    Write-Error "Invalid orchestrator directory containment: $orchestratorDir"
    exit 1
}

# Clean legacy sentinels directory if present
$sentinelsDir = Join-Path $orchestratorDir "sentinels"
if (Test-Path -LiteralPath $sentinelsDir) {
    Remove-Item -LiteralPath $sentinelsDir -Recurse -Force -ErrorAction SilentlyContinue
}

# Clean any root fallback sentinel files safely with LiteralPath
Get-ChildItem -LiteralPath $workspaceRoot -Filter ".done_*" -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
}

if ($All) {
    foreach ($sub in @("specs", "reports", "tasks")) {
        $subDir = Join-Path $orchestratorDir $sub
        if (Test-Path -LiteralPath $subDir) {
            Get-ChildItem -LiteralPath $subDir -ErrorAction SilentlyContinue | ForEach-Object {
                Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
    }
    Write-Host "Cleaned all temporary specs, reports, and tasks in .orchestrator/" -ForegroundColor Green
} else {
    Write-Host "Cleaned orchestrator staging." -ForegroundColor Green
}
