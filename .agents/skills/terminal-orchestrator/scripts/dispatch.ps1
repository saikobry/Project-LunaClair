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
foreach ($workerItem in $dispatchPlan.Keys) {
    $specPath = $dispatchPlan[$workerItem]

    # Resolve target in Herdr
    $isPane = ($workerItem -match "^w\d+:p\d+$")
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

    # Delivery
    if ($matchedAgent -and $matchedAgent.name) {
        $agentName = $matchedAgent.name
        Write-Host "Dispatching via Herdr agent prompt to '$agentName'..." -ForegroundColor Cyan
        herdr agent prompt $agentName $prompt
    } elseif ($isPane -or $matchedPane -or ($matchedAgent -and $matchedAgent.pane_id)) {
        $paneId = if ($isPane) { $workerItem } elseif ($matchedPane) { $matchedPane.pane_id } else { $matchedAgent.pane_id }
        Write-Host "Dispatching via Herdr pane to '$paneId'..." -ForegroundColor Cyan
        herdr pane send-text $paneId $prompt
        Start-Sleep -Milliseconds 150
        herdr pane send-keys $paneId enter
    } else {
        # Fallback: attempt agent prompt by target name directly
        Write-Host "Attempting Herdr agent prompt to '$workerItem'..." -ForegroundColor Cyan
        herdr agent prompt $workerItem $prompt
    }

    Write-Host "Dispatched task to '$workerItem' using spec: $specPath" -ForegroundColor Green
}

if ($Wait) {
    $workersToWait = $dispatchPlan.Keys -join ","
    & "$PSScriptRoot/wait-agent.ps1" -Workers $workersToWait -TimeoutSeconds $TimeoutSeconds
}
