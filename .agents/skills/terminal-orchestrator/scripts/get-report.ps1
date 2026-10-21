param(
    [string]$TaskId,
    [string[]]$Workers,
    [string]$SessionId,
    [string]$OutputFile,
    [string]$WorkspaceRoot,
    [int]$Limit = 3,
    [switch]$NoSync,
    # ISO-8601 UTC instant captured immediately before dispatch.
    [string]$SinceIso
)

function Resolve-OrchestratorWorkspaceRoot([string]$ExplicitRoot, [string]$ScriptDirectory) {
    if ($ExplicitRoot) {
        return [System.IO.Path]::GetFullPath($ExplicitRoot).Replace('\', '/')
    }
    $current = (Get-Item -LiteralPath ".").FullName
    $candidate = $current
    while ($candidate) {
        if ((Test-Path -LiteralPath (Join-Path $candidate ".orchestrator")) -or (Test-Path -LiteralPath (Join-Path $candidate ".git"))) {
            return $candidate.Replace('\', '/')
        }
        $parent = [System.IO.Path]::GetDirectoryName($candidate)
        if ($parent -eq $candidate -or -not $parent) { break }
        $candidate = $parent
    }
    if ($ScriptDirectory) {
        $candidate = [System.IO.Path]::GetFullPath($ScriptDirectory)
        while ($candidate) {
            if ((Test-Path -LiteralPath (Join-Path $candidate ".orchestrator")) -or (Test-Path -LiteralPath (Join-Path $candidate ".git"))) {
                return $candidate.Replace('\', '/')
            }
            $parent = [System.IO.Path]::GetDirectoryName($candidate)
            if ($parent -eq $candidate -or -not $parent) { break }
            $candidate = $parent
        }
    }
    return $current.Replace('\', '/')
}

$workspaceRoot = Resolve-OrchestratorWorkspaceRoot -ExplicitRoot $WorkspaceRoot -ScriptDirectory $PSScriptRoot

# --- Task Record Retrieval Fast-Path ---
if ($TaskId) {
    if ($TaskId -notmatch '^[a-zA-Z0-9_\-]+$') {
        Write-Error "Invalid TaskId '$TaskId'. Must contain only alphanumeric characters, underscores, and hyphens."
        exit 1
    }

    $taskFile = Join-Path $workspaceRoot ".orchestrator/tasks/$TaskId.json"
    if (-not (Test-Path -LiteralPath $taskFile -PathType Leaf)) {
        Write-Error "Task record '$TaskId' not found at '$taskFile'."
        exit 1
    }

    $task = $null
    try {
        $task = Get-Content -LiteralPath $taskFile -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        Write-Error "Failed to parse task record '$taskFile': $_"
        exit 1
    }

    if ($task.taskId -ne $TaskId) {
        Write-Error "Task record corrupted: record taskId '$($task.taskId)' does not match requested TaskId '$TaskId'."
        exit 1
    }

    if ($task.status -ne "completed") {
        Write-Error "Task '$TaskId' is not completed (current status: '$($task.status)'). Refusing to emit report before verified completion."
        exit 2
    }

    # Reject completed records missing required integrity or completion metadata
    if (-not $task.reportHash -or -not $task.reportSizeBytes -or -not $task.completedTimeIso) {
        Write-Error "Task record '$TaskId' is missing required completion or integrity metadata (reportHash, reportSizeBytes, completedTimeIso). Refusing unverified report."
        exit 2
    }

    $effectiveReport = $task.reportPath
    if (-not $effectiveReport) {
        Write-Error "Task '$TaskId' has no registered reportPath."
        exit 1
    }

    $effectiveWorkspace = if ($task.workspaceRoot) { $task.workspaceRoot } else { $workspaceRoot }
    $resolvedReport = if ([System.IO.Path]::IsPathRooted($effectiveReport)) {
        [System.IO.Path]::GetFullPath($effectiveReport).Replace('\', '/')
    } else {
        [System.IO.Path]::GetFullPath((Join-Path $effectiveWorkspace $effectiveReport)).Replace('\', '/')
    }

    if (-not (Test-Path -LiteralPath $resolvedReport -PathType Leaf)) {
        Write-Error "Report artifact for task '$TaskId' missing or not a regular file: '$effectiveReport'"
        exit 1
    }

    $reportItem = Get-Item -LiteralPath $resolvedReport
    if ($reportItem.Length -eq 0) {
        Write-Error "Report artifact for task '$TaskId' is empty (0 bytes): '$effectiveReport'"
        exit 1
    }

    $hashAlg = [System.Security.Cryptography.SHA256]::Create()
    $stream = [System.IO.File]::OpenRead($resolvedReport)
    try {
        $hashBytes = $hashAlg.ComputeHash($stream)
        $actualHash = [BitConverter]::ToString($hashBytes).Replace("-", "").ToLowerInvariant()
        if ($actualHash -ne $task.reportHash) {
            Write-Error "Report artifact integrity check failed for task '$TaskId'. Current hash ($actualHash) does not match completed record hash ($($task.reportHash)). Report content has been modified or substituted."
            exit 2
        }
    } finally {
        $stream.Close()
        $hashAlg.Dispose()
    }

    $reportContent = Get-Content -LiteralPath $resolvedReport -Raw -Encoding UTF8
    $outputLines = @(
        "# Terminal Orchestrator Task Report: $TaskId",
        "Completed at: $($task.completedTimeIso) | Worker: $($task.worker) (Pane: $($task.workerPane))",
        "Report Artifact: $effectiveReport (SHA256: $($task.reportHash))",
        "",
        $reportContent
    )
    $combinedText = $outputLines -join [Environment]::NewLine
    Write-Output $combinedText

    if ($OutputFile) {
        $parentDir = Split-Path -Parent $OutputFile
        if ($parentDir -and -not (Test-Path -LiteralPath $parentDir)) {
            New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
        }
        Set-Content -LiteralPath $OutputFile -Value $combinedText -Encoding UTF8
        Write-Host ""
        Write-Host "Report saved to: $OutputFile" -ForegroundColor Cyan
    }

    exit 0
}

# --- External Process Bounding & Resilience Helper ---
function Invoke-ExternalCommandWithTimeout {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [AllowEmptyString()][string]$ArgumentList = "",
        [int]$TimeoutMs = 8000,
        [int]$DrainTimeoutMs = 2500,
        [string]$Description = "Command"
    )
    $resolvedPath = $null
    try {
        $cmd = Get-Command $FilePath -ErrorAction SilentlyContinue
        if ($cmd -and $cmd.Path) { $resolvedPath = $cmd.Path }
        elseif ($cmd -and $cmd.Source) { $resolvedPath = $cmd.Source }
    } catch {}

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    if ($resolvedPath -and ($resolvedPath -like "*.bat" -or $resolvedPath -like "*.cmd")) {
        $psi.FileName = "cmd.exe"
        $psi.Arguments = "/c `"$resolvedPath`" $ArgumentList"
    } else {
        $psi.FileName = if ($resolvedPath) { $resolvedPath } else { $FilePath }
        $psi.Arguments = $ArgumentList
    }
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    try {
        [void]$proc.Start()
    } catch {
        return [PSCustomObject]@{
            ExitCode = -1
            StdOut   = ""
            StdErr   = "Failed to start $FilePath : $_"
            TimedOut = $false
        }
    }

    $outTask = $proc.StandardOutput.ReadToEndAsync()
    $errTask = $proc.StandardError.ReadToEndAsync()

    $timedOut = $false
    if (-not $proc.WaitForExit($TimeoutMs)) {
        $timedOut = $true
        try {
            $killProc = Start-Process taskkill -ArgumentList "/PID $($proc.Id) /T /F" -WindowStyle Hidden -PassThru
            $null = $killProc.WaitForExit(3000)
        } catch {
            try { $proc.Kill() } catch {}
        }
    }

    # Bounded stream drain to prevent blocking on inherited child handles
    $stdOut = ""
    $stdErr = ""
    $drainTimedOut = $false
    if ([System.Threading.Tasks.Task]::WaitAll(@($outTask, $errTask), $DrainTimeoutMs)) {
        $stdOut = $outTask.Result
        $stdErr = $errTask.Result
    } else {
        $drainTimedOut = $true
        if ($timedOut) {
            $stdErr = "$Description timed out after $($TimeoutMs)ms (inherited pipe unclosed after kill)"
        } else {
            $stdErr = "$Description stream drain timed out after $($DrainTimeoutMs)ms (child holds inherited pipe)"
        }
    }

    $exitCode = if ($timedOut) { -2 } elseif ($drainTimedOut) { -3 } else { try { $proc.ExitCode } catch { 0 } }

    try { $proc.Close() } catch {}
    try { $proc.Dispose() } catch {}

    return [PSCustomObject]@{
        ExitCode = $exitCode
        StdOut   = $stdOut
        StdErr   = $stdErr
        TimedOut = ($timedOut -or $drainTimedOut)
    }
}

function Invoke-AgentsViewCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Arguments,
        [int]$TimeoutMs = 8000,
        [string]$Description = "agentsview"
    )
    return Invoke-ExternalCommandWithTimeout -FilePath "agentsview" -ArgumentList $Arguments -TimeoutMs $TimeoutMs -Description $Description
}

function Invoke-HerdrCommand([string]$Arguments, [int]$TimeoutMs = 4000) {
    return Invoke-ExternalCommandWithTimeout -FilePath "herdr" -ArgumentList $Arguments -TimeoutMs $TimeoutMs -Description "herdr $Arguments"
}

function Invoke-AgentsViewSync([switch]$SkipSync, [int]$TimeoutMs = 8000) {
    if ($SkipSync) { return }
    $res = Invoke-AgentsViewCommand -Arguments "sync" -TimeoutMs $TimeoutMs -Description "agentsview sync"
    if ($res.TimedOut) {
        Write-Warning "agentsview sync timed out after $($TimeoutMs)ms. Continuing without fresh sync."
    } elseif ($res.ExitCode -ne 0) {
        Write-Warning "agentsview sync exited $($res.ExitCode): $($res.StdErr)"
    }
}

function ConvertTo-AgentsViewProvider([string]$agentKind) {
    if (-not $agentKind) { return "" }
    switch -Regex ($agentKind.ToLowerInvariant()) {
        "^(agy|antigravity.*)$" { return "antigravity-cli" }
        "^opencode.*$"         { return "opencode" }
        "^kilo.*$"             { return "kilo" }
        "^cline.*$"            { return "cline" }
        "^codex.*$"            { return "codex" }
        "^claude.*$"           { return "claude" }
        default                { return $agentKind }
    }
}

# 0. Bounded fast incremental sync
Invoke-AgentsViewSync -SkipSync:$NoSync

# 1. Normalize worker list
$workerList = @()
if ($Workers) {
    foreach ($w in $Workers) {
        if ($w.Contains(",")) {
            $workerList += ($w -split "," | ForEach-Object { $_.Trim() })
        } else {
            $workerList += $w.Trim()
        }
    }
}
$workerList = $workerList | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique

if ($workerList.Count -eq 0 -and -not $SessionId) {
    Write-Error "Please specify at least one worker (-Workers 'kilo-scout,codex') or a -SessionId."
    exit 1
}

$reports = @()

# Pre-fetch Herdr inventory only when SessionId is not already pinned
$herdrAgents = @()
$herdrPanes = @()
if (-not $SessionId) {
    $agentRes = Invoke-HerdrCommand "agent list"
    if ($agentRes.ExitCode -eq 0 -and $agentRes.StdOut) {
        try { $herdrAgents = @(($agentRes.StdOut | ConvertFrom-Json).result.agents) } catch {}
    }
    $paneRes = Invoke-HerdrCommand "pane list"
    if ($paneRes.ExitCode -eq 0 -and $paneRes.StdOut) {
        try { $herdrPanes = @(($paneRes.StdOut | ConvertFrom-Json).result.panes) } catch {}
    }
}

function Get-SingleReport {
    param(
        [string]$TargetWorker,
        [string]$TargetSessionId
    )

    # 1. Explicit SessionId path: query exactly this session, no silent fallbacks
    if ($TargetSessionId) {
        $attempts = if ($SinceIso) { 4 } else { 1 }
        $reportText = $null
        $fetchError = $null

        for ($attempt = 1; $attempt -le $attempts -and -not $reportText; $attempt++) {
            if ($attempt -gt 1) {
                Start-Sleep -Milliseconds 1200
                Invoke-AgentsViewSync -SkipSync:$NoSync
            }
            $fetchLimit = [Math]::Max($Limit, 10)
            $cmdRes = Invoke-AgentsViewCommand -Arguments "session messages $TargetSessionId --role assistant --direction desc --limit $fetchLimit --json" -TimeoutMs 6000
            if ($cmdRes.ExitCode -ne 0) {
                $fetchError = if ($cmdRes.StdErr) { $cmdRes.StdErr.Trim() } else { "agentsview session messages exited $($cmdRes.ExitCode)" }
                continue
            }
            if ($cmdRes.StdOut) {
                try {
                    $parsed = $cmdRes.StdOut | ConvertFrom-Json
                    $msgs = @()
                    if ($parsed.messages) { $msgs = @($parsed.messages) }
                    elseif ($parsed -is [System.Array]) { $msgs = @($parsed) }

                    $msgs = @($msgs | Where-Object {
                        $_.role -eq "assistant" -and -not [string]::IsNullOrWhiteSpace($_.content)
                    })

                    if ($SinceIso -and $msgs.Count -gt 0) {
                        $since = [DateTime]::Parse($SinceIso, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AdjustToUniversal -bor [System.Globalization.DateTimeStyles]::AssumeUniversal)
                        $msgs = @($msgs | Where-Object {
                            $ts = [DateTime]::MinValue
                            if ($_.timestamp -and [DateTime]::TryParse($_.timestamp, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AdjustToUniversal -bor [System.Globalization.DateTimeStyles]::AssumeUniversal, [ref]$ts)) {
                                $ts -ge $since
                            } else { $false }
                        })
                    }

                    if ($msgs.Count -gt 0) {
                        $ordered = @($msgs | Sort-Object {
                            $ts = [DateTime]::MinValue
                            [void][DateTime]::TryParse($_.timestamp, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AdjustToUniversal -bor [System.Globalization.DateTimeStyles]::AssumeUniversal, [ref]$ts)
                            $ts
                        })
                        if ($SinceIso) {
                            $reportText = ($ordered | Select-Object -Last 1).content
                        } else {
                            $reportText = ((@($ordered | Select-Object -Last ([Math]::Min($Limit, $ordered.Count))) | ForEach-Object { $_.content }) -join ([Environment]::NewLine + [Environment]::NewLine))
                        }
                    }
                } catch {
                    $fetchError = "Failed to parse session messages JSON: $_"
                }
            }
        }

        if ($reportText) {
            return [PSCustomObject]@{
                Worker    = $TargetWorker
                SessionId = $TargetSessionId
                Source    = "AgentsView Heuristic Transcript Evidence"
                Report    = $reportText
                IsError   = $false
                ErrorKind = $null
            }
        }

        if ($fetchError) {
            return [PSCustomObject]@{
                Worker    = $TargetWorker
                SessionId = $TargetSessionId
                Source    = "None"
                Report    = "Retrieval error for session '$TargetSessionId': $fetchError"
                IsError   = $true
                ErrorKind = "RETRIEVAL_ERROR"
            }
        }

        return [PSCustomObject]@{
            Worker    = $TargetWorker
            SessionId = $TargetSessionId
            Source    = "AgentsView Heuristic Transcript Evidence"
            Report    = if ($SinceIso) { "(no new assistant turns since dispatch: $SinceIso)" } else { "(no assistant messages found in session)" }
            IsError   = $true
            ErrorKind = "NO_NEW_TRANSCRIPT"
        }
    }

    # 2. Worker resolution: require verified main session correspondence
    # Reject live child subagent sessions even if they share cwd
    $resolvedSessionId = $null

    $matchedAgent = $herdrAgents | Where-Object {
        ($_.name -eq $TargetWorker -or $_.agent -eq $TargetWorker -or $_.pane_id -eq $TargetWorker)
    } | Select-Object -First 1

    if ($matchedAgent -and $matchedAgent.agent_session -and $matchedAgent.agent_session.value) {
        $val = $matchedAgent.agent_session.value
        $kind = if ($matchedAgent.agent_session.agent) { $matchedAgent.agent_session.agent } else { $matchedAgent.agent }
        $candidateId = if ($val -like "*:*") {
            $parts = $val -split ":", 2
            "$(ConvertTo-AgentsViewProvider $parts[0]):$($parts[1])"
        } else {
            "$(ConvertTo-AgentsViewProvider $kind):${val}"
        }

        # Verify candidate session in AgentsView: must match workspace and positively verify main correspondence
        # Calls real installed AgentsView CLI: 'session get <id> --json'
        $checkRes = Invoke-AgentsViewCommand -Arguments "session get $candidateId --json" -TimeoutMs 5000
        if ($checkRes.ExitCode -eq 0 -and $checkRes.StdOut) {
            try {
                $overview = $checkRes.StdOut | ConvertFrom-Json
                $isMatchingCwd = $overview.cwd -and ($overview.cwd.Replace('\', '/').TrimEnd('/') -eq $workspaceRoot.TrimEnd('/'))
                $isChildSession = [bool]($overview.parent_session_id -or $overview.parent_session -or ($overview.relationship_type -and $overview.relationship_type -ne "main") -or ($overview.session_kind -and $overview.session_kind -eq "subagent"))
                # Absence of parent_session_id is not proof that a session is main.
                # If main-session correspondence cannot be positively established, fail closed.
                $isPositiveMain = ($overview.relationship_type -eq "main") -or ($overview.session_kind -eq "main")
                if ($isMatchingCwd -and -not $isChildSession -and $isPositiveMain) {
                    $resolvedSessionId = $candidateId
                }
            } catch {}
        }
    }

    if (-not $resolvedSessionId) {
        return [PSCustomObject]@{
            Worker    = $TargetWorker
            SessionId = "unresolved"
            Source    = "None"
            Report    = "Could not establish verified main-session correspondence for worker '$TargetWorker' in workspace '$workspaceRoot' (session may be nested subagent or unverified). Specify explicit -SessionId or -TaskId."
            IsError   = $true
            ErrorKind = "SESSION_CORRESPONDENCE_UNVERIFIED"
        }
    }

    return Get-SingleReport -TargetWorker $TargetWorker -TargetSessionId $resolvedSessionId
}

if ($SessionId) {
    $single = Get-SingleReport -TargetWorker "custom" -TargetSessionId $SessionId
    if ($single) { $reports += $single }
} else {
    foreach ($w in $workerList) {
        $single = Get-SingleReport -TargetWorker $w
        if ($single) { $reports += $single }
    }
}

$outputLines = @()
$outputLines += "# Terminal Orchestrator Multi-Report"
$outputLines += "Generated at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') via Herdr"
$outputLines += ""

$hasFailure = $false
foreach ($r in $reports) {
    if ($r.IsError) {
        $hasFailure = $true
        Write-Warning "'$($r.Worker)': $($r.ErrorKind) - $($r.Report)"
        $outputLines += "TERMINAL_ORCHESTRATOR_$($r.ErrorKind): $($r.Worker)"
    }
    $outputLines += "## Worker: $($r.Worker) (Session: $($r.SessionId) | Source: $($r.Source))"
    $outputLines += '```text'
    $outputLines += $r.Report
    $outputLines += '```'
    $outputLines += ""
}

$combinedText = $outputLines -join [Environment]::NewLine
Write-Output $combinedText

if ($OutputFile) {
    $parentDir = Split-Path -Parent $OutputFile
    if ($parentDir -and -not (Test-Path -LiteralPath $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }
    Set-Content -LiteralPath $OutputFile -Value $combinedText -Encoding UTF8
    Write-Host ""
    Write-Host "Report saved to: $OutputFile" -ForegroundColor Cyan
}

if ($hasFailure -or $reports.Count -eq 0) {
    exit 2
}
exit 0
