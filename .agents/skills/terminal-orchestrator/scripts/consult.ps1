param(
    [Parameter(Position=0)]
    [string]$Worker,

    [Parameter(Position=1)]
    [string]$Spec,

    [string]$Prompt,
    [string]$Topic,
    [switch]$StagedDiff,
    [switch]$Changes,
    [switch]$FullDiff,
    [string]$OutputFile,
    [int]$TimeoutSeconds = 300,
    [int]$Limit = 3,
    [string]$InstructionPrompt = "",
    [switch]$AllowTools
)

function Format-DiffSection {
    param(
        [string]$Title,
        [string]$DiffCommand,
        [string]$StatCommand,
        [switch]$FullDiff
    )

    $excludePathspecs = @('":(exclude)*package-lock.json"', '":(exclude)*pnpm-lock.yaml"', '":(exclude)*yarn.lock"')
    $cmd = "$DiffCommand -- . " + ($excludePathspecs -join " ")
    $rawDiff = (Invoke-Expression "$cmd 2>`$null")
    if ($rawDiff) {
        $rawDiff = $rawDiff -join "`n"
    }

    if (-not $rawDiff -or [string]::IsNullOrWhiteSpace($rawDiff)) {
        return @()
    }

    $lines = @("## $Title")

    $byteCount = [System.Text.Encoding]::UTF8.GetByteCount($rawDiff)
    $splitLines = $rawDiff -split "\r?\n"
    $lineCount = $splitLines.Count

    $maxBytes = 150 * 1024  # 150KB
    $maxLines = 1500

    $needsTruncate = (-not $FullDiff) -and ($byteCount -gt $maxBytes -or $lineCount -gt $maxLines)

    if ($needsTruncate) {
        if ($StatCommand) {
            $statCmd = "$StatCommand -- . " + ($excludePathspecs -join " ")
            $statRaw = (Invoke-Expression "$statCmd 2>`$null")
            if ($statRaw) {
                $statLines = $statRaw -split "\r?\n"
                $lines += "### Summary of Changes (--stat)"
                $lines += '```text'
                if ($statLines.Count -gt 100) {
                    $lines += ($statLines | Select-Object -First 100)
                    $lines += "... ($($statLines.Count - 100) more files omitted from stat summary)"
                } else {
                    $lines += $statRaw
                }
                $lines += '```'
                $lines += ""
            }
        }

        $retainedLines = $splitLines | Select-Object -First 1000
        $lines += "### Diff Preview (Truncated to first 1000 lines)"
        $lines += '```diff'
        $lines += ($retainedLines -join "`n")
        $lines += '```'
        $lines += ""
        $lines += "> [!WARNING]"
        $lines += "> **[TRUNCATED]** This diff was **$([math]::Round($byteCount / 1024, 1)) KB** across **$lineCount lines** (exceeded threshold)."
        $lines += "> Showing `--stat` summary and first 1,000 lines to preserve token quota. Re-run with `-FullDiff` if the full raw diff is strictly required."
        $lines += ""
    } else {
        $lines += '```diff'
        $lines += $rawDiff
        $lines += '```'
        $lines += ""
    }

    return $lines
}

# 1. Resolve or generate specification file
$specPath = $Spec

if (-not $Worker) {
    Write-Error @"
Usage:
  consult.ps1 -Worker <agent|pane_id> [-Changes] [-Topic <title>]
  consult.ps1 -Worker <agent|pane_id> -Spec <specPath> [-OutputFile <path>]
  consult.ps1 -Worker <agent|pane_id> -Prompt <text> [-Topic <title>]
  consult.ps1 -Worker <agent|pane_id> -StagedDiff [-Topic <title>]

Examples:
  # Quick consultation on all current changes (staged + working tree):
  consult.ps1 opencode
  consult.ps1 codex -Changes -Topic "Review Current Changes"

  # Consult with an existing spec:
  consult.ps1 codex .orchestrator/specs/review.md

  # Quick consultation with inline prompt:
  consult.ps1 codex -Prompt "Should we use enum or union for the status field?"

  # Consult any worker on current staged git diff:
  consult.ps1 codex -StagedDiff -Topic "Review Staged AI Hardening"
  consult.ps1 kilo -StagedDiff -Topic "AST Refactor Review"
"@
    exit 1
}

if (-not (Test-Path ".orchestrator/specs")) {
    New-Item -ItemType Directory -Path ".orchestrator/specs" -Force | Out-Null
}

