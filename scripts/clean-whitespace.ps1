# PowerShell script to clean trailing whitespace and ensure exactly one trailing newline
$ErrorActionPreference = 'Stop'

# Always resolve the repository root relative to this script's location (one level up from scripts/)
$solutionRoot = Split-Path $PSScriptRoot -Parent
Write-Host "Scanning for TypeScript (*.ts, *.tsx), JavaScript (*.js, *.mjs), SQL (*.sql), and CSS (*.css) files under: $solutionRoot"

$files = Get-ChildItem -Path $solutionRoot -File -Recurse | Where-Object {
    ($_.Extension -in @(".ts", ".tsx", ".js", ".mjs", ".sql", ".css")) -and
    $_.FullName -notlike "*\node_modules\*" -and
    $_.FullName -notlike "*\dist\*" -and
    $_.FullName -notlike "*\coverage\*" -and
    $_.FullName -notlike "*\.wrangler\*" -and
    $_.FullName -notlike "*\.git\*" -and
    $_.FullName -notlike "*\.gemini\*" -and
    $_.FullName -notlike "*\.agents\*" -and
    $_.FullName -notlike "*\migrations\*"
}

$cleanedCount = 0
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

foreach ($file in $files) {
    $raw = [System.IO.File]::ReadAllText($file.FullName)
    
    if ([string]::IsNullOrEmpty($raw)) {
        continue
    }
    
    # Detect the file's current line ending (CRLF vs LF)
    $lineEnding = "`r`n"
    if ($raw -match "(?<!\r)\n") {
        $lineEnding = "`n"
    }
    
    # Trim all trailing whitespace and newlines, then add exactly ONE trailing newline
    $trimmed = $raw.TrimEnd() + $lineEnding
    
    if ($raw -ne $trimmed) {
        [System.IO.File]::WriteAllText($file.FullName, $trimmed, $utf8NoBom)
        $cleanedCount++
    }
}

Write-Host "Successfully cleaned $cleanedCount files (removed trailing whitespace/extra newlines)."
