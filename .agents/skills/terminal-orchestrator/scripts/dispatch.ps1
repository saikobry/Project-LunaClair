param(
    [string]$Worker,
    [string[]]$Workers,
    [string]$Spec,
    [hashtable]$Target,
    [switch]$Wait,
    [int]$TimeoutSeconds = 300,
    [string]$InstructionPrompt = "",
    [string]$AnchorPane,
    [ValidateSet("right", "down")]
    [string]$SplitDirection = "right"
)

# --- Delivery reliability helpers -------------------------------------------------
# Inline delivery budget. Established empirically against Herdr on Windows:
#   - `herdr agent prompt` / `pane send-text` carry TEXT IN ARGV, so a >32K prompt cannot even
#     launch (observed: ApplicationFailedException, exit 2, and "unknown option: by" when the
#     shell re-splits a 19KB argument).
#   - A single ~19KB paste is proven to work; chunked sends do not concatenate reliably.
#   - Above the budget the only dependable transport is a spec file the worker reads itself.
$script:MaxInlinePromptChars = 20000
# Two failure modes this script must never hide:
#   1. A large bracketed paste outruns the agent TUI. The composer holds the text, but an
#      Enter sent ~150ms later is absorbed, leaving the prompt pasted-but-UNSUBMITTED while
#      the agent stays 'idle' (observed with a 19KB prompt in Codex CLI). The wait then
#      returns instantly and its report shows the PREVIOUS turn.
#   2. `herdr agent list` exposes worker identity as `.agent` and only sometimes as `.name`.
#      Testing `.name` alone silently downgraded delivery to raw keystroke injection, which
#      cannot confirm submission at all.
function Get-HerdrAgentStatus([string]$nameOrPane) {
    try {
        $raw = herdr agent get $nameOrPane 2>$null
        if ($raw) {
            $status = ($raw | ConvertFrom-Json).result.agent.agent_status
            if ($status) { return $status }
        }
    } catch {}
    try {
        $listRaw = herdr agent list 2>$null
        if ($listRaw) {
            $hit = ($listRaw | ConvertFrom-Json).result.agents | Where-Object {
                $_.agent -eq $nameOrPane -or $_.name -eq $nameOrPane -or $_.pane_id -eq $nameOrPane
            } | Select-Object -First 1
            if ($hit) { return $hit.agent_status }
        }
    } catch {}
    return $null
}

