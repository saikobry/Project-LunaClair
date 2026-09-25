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
} else {
    Write-Error @"
Usage:
  dispatch.ps1 -Worker <agent|pane_id> -Spec <specPath> [-Wait] [-TimeoutSeconds <sec>]
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

# 4. Verify all spec files exist
foreach ($specPath in $dispatchPlan.Values) {
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

    # Transport 1 (preferred): Herdr's own prompt API. It owns paste AND submit, so there is no
    # Enter race to lose, and `--wait --until working` returns agent_prompt_stalled if the worker
    # never starts. The text goes through a hand-built command line rather than PowerShell's
    # native argument passing, which mangles large multi-line payloads into stray options.
    if ($promptTarget -and $prompt.Length -le $script:MaxInlinePromptChars) {
        Write-Host "Dispatching via Herdr agent prompt to '$promptTarget' ($($prompt.Length) chars)..." -ForegroundColor Cyan
        $promptResult = Invoke-HerdrAgentPrompt -Target $promptTarget -Text $prompt -TimeoutMs 30000
        $flatErr = if ($promptResult.StdErr) { ($promptResult.StdErr -replace '\s+', ' ').Trim() } else { "" }
        $flatOut = if ($promptResult.StdOut) { ($promptResult.StdOut -replace '\s+', ' ').Trim() } else { "" }
        if ("$flatErr $flatOut" -match '"error"|agent_prompt_stalled|agent_blocked|unknown option|not found') {
            Write-Host "  -> Herdr agent prompt rejected or stalled: $flatErr$flatOut" -ForegroundColor DarkYellow
        } elseif ($promptResult.ExitCode -ne 0) {
            Write-Host "  -> Herdr agent prompt exited $($promptResult.ExitCode): $flatErr" -ForegroundColor DarkYellow
        } else {
            $promptDelivered = $true
            $deliveryPath = "agent-prompt:$promptTarget"
        }
    }

    if (-not $promptDelivered -and $paneId -and $prompt.Length -le $script:MaxInlinePromptChars) {
        # Transport 2 (fallback): a single bracketed paste. Must stay ONE call -- `herdr pane
        # send-text` carries the text in its own argv (so ~32K is a hard launch ceiling: a 35KB
        # prompt dies with ApplicationFailedException) and splitting a paste across calls does NOT
        # concatenate reliably in an agent TUI.
        Write-Host "Falling back to bracketed paste into pane '$paneId' ($([int]($prompt.Length / 1024))KB)..." -ForegroundColor DarkYellow
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
        $allowNudge = $deliveryPath -like 'pane-paste:*'
        if (Wait-PromptAccepted -AgentName $agentName -PaneId $paneId -ResubmitEnter:$allowNudge) {
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

    Write-Host "Dispatched task to '$workerItem' using spec: $specPath" -ForegroundColor Green
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
