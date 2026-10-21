param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$TaskId,

    [Parameter(Position = 1)]
    [string]$Report,

    [ValidateSet("completed", "failed")]
    [string]$Status = "completed",

    [string]$ReturnPane,
    [string]$Worker,
    [string]$Summary = "",
    [string]$SessionId,
    [string]$WorkspaceRoot,
    [switch]$Force,
    [switch]$NoNotify
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

function Write-AtomicJsonFile([string]$TargetFilePath, [string]$JsonContent) {
    $targetDir = [System.IO.Path]::GetDirectoryName($TargetFilePath)
    $tmpFile = Join-Path $targetDir ("tmp." + [Guid]::NewGuid().ToString('N') + ".json")
    $bakFile = "$tmpFile.bak"
    [System.IO.File]::WriteAllText($tmpFile, $JsonContent, [System.Text.Encoding]::UTF8)
    try {
        if ([System.IO.File]::Exists($TargetFilePath)) {
            [System.IO.File]::Replace($tmpFile, $TargetFilePath, $bakFile, $true)
            if ([System.IO.File]::Exists($bakFile)) {
                try { [System.IO.File]::Delete($bakFile) } catch {}
            }
        } else {
            [System.IO.File]::Move($tmpFile, $TargetFilePath)
        }
    } catch {
        if ([System.IO.File]::Exists($tmpFile)) {
            try { [System.IO.File]::Delete($tmpFile) } catch {}
        }
        if ([System.IO.File]::Exists($bakFile)) {
            try { [System.IO.File]::Delete($bakFile) } catch {}
        }
        Write-Error "Atomic write failed for '$TargetFilePath': $_"
        throw
    }
}

function Invoke-WithTaskLock([string]$LockPath, [scriptblock]$Action, [int]$TimeoutMs = 5000) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $stream = $null
    while (-not $stream) {
        try {
            $stream = [System.IO.File]::Open($LockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
        } catch {
            if ($sw.ElapsedMilliseconds -ge $TimeoutMs) {
                Write-Error "Could not acquire task lock at '$LockPath' within $($TimeoutMs)ms."
                exit 1
            }
            Start-Sleep -Milliseconds 50
        }
    }
    try {
        & $Action
    } finally {
        if ($stream) {
            $stream.Close()
            $stream.Dispose()
        }
    }
}

function Set-TaskProp([PSCustomObject]$obj, [string]$name, $value) {
    if ($obj.PSObject.Properties[$name]) {
        $obj.$name = $value
    } else {
        Add-Member -InputObject $obj -NotePropertyName $name -NotePropertyValue $value -Force
    }
}

# 1. Validate TaskId syntax
if ($TaskId -notmatch '^[a-zA-Z0-9_\-]+$') {
    Write-Error "Invalid TaskId '$TaskId'. Must contain only alphanumeric characters, underscores, and hyphens."
    exit 1
}

# 2. Resolve workspace root and task file literal path
$workspaceRoot = Resolve-OrchestratorWorkspaceRoot -ExplicitRoot $WorkspaceRoot -ScriptDirectory $PSScriptRoot
$tasksDir = Join-Path $workspaceRoot ".orchestrator/tasks"
if (-not (Test-Path -LiteralPath $tasksDir)) {
    New-Item -ItemType Directory -Path $tasksDir -Force | Out-Null
}

$taskFile = Join-Path $tasksDir "$TaskId.json"
$lockFile = "$taskFile.lock"

if (-not (Test-Path -LiteralPath $taskFile -PathType Leaf)) {
    Write-Error "Task '$TaskId' not found at '$taskFile'. All tasks must be pre-registered by dispatch; automatic synthesis is disabled."
    exit 1
}

# 3. Read and parse initial task record
$task = $null
try {
    $raw = Get-Content -LiteralPath $taskFile -Raw -Encoding UTF8
    $task = $raw | ConvertFrom-Json
} catch {
    Write-Error "Failed to parse task record at '$taskFile': $_"
    exit 1
}

# 4. Verify task identity integrity
if ($task.taskId -ne $TaskId) {
    Write-Error "Task record corrupted: stored taskId '$($task.taskId)' does not match requested TaskId '$TaskId'."
    exit 1
}

# 5. Validate registered parameters against supplied arguments
if ($Worker -and $task.worker -and $Worker -ne $task.worker) {
    Write-Error "Supplied Worker '$Worker' does not match registered worker '$($task.worker)' for task '$TaskId'. Completion cannot substitute worker identity."
    exit 1
}

