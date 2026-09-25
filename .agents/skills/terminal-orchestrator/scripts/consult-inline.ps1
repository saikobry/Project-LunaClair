param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Worker,

    [Parameter(Mandatory = $true, Position = 1)]
    [string]$PromptFile,

    [string]$Topic,
    [int]$TimeoutSeconds = 540,
    [int]$Limit = 3,

    # The worker may read the staged file itself. Use this only for workers that are allowed
    # tools; a no-tools consultation needs the content inlined by this script instead.
    [switch]$AllowTools
)

# Inline consultation.
#
# WHY THIS EXISTS: dispatch.ps1 delivers the *prompt text* to the worker -- it never sends the
# spec file's contents. A consultation that forbids tools therefore cannot read the staged spec
# and will refuse (observed: "I couldn't read the plan under the constraints given"), which is why
# `consult.ps1 <worker> <specPath>` alone does not work for a no-tools review.
#
# Passing the content as a shell argument does not solve it either: a large multi-line payload
# gets re-split at the argument boundary (observed: "unknown option: by" reaching Herdr from a
# 19KB prompt). Reading the file INSIDE PowerShell keeps the text out of that boundary entirely.
#
# Size limits (see SKILL.md, Platform Limits):
#   - MAX_INLINE_PROMPT_CHARS is the dispatcher's inline delivery budget.
#   - Above it, condense the prompt into rounds, or use -AllowTools with a spec file reference.

$MaxInlinePromptChars = 20000

if (-not (Test-Path $PromptFile)) {
    Write-Error "Prompt file not found: $PromptFile"
    exit 1
}

$prompt = Get-Content -Path $PromptFile -Raw
if (-not $prompt -or [string]::IsNullOrWhiteSpace($prompt)) {
    Write-Error "Prompt file is empty: $PromptFile"
    exit 1
}

# Normalize line endings: CRLF pairs survive the call chain unevenly and add no meaning.
$prompt = $prompt -replace "`r`n", "`n"
$length = $prompt.Length

Write-Host "Inline consultation prompt: $length chars from $PromptFile" -ForegroundColor DarkGray

if ($length -gt $MaxInlinePromptChars) {
    Write-Error @"
Prompt is $length chars, above the inline delivery budget ($MaxInlinePromptChars).
The dispatcher refuses oversized inline prompts on purpose: past the Windows argv ceiling a
prompt either fails to launch or lands partially, which is how a worker ends up idle with a
half-pasted composer and a report that shows its PREVIOUS turn.

Options:
  1. Condense the prompt (e.g. split a review into round 1 and round 2 files).
  2. Consult on a reference instead: consult-inline.ps1 $Worker $PromptFile -AllowTools,
     after making the staged spec self-contained.
"@
    exit 1
}

if ($length -gt ($MaxInlinePromptChars * 0.9)) {
    Write-Warning "Prompt is $length chars -- within $($MaxInlinePromptChars - $length) chars of the inline budget."
}

$consultArgs = @{
    Worker         = $Worker
    Spec           = $PromptFile
    InstructionPrompt = $prompt
    TimeoutSeconds = $TimeoutSeconds
    Limit          = $Limit
}
if ($Topic) { $consultArgs['Topic'] = $Topic }
if ($AllowTools) { $consultArgs['AllowTools'] = $true }

& "$PSScriptRoot/consult.ps1" @consultArgs
exit $LASTEXITCODE