# Windows command-line quoting (CommandLineToArgvW rules). Used instead of PowerShell's native
# argument passing, which re-splits large multi-line prompts so badly that Herdr sees stray
# options (observed: a 19KB prompt arriving as "unknown option: by").
function ConvertTo-WindowsCommandLineArg([string]$value) {
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('"')
    $backslashes = 0
    foreach ($ch in $value.ToCharArray()) {
        if ($ch -eq '\') { $backslashes++; continue }
        if ($ch -eq '"') {
            if ($backslashes -gt 0) { [void]$sb.Append('\' * ($backslashes * 2 + 1)) } else { [void]$sb.Append('\') }
            [void]$sb.Append('"')
            $backslashes = 0
            continue
        }
        if ($backslashes -gt 0) {
            [void]$sb.Append('\' * $backslashes)
            $backslashes = 0
        }
        [void]$sb.Append($ch)
    }
    if ($backslashes -gt 0) { [void]$sb.Append('\' * ($backslashes * 2)) }
    [void]$sb.Append('"')
    return $sb.ToString()
}

# Atomic prompt submission. Herdr pastes AND submits, and reports agent_prompt_stalled when the
# agent does not start, so this needs no keystroke choreography and cannot lose an Enter race.
function Invoke-HerdrAgentPrompt {
    param(
        [Parameter(Mandatory = $true)][string]$Target,
        [Parameter(Mandatory = $true)][string]$Text,
        [int]$TimeoutMs = 30000
    )

    $herdrExe = 'herdr'
    try {
        $cmd = Get-Command herdr -ErrorAction SilentlyContinue
        if ($cmd -and $cmd.CommandType -eq 'Application' -and $cmd.Path) { $herdrExe = $cmd.Path }
    } catch {}

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $herdrExe
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.Arguments = 'agent prompt ' + (ConvertTo-WindowsCommandLineArg $Target) + ' ' +
        (ConvertTo-WindowsCommandLineArg $Text) +
        ' --wait --until working --until blocked --timeout ' + $TimeoutMs

    $proc = [System.Diagnostics.Process]::Start($psi)
    $outTask = $proc.StandardOutput.ReadToEndAsync()
    $errTask = $proc.StandardError.ReadToEndAsync()
    if (-not $proc.WaitForExit($TimeoutMs + 20000)) {
        try { $proc.Kill() } catch {}
        Write-Warning "Herdr agent prompt did not return within $($TimeoutMs + 20000)ms for '$Target'."
    }
    return [PSCustomObject]@{
        ExitCode = $proc.ExitCode
        StdOut   = ($outTask.Result)
        StdErr   = ($errTask.Result)
    }
}

function Wait-PromptAccepted {
    param(
        [string]$AgentName,
        [string]$PaneId,
        [int]$TimeoutMs = 45000,
        # Keep pressing Enter until the worker starts. A pasted prompt is submitted by whichever
        # Enter the TUI accepts, and a multi-KB paste can take tens of seconds to absorb before an
        # Enter counts at all (observed: a 12KB paste sitting as "[Pasted Content 12417 chars]"
        # with the agent idle through eight early Enters). Extra Enters after acceptance are
        # no-ops because the loop exits as soon as the worker is working/blocked.
        [switch]$ResubmitEnter,
        [int]$MaxResubmits = 15,
        [int]$ResubmitEveryMs = 2500
    )

    # Prefer the pane id as the status probe: some Herdr builds reject agent NAMES for
    # agent-scoped commands ("agent target codex not found") while accepting pane ids.
    $probe = if ($PaneId) { $PaneId } elseif ($AgentName) { $AgentName } else { $null }
    if (-not $probe) { return $false }

    $start = [DateTime]::UtcNow
    $deadline = $start.AddMilliseconds($TimeoutMs)
    $resubmits = 0

    while ([DateTime]::UtcNow -lt $deadline) {
        $status = Get-HerdrAgentStatus $probe
        if ($status -eq "working" -or $status -eq "blocked") { return $true }

        if ($ResubmitEnter -and $PaneId -and $resubmits -lt $MaxResubmits) {
            $dueAt = $ResubmitEveryMs * ($resubmits + 1)
            if (([DateTime]::UtcNow - $start).TotalMilliseconds -ge $dueAt) {
                $resubmits++
                herdr pane send-keys $PaneId enter 2>$null
            }
        }
        Start-Sleep -Milliseconds 300
    }
    return $false
}
# ----------------------------------------------------------------------------------

# 1. Normalize targets into a hashtable: TargetIdentifier -> SpecPath
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
} elseif ($InstructionPrompt) {
    # Inline dispatch: the prompt text is delivered directly, so no spec file is required.
    # Without this branch the documented `-InstructionPrompt` form fell through to the
    # usage error below, because the plan was only ever built from -Spec/-Target.
    if ($Worker) {
        $dispatchPlan[$Worker] = $Spec
    } elseif ($Workers) {
        foreach ($w in ($Workers -split ",")) {
            if ($w.Trim()) { $dispatchPlan[$w.Trim()] = $Spec }
        }
    } else {
        Write-Error @"
Usage:
  dispatch.ps1 -Worker <agent|pane_id> -Spec <specPath> [-Wait] [-TimeoutSeconds <sec>]
  dispatch.ps1 -Worker <agent|pane_id> -InstructionPrompt "<text>" [-Wait]
  dispatch.ps1 -Workers <target1,target2> -Spec <specPath> [-Wait]
  dispatch.ps1 -Target @{ target1 = 'spec1.md'; target2 = 'spec2.md' }

Targets can be Herdr agent names (e.g. 'codex', 'kilo-scout', 'opencode-worker', 'cline')
or Herdr pane IDs (e.g. 'w3:p5', 'w4:p7').
"@
        exit 1
    }
} else {
    Write-Error @"
Usage:
  dispatch.ps1 -Worker <agent|pane_id> -Spec <specPath> [-Wait] [-TimeoutSeconds <sec>]
  dispatch.ps1 -Worker <agent|pane_id> -InstructionPrompt "<text>" [-Wait]
  dispatch.ps1 -Workers <target1,target2> -Spec <specPath> [-Wait]
  dispatch.ps1 -Target @{ target1 = 'spec1.md'; target2 = 'spec2.md' }

Targets can be Herdr agent names (e.g. 'codex', 'kilo-scout', 'opencode-worker', 'cline')
or Herdr pane IDs (e.g. 'w3:p5', 'w4:p7').
"@
    exit 1
}

# 2. Verify Herdr environment
if (-not (Get-Command herdr -ErrorAction SilentlyContinue) -and ($env:HERDR_ENV -ne "1")) {
    Write-Error "Herdr is not running or not found in PATH. Please start Herdr first."
    exit 1
}

# 3. Ensure repo git hygiene (.git/info/exclude)
if (Test-Path .git) {
    $excludePath = ".git/info/exclude"
    $excludeDir = Split-Path $excludePath -Parent
    if (-not (Test-Path $excludeDir)) {
        New-Item -ItemType Directory -Path $excludeDir -Force | Out-Null
    }
    if (-not (Test-Path $excludePath)) {
        New-Item -ItemType File -Path $excludePath -Force | Out-Null
    }
    $hasExclude = (Get-Content $excludePath -ErrorAction SilentlyContinue) -match "^\.orchestrator"
    if (-not $hasExclude) {
        Add-Content -Path $excludePath -Value "`n.orchestrator/"
    }
}

# 4. Verify all spec files exist. In inline mode there is no spec to verify.
foreach ($specPath in $dispatchPlan.Values) {
    if (-not $specPath) { continue }
    if (-not (Test-Path $specPath)) {
        Write-Error "Specification file '$specPath' does not exist."
        exit 1
    }
}

# 5. Fetch Herdr live inventory
$rawAgents = herdr agent list 2>$null
$agentsJson = $null
try {
    if ($rawAgents) { $agentsJson = $rawAgents | ConvertFrom-Json }
} catch {}

$rawPanes = herdr pane list 2>$null
$panesJson = $null
try {
    if ($rawPanes) { $panesJson = $rawPanes | ConvertFrom-Json }
} catch {}

$activeAgents = @($agentsJson.result.agents)
$activePanes = @($panesJson.result.panes)

# 6. Dispatch each worker via Herdr
$deliveryFailures = @()
foreach ($workerItem in $dispatchPlan.Keys) {
    $specPath = $dispatchPlan[$workerItem]

    # Resolve target in Herdr
    $isPane = ($workerItem -match "^w\d+:p[0-9a-fA-F]+$")
    $matchedAgent = $null
    $matchedPane = $null

    if ($isPane) {
        $matchedPane = $activePanes | Where-Object { $_.pane_id -eq $workerItem } | Select-Object -First 1
    } else {
        $matchedAgent = $activeAgents | Where-Object {
            $_.name -eq $workerItem -or $_.agent -eq $workerItem
        } | Select-Object -First 1

        if (-not $matchedAgent) {
            $matchedPane = $activePanes | Where-Object { $_.pane_id -eq $workerItem } | Select-Object -First 1
        }
    }

    # Auto-spawn worker dynamically if not already active in Herdr
    if (-not $isPane -and -not $matchedAgent -and -not $matchedPane) {
        Write-Host "Worker '$workerItem' not found in active Herdr agents. Auto-spawning dynamically..." -ForegroundColor Cyan

        # Resolve agent kind
        $kind = $workerItem
        if ($workerItem -like "kilo*") { $kind = "kilo" }
        elseif ($workerItem -like "opencode*") { $kind = "opencode" }
        elseif ($workerItem -like "codex*") { $kind = "codex" }
        elseif ($workerItem -like "cline*") { $kind = "cline" }
        elseif ($workerItem -like "freebuff*") { $kind = "freebuff" }

        try {
            $splitCmd = "herdr pane split"
            if ($AnchorPane) {
                $splitCmd += " --pane $AnchorPane"
            }
            $splitCmd += " --direction $SplitDirection --no-focus"
            $splitRaw = Invoke-Expression "$splitCmd 2>`$null"
            if ($splitRaw) {
                $splitJson = $splitRaw | ConvertFrom-Json
                $newPaneId = $splitJson.result.pane.pane_id
                Write-Host "Allocated new pane '$newPaneId'. Waiting for shell prompt..." -ForegroundColor Cyan

                # Brief delay for the newly spawned shell process to reach interactive readiness
                Start-Sleep -Milliseconds 1200

                Write-Host "Starting '$workerItem' (kind: $kind) in pane '$newPaneId'..." -ForegroundColor Cyan
                $startRaw = herdr agent start $workerItem --kind $kind --pane $newPaneId 2>$null
                if ($startRaw) {
                    $startJson = $startRaw | ConvertFrom-Json
                    $matchedAgent = $startJson.result.agent
                    Write-Host "Successfully spawned '$workerItem' in pane '$newPaneId'. Waiting for agent TUI initialization..." -ForegroundColor Green
                    Start-Sleep -Milliseconds 1500
                }
            }
        } catch {
            Write-Warning "Auto-spawn failed for '$workerItem': $_"
        }
    }

    # Pure task instruction prompt (no sentinel noise)
    $prompt = if ($InstructionPrompt) {
        $InstructionPrompt
    } else {
        "Please read $specPath and implement the task."
    }

    # Resolve identity for delivery: prefer the agent name (Herdr owns paste + submit and
    # reports lifecycle), fall back to the pane for agents hosting no named worker.
    $agentName = $null
    if ($matchedAgent) {
        if ($matchedAgent.name) { $agentName = $matchedAgent.name }
        elseif ($matchedAgent.agent) { $agentName = $matchedAgent.agent }
    }
    $paneId = if ($isPane) { $workerItem }
              elseif ($matchedPane) { $matchedPane.pane_id }
              elseif ($matchedAgent) { $matchedAgent.pane_id }
              else { $null }

    # Delivery. Two transports, chosen by payload size:
    #   - `herdr agent prompt` for short prompts: Herdr owns paste AND submit, and
    #     `--wait --until working` surfaces a real stall (`agent_prompt_stalled`).
    #     Large multi-line payloads cannot travel through argv on Windows PowerShell -- the
    #     shell re-splits the text and Herdr sees stray options (observed: "unknown option:
    #     by", exit 2), so anything sizeable must NOT use this transport.
    #   - bracketed paste + Enter for everything larger, which is what the pane delivers anyway.
    # Pane ids are the target form: some Herdr builds reject agent NAMES
    # ("agent target codex not found" for `herdr agent prompt codex ...`).
    $promptDelivered = $false
    $deliveryPath = $null
    $promptTarget = if ($paneId) { $paneId } else { $agentName }
    $shortPromptMaxChars = 1000
    $isLargeOrMultiline = ($prompt.Length -gt $shortPromptMaxChars) -or ($prompt.Contains("`n"))

    # Transport 0 (Freebuff): Freebuff's OpenTUI composer requires focus and enter keystroke choreography
    $isFreebuff = ($agentName -eq 'freebuff') -or ($matchedPane -and ($matchedPane.agent -eq 'freebuff' -or $matchedPane.display_agent -eq 'freebuff'))
    if (-not $promptDelivered -and $isFreebuff) {
        Write-Host "Dispatching to Freebuff pane '$paneId' via freebuff-prompt..." -ForegroundColor Cyan
        $fbScript = Join-Path $PSScriptRoot "freebuff-prompt.ps1"
        if (Test-Path $fbScript) {
            & $fbScript -Prompt $prompt -TargetPane $paneId
            if ($LASTEXITCODE -eq 0) {
                $promptDelivered = $true
                $deliveryPath = "freebuff-prompt:$paneId"
            }
        }
    }

    # If pane ID is known and prompt is large or multi-line, bypass Transport 1 to prevent
    # agent_prompt_stalled false-failures and double-paste races.
    $canUseAgentPrompt = (-not $promptDelivered) -and $promptTarget -and (-not $isLargeOrMultiline -or -not $paneId) -and ($prompt.Length -le $script:MaxInlinePromptChars)

    # Transport 1: Herdr's own prompt API.
    # Note: `herdr agent prompt` has an unconfigurable 5s deadline to observe 'working'.
    # Crucially, Herdr sends the text to the pane BEFORE checking that deadline. If it stalls,
    # the text IS ALREADY in the composer; falling back to bracketed paste would paste it a
    # second time (causing duplicate prompts).
    if ($canUseAgentPrompt) {
        Write-Host "Dispatching via Herdr agent prompt to '$promptTarget' ($($prompt.Length) chars)..." -ForegroundColor Cyan
        $promptResult = Invoke-HerdrAgentPrompt -Target $promptTarget -Text $prompt -TimeoutMs 30000
        $flatErr = if ($promptResult.StdErr) { ($promptResult.StdErr -replace '\s+', ' ').Trim() } else { "" }
        $flatOut = if ($promptResult.StdOut) { ($promptResult.StdOut -replace '\s+', ' ').Trim() } else { "" }

        if ("$flatErr $flatOut" -match 'agent_prompt_stalled') {
            # Herdr already sent the prompt and Enter to the pane, but the agent took >5s to enter 'working'.
            # DO NOT fall back to bracketed paste here: doing so pastes a second copy into the composer!
            # Instead, mark as delivered and let Wait-PromptAccepted handle the wait and Enter nudge.
            Write-Host "  -> Herdr agent prompt text sent; worker did not enter 'working' within 5s (proceeding to confirmation wait)..." -ForegroundColor DarkYellow
            $promptDelivered = $true
            $deliveryPath = "agent-prompt:$promptTarget"
        } elseif ("$flatErr $flatOut" -match 'agent_blocked') {
            Write-Warning "Agent '$promptTarget' is blocked. Refusing to inject prompt."
        } elseif ("$flatErr $flatOut" -match '"error"|unknown option|not found|agent_not_ready') {
            Write-Host "  -> Herdr agent prompt rejected before delivery: $flatErr$flatOut" -ForegroundColor DarkYellow
        } elseif ($promptResult.ExitCode -ne 0) {
            Write-Host "  -> Herdr agent prompt exited $($promptResult.ExitCode): $flatErr" -ForegroundColor DarkYellow
        } else {
            $promptDelivered = $true
            $deliveryPath = "agent-prompt:$promptTarget"
        }
    }

    # Transport 2: bracketed paste directly into pane
    if (-not $promptDelivered -and $paneId -and $prompt.Length -le $script:MaxInlinePromptChars) {
        $desc = if ($isLargeOrMultiline) { "bracketed paste" } else { "bracketed paste fallback" }
        Write-Host "Dispatching via $desc into pane '$paneId' ($([int]($prompt.Length / 1024))KB)..." -ForegroundColor $(if ($isLargeOrMultiline) { "Cyan" } else { "DarkYellow" })
        herdr pane send-text $paneId $prompt
        # A large paste must settle before Enter is meaningful: a premature Enter is absorbed
        # and leaves the composer populated but unsubmitted.
        $settleMs = [Math]::Min(4000, [Math]::Max(400, 250 + [int]($prompt.Length / 12)))
        Start-Sleep -Milliseconds $settleMs
        herdr pane send-keys $paneId enter
        $promptDelivered = $true
        $deliveryPath = "pane-paste:$paneId"
    }

    if (-not $promptDelivered) {
        $deliveryFailures += $workerItem
        if ($paneId -and $prompt.Length -gt $script:MaxInlinePromptChars) {
            # Refuse loudly instead of silently mangling the prompt. Inline delivery above the
            # budget either fails to launch (>32K argv) or lands partially, which is exactly how
            # a worker ends up idle with a half-pasted composer. Large payloads belong in a spec
            # file the worker reads, not in argv.
            Write-Warning "Prompt for '$workerItem' is $($prompt.Length) chars, above the inline delivery budget ($($script:MaxInlinePromptChars)). Send it as a spec file reference instead of -InstructionPrompt, or condense it."
        } else {
            Write-Warning "No viable delivery transport for '$workerItem': the short-prompt API path was unusable and no pane id resolved."
        }
    } else {
        # Delivery confirmation: a pasted-but-unsubmitted prompt must never be reported as a
        # successful dispatch, because the follow-up wait would return instantly and its report
        # would present the worker's previous turn as this task's answer.
        $allowNudge = ($deliveryPath -like 'pane-paste:*') -or ($deliveryPath -like 'agent-prompt:*')

        # The Freebuff runner already verifies submission, and verifies it more strictly than
        # this script can: it accepts agent_status, an advanced state_change_seq, OR a new
        # answered prompt card in the transcript. Re-checking here with agent_status alone
        # would downgrade that verdict to "unconfirmed" on any pane whose status-watcher is
        # not alive -- and Herdr's agent_status stays frozen 'idle' there even for turns
        # that ran and answered. Observed: 5/5 delivered, reported as failures.
        if ($deliveryPath -like 'freebuff-prompt:*') {
            Write-Host "  -> Delivery confirmed by the Freebuff runner, which verifies via status, seq, and transcript." -ForegroundColor Green
        } elseif (Wait-PromptAccepted -AgentName $agentName -PaneId $paneId -ResubmitEnter:$allowNudge) {
            Write-Host "  -> Delivery confirmed via ${deliveryPath}: '$workerItem' entered 'working'." -ForegroundColor Green
        } else {
            $deliveryFailures += $workerItem
            Write-Warning "Prompt delivery to '$workerItem' via ${deliveryPath} was NOT confirmed (agent stayed idle) after repeated Enter attempts. Pane: $paneId"
            if ($allowNudge) {
                # Never send ctrl+c or Escape to clear a composer: in Codex CLI ctrl+c (twice in
                # quick succession) EXITS the agent, and Escape means "edit previous message",
                # silently re-opening the previous turn. Clearing is the operator's call.
                Write-Warning "Pane '$paneId' may still hold an unsubmitted paste. Clear it in the pane yourself (backspace/select-and-delete), then retry -- do not send ctrl+c, which exits the agent."
            }
        }
    }

    if ($InstructionPrompt) {
        Write-Host "Dispatched inline prompt to '$workerItem' ($($InstructionPrompt.Length) chars)" -ForegroundColor Green
    } else {
        Write-Host "Dispatched task to '$workerItem' using spec: $specPath" -ForegroundColor Green
    }
}

if ($deliveryFailures.Count -gt 0) {
    Write-Error @"
Unconfirmed prompt delivery for: $($deliveryFailures -join ', ')
Refusing to report a successful dispatch: the agent never left 'idle', so any wait would
return instantly and its report would show the PREVIOUS turn. Press Enter in the affected
pane (or re-run dispatch) and check the pane's composer first.
"@
    exit 1
}

if ($Wait) {
    $workersToWait = $dispatchPlan.Keys -join ","
    & "$PSScriptRoot/wait-agent.ps1" -Workers $workersToWait -TimeoutSeconds $TimeoutSeconds -RequireActivity
}
