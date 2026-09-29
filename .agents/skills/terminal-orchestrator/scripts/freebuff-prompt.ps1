# freebuff-prompt.ps1 - Dispatch prompts to Freebuff in Herdr with focus & modal handling.
[CmdletBinding()]
param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$Prompt,

    [Parameter(Position = 1)]
    [string]$TargetPane,

    [switch]$Wait
)

$ErrorActionPreference = "Stop"

# Locate prompt.js runner via stable junction or plugin search
$pluginScript = Join-Path $env:USERPROFILE ".herdr\plugins\freebuff\scripts\prompt.js"
if (-not (Test-Path $pluginScript)) {
    $matches = Get-ChildItem (Join-Path $env:APPDATA "herdr\plugins\github") -Directory -Filter "freebuff.integration*" -ErrorAction SilentlyContinue
    if ($matches -and $matches.Count -gt 0) {
        $pluginScript = Join-Path $matches[0].FullName "scripts\prompt.js"
    }
}

if (-not (Test-Path $pluginScript)) {
    Write-Error "Freebuff prompt runner not found at '$pluginScript'. Ensure the Freebuff Herdr plugin is installed."
    exit 1
}

$nodeArgs = @($pluginScript)
if ($TargetPane) {
    $nodeArgs += $TargetPane
}
$nodeArgs += $Prompt
if ($Wait) {
    $nodeArgs += "--wait"
}

& node $nodeArgs
exit $LASTEXITCODE