if (-not $specPath) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $cleanWorkerName = ($Worker -replace '[:\\]', '_')
    $specPath = ".orchestrator/specs/consult-$cleanWorkerName-$timestamp.md"

    $isDiff = $StagedDiff -or $Changes -or (-not $specPath -and -not $Prompt)

    $defaultTitle = if ($isDiff) { "Review of Current Changes" } else { "Consultation Request" }
    $title = if ($Topic) { $Topic } else { $defaultTitle }
    $lines = @(
        "# $title",
        "",
        "> Dispatched to: **$Worker** at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
        ""
    )

    if (-not $AllowTools) {
        $lines += "> [!IMPORTANT]"
        $lines += '> **Read this file only.** Do not read other files and do not run commands or edits. Respond in prose with your findings and verdict.'
        $lines += ""
    }

    if ($Prompt) {
        $lines += "## Request / Context"
        $lines += $Prompt
        $lines += ""
    }

    if ($isDiff) {
        $lines += "## Changed Files (git status -s)"
        $lines += '```'
        $status = git status -s 2>$null
        if ($status) {
            $lines += $status
        } else {
            $lines += "(Clean working tree - no modified files detected)"
        }
        $lines += '```'
        $lines += ""

        $stagedLines = Format-DiffSection -Title "Staged Changes (git diff --cached)" -DiffCommand "git diff --cached" -StatCommand "git diff --cached --stat=200,200" -FullDiff:$FullDiff
        $unstagedLines = if (-not $StagedDiff) {
            Format-DiffSection -Title "Working Tree Changes (git diff)" -DiffCommand "git diff" -StatCommand "git diff --stat=200,200" -FullDiff:$FullDiff
        } else {
            @()
        }

        if ($stagedLines.Count -gt 0) {
            $lines += $stagedLines
        }

        if ($unstagedLines.Count -gt 0) {
            $lines += $unstagedLines
        }

        if ($stagedLines.Count -eq 0 -and $unstagedLines.Count -eq 0) {
            $lines += "## Git Diff"
            $lines += '```'
            $lines += "(No staged or unstaged diff in repository)"
            $lines += '```'
            $lines += ""
        }

        $lines += "## Required Review"
        $lines += "Please review the changes above and provide:"
        $lines += "1. **Verdicts** per area (concur / add nuance / dissent)"
        $lines += "2. **Key risks**, edge cases, or potential regressions"
        $lines += "3. **Commit readiness** assessment and recommendations"
        $lines += ""
    }

    Set-Content -Path $specPath -Value ($lines -join "`n") -Encoding utf8
    Write-Host "Generated consultation spec: $specPath" -ForegroundColor Cyan
}

if (-not (Test-Path $specPath)) {
    Write-Error "Specification file not found: $specPath"
    exit 1
}

# 2. Resolve output report path
if (-not $OutputFile) {
    if (-not (Test-Path ".orchestrator/reports")) {
        New-Item -ItemType Directory -Path ".orchestrator/reports" -Force | Out-Null
    }
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($specPath)
    $cleanWorker = ($Worker -replace '[:\\]', '_')
    $OutputFile = ".orchestrator/reports/$cleanWorker-$baseName.md"
}

Write-Host "`n=== Starting Consultation with '$Worker' ===" -ForegroundColor Cyan
Write-Host "  Spec:   $specPath"
Write-Host "  Report: $OutputFile`n"

# 3. Dispatch task to worker with synchronous wait
$defaultPrompt = if ($AllowTools) {
    "Please review $specPath and provide your report."
} else {
    "Please read and review $specPath (you may read this single file, but do not read other files and do not run commands or edits), then provide your report in prose."
}
$promptToDispatch = if ($InstructionPrompt) { $InstructionPrompt } else { $defaultPrompt }

& "$PSScriptRoot/dispatch.ps1" -Worker $Worker -Spec $specPath -Wait -TimeoutSeconds $TimeoutSeconds -InstructionPrompt $promptToDispatch
if ($LASTEXITCODE -ne 0) {
    Write-Error "Dispatch failed or timed out for worker '$Worker'."
    exit $LASTEXITCODE
}

# 4. Extract structured report via AgentsView
& "$PSScriptRoot/get-report.ps1" -Workers $Worker -OutputFile $OutputFile -Limit $Limit
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Report extraction had warnings or fallback to terminal buffer."
}

# 5. Output completion summary
if (Test-Path $OutputFile) {
    Write-Host "`n=== Consultation Complete ===" -ForegroundColor Green
    Write-Host "Report saved to: $OutputFile`n"
}