if ($ReturnPane -and $task.returnPane -and $ReturnPane -ne $task.returnPane) {
    Write-Error "Supplied ReturnPane '$ReturnPane' does not match registered returnPane '$($task.returnPane)' for task '$TaskId'. Completion cannot substitute the return pane."
    exit 1
}

$registeredReport = $task.reportPath
if (-not $registeredReport) {
    Write-Error "Task '$TaskId' has no registered reportPath in task record."
    exit 1
}

$resolvedRegistered = if ([System.IO.Path]::IsPathRooted($registeredReport)) {
    [System.IO.Path]::GetFullPath($registeredReport).Replace('\', '/')
} else {
    [System.IO.Path]::GetFullPath((Join-Path $workspaceRoot $registeredReport)).Replace('\', '/')
}

if ($Report) {
    $resolvedSupplied = if ([System.IO.Path]::IsPathRooted($Report)) {
        [System.IO.Path]::GetFullPath($Report).Replace('\', '/')
    } else {
        [System.IO.Path]::GetFullPath((Join-Path $workspaceRoot $Report)).Replace('\', '/')
    }
    if ($resolvedSupplied -ne $resolvedRegistered) {
        Write-Error "Supplied report '$Report' does not match registered reportPath '$registeredReport' for task '$TaskId'. Completion cannot substitute the expected artifact."
        exit 1
    }
}

# 6. Validate report artifact existence, type, freshness, and integrity
$reportHash = $null
$reportSizeBytes = 0

if ($Status -eq "completed") {
    if (-not (Test-Path -LiteralPath $resolvedRegistered -PathType Leaf)) {
        Write-Error "Report artifact '$registeredReport' does not exist or is not a regular file."
        exit 1
    }

    $reportItem = Get-Item -LiteralPath $resolvedRegistered
    $reportSizeBytes = $reportItem.Length
    if ($reportSizeBytes -eq 0) {
        Write-Error "Report artifact '$registeredReport' is empty (0 bytes)."
        exit 1
    }

    # Verify report is not stale relative to task dispatch time (strict: no tolerance)
    if (-not $task.dispatchTimeIso) {
        Write-Error "Task record '$TaskId' is missing required dispatchTimeIso."
        exit 1
    }

    $dispatchTime = [DateTime]::MinValue
    if (-not [DateTime]::TryParse($task.dispatchTimeIso, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AdjustToUniversal -bor [System.Globalization.DateTimeStyles]::AssumeUniversal, [ref]$dispatchTime)) {
        Write-Error "Task record '$TaskId' has unparseable dispatchTimeIso: '$($task.dispatchTimeIso)'."
        exit 1
    }

    if ($reportItem.LastWriteTimeUtc -lt $dispatchTime) {
        Write-Error "Report artifact '$registeredReport' timestamp ($($reportItem.LastWriteTimeUtc.ToString('o'))) is older than dispatch time ($($task.dispatchTimeIso)). Pre-existing stale files cannot complete a new task without fresh evidence."
        exit 1
    }

    # Compute SHA-256 digest
    $hashAlg = [System.Security.Cryptography.SHA256]::Create()
    $stream = [System.IO.File]::OpenRead($resolvedRegistered)
    try {
        $hashBytes = $hashAlg.ComputeHash($stream)
        $reportHash = [BitConverter]::ToString($hashBytes).Replace("-", "").ToLowerInvariant()
    } finally {
        $stream.Close()
        $hashAlg.Dispose()
    }
}

# 7. Atomic state transition and concurrency claim under lock
$shouldDeliver = $true

Invoke-WithTaskLock -LockPath $lockFile -Action {
    $currentRecord = (Get-Content -LiteralPath $taskFile -Raw -Encoding UTF8) | ConvertFrom-Json

    # Do not allow transition from failed / dispatch_failed status without explicit operator recovery
    if ($currentRecord.status -in @("failed", "dispatch_failed") -and -not $Force) {
        Write-Error "Task '$TaskId' is in status '$($currentRecord.status)' and cannot be completed implicitly. Operator must use -Force to recover."
        exit 1
    }

    if ($currentRecord.status -eq "completed") {
        if (-not $Force) {
            if ($currentRecord.deliveryStatus -in @("in_flight", "pending")) {
                Write-Error "A delivery attempt is already in flight for task '$TaskId'. Concurrent notification suppressed."
                exit 1
            }
            if ($currentRecord.deliveryStatus -eq "delivered" -or ($currentRecord.notificationCount -and [int]$currentRecord.notificationCount -gt 0)) {
                Write-Warning "Task '$TaskId' was already completed and notified at $($currentRecord.notifiedTimeIso) (hash: $($currentRecord.reportHash)). Notification suppressed (use -Force to re-notify)."
                $script:shouldDeliver = $false
                return
            }
            if ($currentRecord.deliveryStatus -eq "delivery_failed") {
                Write-Error "Task '$TaskId' completed, but prior notification delivery failed ($($currentRecord.deliveryError)). Use -Force for operator recovery."
                exit 1
            }
        }
        # When forcing, preserve original verified reportHash & size without re-hashing modified content
        $script:reportHash = $currentRecord.reportHash
        $script:reportSizeBytes = $currentRecord.reportSizeBytes
        $script:task = $currentRecord
    }

    Set-TaskProp $script:task "status" $Status
    if (-not $script:task.completedTimeIso) {
        Set-TaskProp $script:task "completedTimeIso" ([DateTime]::UtcNow.ToString("o"))
    }
    Set-TaskProp $script:task "reportHash" $script:reportHash
    Set-TaskProp $script:task "reportSizeBytes" $script:reportSizeBytes
    Set-TaskProp $script:task "deliveryStatus" "in_flight"
    Set-TaskProp $script:task "workspaceRoot" $workspaceRoot
    if ($SessionId) { Set-TaskProp $script:task "sessionId" $SessionId }

    Write-AtomicJsonFile $taskFile ($script:task | ConvertTo-Json -Depth 5)
}

if (-not $shouldDeliver) {
    exit 0
}

# 8. Deliver callback notification to parent returnPane
$targetReturnPane = if ($ReturnPane) { $ReturnPane } else { $task.returnPane }

if ($NoNotify) {
    Invoke-WithTaskLock -LockPath $lockFile -Action {
        $cur = (Get-Content -LiteralPath $taskFile -Raw -Encoding UTF8) | ConvertFrom-Json
        Set-TaskProp $cur "deliveryStatus" "unnotified"
        Write-AtomicJsonFile $taskFile ($cur | ConvertTo-Json -Depth 5)
    }
    Write-Host "Task '$TaskId' completed locally without notification (-NoNotify)." -ForegroundColor Green
    exit 0
}

if (-not $targetReturnPane) {
    Invoke-WithTaskLock -LockPath $lockFile -Action {
        $cur = (Get-Content -LiteralPath $taskFile -Raw -Encoding UTF8) | ConvertFrom-Json
        Set-TaskProp $cur "deliveryStatus" "no_return_pane"
        Write-AtomicJsonFile $taskFile ($cur | ConvertTo-Json -Depth 5)
    }
    Write-Warning "No returnPane specified in task record '$TaskId'. Completion saved without notification."
    exit 0
}

$notificationPrompt = "TERMINAL_ORCHESTRATOR_TASK_COMPLETED task=$TaskId report=$registeredReport status=$Status"
if ($reportHash) {
    $notificationPrompt += " hash=$reportHash"
}
if ($Summary) {
    $notificationPrompt += " summary=$Summary"
}

Write-Host "Delivering completion callback for '$TaskId' to pane '$targetReturnPane'..." -ForegroundColor Cyan

$dispatchScript = Join-Path $PSScriptRoot "dispatch.ps1"
& "$dispatchScript" -Worker $targetReturnPane -InstructionPrompt $notificationPrompt -WorkspaceRoot $workspaceRoot
$dispatchExit = $LASTEXITCODE

# 9. Record delivery result atomically under lock
Invoke-WithTaskLock -LockPath $lockFile -Action {
    $cur = (Get-Content -LiteralPath $taskFile -Raw -Encoding UTF8) | ConvertFrom-Json
    if ($dispatchExit -eq 0) {
        $count = if ($cur.notificationCount) { [int]$cur.notificationCount } else { 0 }
        Set-TaskProp $cur "notificationCount" ($count + 1)
        Set-TaskProp $cur "notifiedTimeIso" ([DateTime]::UtcNow.ToString("o"))
        Set-TaskProp $cur "deliveryStatus" "delivered"
        Set-TaskProp $cur "deliveryError" $null
    } else {
        Set-TaskProp $cur "deliveryStatus" "delivery_failed"
        Set-TaskProp $cur "deliveryError" "Callback delivery to '$targetReturnPane' exited with code $dispatchExit."
    }
    Write-AtomicJsonFile $taskFile ($cur | ConvertTo-Json -Depth 5)
}

if ($dispatchExit -eq 0) {
    Write-Host "Completion callback successfully delivered to '$targetReturnPane'." -ForegroundColor Green
    exit 0
} else {
    Write-Error "Failed to deliver callback to '$targetReturnPane' (exit code $dispatchExit). Task completion record is saved at '$taskFile'. Artifacts remain inspectable at '$registeredReport'. Operator may retry notification with -Force."
    exit 1
}
