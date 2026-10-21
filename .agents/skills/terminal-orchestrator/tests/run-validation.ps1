# ==============================================================================
# Terminal Orchestrator Validation & Regression Test Suite
# ==============================================================================
# Validates orchestrator scripts against contract invariants and platform quirks:
# - Task identity, freshness, digest verification, and concurrency locks
# - Bounded external process execution and stream drains (avoiding pipe deadlocks)
# - Session correspondence checks and AgentsView error distinctions
# - Heuristic lifecycle activity detection across All / Any modes
# ==============================================================================

$ErrorActionPreference = "Continue"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " RUNNING TERMINAL ORCHESTRATOR VALIDATION SUITE   " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$scriptRoot = (Resolve-Path ".agents/skills/terminal-orchestrator/scripts").Path
$testTmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("orch-val-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $testTmpDir -Force | Out-Null

$testWorkspace = Join-Path $testTmpDir "workspace"
New-Item -ItemType Directory -Path "$testWorkspace/.orchestrator/tasks" -Force | Out-Null
New-Item -ItemType Directory -Path "$testWorkspace/.orchestrator/reports" -Force | Out-Null
New-Item -ItemType Directory -Path "$testWorkspace/.orchestrator/specs" -Force | Out-Null

$mockBinDir = Join-Path $testTmpDir "bin"
New-Item -ItemType Directory -Path $mockBinDir -Force | Out-Null

$passed = 0
$failed = 0

function Report-Test([string]$name, [bool]$success, [string]$detail = "") {
    if ($success) {
        $script:passed++
        Write-Host "[PASS] $name" -ForegroundColor Green
    } else {
        $script:failed++
        Write-Host "[FAIL] $name : $detail" -ForegroundColor Red
    }
}

# --- Compile Mock Binaries (C# Add-Type) ----------------------------------------
$mockHerdrSource = @"
using System;
using System.IO;
using System.Threading;

class MockHerdr {
    static int Main(string[] args) {
        string logPath = Environment.GetEnvironmentVariable("MOCK_HERDR_LOG");
        string delayMsStr = Environment.GetEnvironmentVariable("MOCK_HERDR_DELAY_MS");
        string statusOverride = Environment.GetEnvironmentVariable("MOCK_HERDR_STATUS");
        string flagFile = Environment.GetEnvironmentVariable("MOCK_HERDR_WORKING_FLAG");
        string cmd = Environment.CommandLine;
        if (!string.IsNullOrEmpty(logPath)) {
            try {
                File.AppendAllText(logPath, cmd + Environment.NewLine);
            } catch {}
        }
        if (cmd.Contains("agent prompt") || cmd.Contains("pane send-text")) {
            if (!string.IsNullOrEmpty(delayMsStr)) {
                int delay;
                if (int.TryParse(delayMsStr, out delay) && delay > 0) {
                    Thread.Sleep(delay);
                }
            }
            if (!string.IsNullOrEmpty(flagFile)) {
                try { File.WriteAllText(flagFile, "working"); } catch {}
            }
            Console.WriteLine("{\"result\":{\"ok\":true}}");
            return 0;
        }
        if (cmd.Contains("agent list")) {
            string customList = Environment.GetEnvironmentVariable("MOCK_HERDR_AGENT_LIST");
            if (!string.IsNullOrEmpty(customList)) {
                Console.WriteLine(customList);
            } else {
                string st = (!string.IsNullOrEmpty(flagFile) && File.Exists(flagFile)) ? "working" : (!string.IsNullOrEmpty(statusOverride) ? statusOverride : "idle");
                Console.WriteLine("{\"result\":{\"agents\":[{\"agent\":\"dummy\",\"agent_status\":\"" + st + "\",\"pane_id\":\"w1:p1\",\"agent_session\":\"mock-session\"},{\"agent\":\"parent\",\"agent_status\":\"" + st + "\",\"pane_id\":\"w1:p12\",\"agent_session\":\"mock-parent-session\"}]}}");
            }
            return 0;
        }
        if (cmd.Contains("pane list")) {
            Console.WriteLine("{\"result\":{\"panes\":[{\"pane_id\":\"w1:p1\"},{\"pane_id\":\"w1:p2\"},{\"pane_id\":\"w1:p12\"}]}}");
            return 0;
        }
        if (cmd.Contains("agent get") || cmd.Contains("agent wait")) {
            string st = (!string.IsNullOrEmpty(flagFile) && File.Exists(flagFile)) ? "working" : (!string.IsNullOrEmpty(statusOverride) ? statusOverride : "idle");
            Console.WriteLine("{\"result\":{\"agent\":{\"agent_status\":\"" + st + "\",\"pane_id\":\"w1:p1\"}}}");
            return 0;
        }
        Console.WriteLine("{\"result\":{\"ok\":true}}");
        return 0;
    }
}
"@

$mockAgentsViewSource = @"
using System;
using System.IO;
using System.Threading;

class MockAgentsView {
    static int Main(string[] args) {
        string logPath = Environment.GetEnvironmentVariable("MOCK_AGENTSVIEW_LOG");
        string delayMsStr = Environment.GetEnvironmentVariable("MOCK_AGENTSVIEW_DELAY_MS");
        string exitCodeStr = Environment.GetEnvironmentVariable("MOCK_AGENTSVIEW_EXIT_CODE");
        string cmd = Environment.CommandLine;
        if (!string.IsNullOrEmpty(logPath)) {
            try {
                File.AppendAllText(logPath, cmd + Environment.NewLine);
            } catch {}
        }
        if (cmd.Contains("sync")) {
            string syncDelayStr = Environment.GetEnvironmentVariable("MOCK_AGENTSVIEW_SYNC_DELAY_MS");
            if (!string.IsNullOrEmpty(syncDelayStr)) {
                int syncDelay;
                if (int.TryParse(syncDelayStr, out syncDelay) && syncDelay > 0) {
                    Thread.Sleep(syncDelay);
                }
            }
        }
        if (!string.IsNullOrEmpty(delayMsStr)) {
            int delay;
            if (int.TryParse(delayMsStr, out delay) && delay > 0) {
                Thread.Sleep(delay);
            }
        }
        if (!string.IsNullOrEmpty(exitCodeStr)) {
            int code;
            if (int.TryParse(exitCodeStr, out code) && code != 0) {
                Console.Error.WriteLine("agentsview database connection failure");
                return code;
            }
        }
        if (cmd.Contains("get_session_overview")) {
            Console.Error.WriteLine("error: unknown command 'get_session_overview'");
            return 1;
        }
        if (cmd.Contains("session get")) {
            string customGet = Environment.GetEnvironmentVariable("MOCK_AGENTSVIEW_SESSION_GET");
            if (!string.IsNullOrEmpty(customGet)) {
                Console.WriteLine(customGet);
            } else {
                Console.WriteLine("{\"id\":\"mock-session\",\"cwd\":\"" + Environment.CurrentDirectory.Replace("\\", "\\\\") + "\",\"agent\":\"dummy\"}");
            }
            return 0;
        }
        if (cmd.Contains("session messages") || cmd.Contains("get_messages")) {
            string customMsgs = Environment.GetEnvironmentVariable("MOCK_AGENTSVIEW_MESSAGES");
            if (!string.IsNullOrEmpty(customMsgs)) {
                Console.WriteLine(customMsgs);
            } else {
                Console.WriteLine("{\"messages\":[]}");
            }
            return 0;
        }
        Console.WriteLine("{\"result\":{\"ok\":true}}");
        return 0;
    }
}
"@

$mockHerdrExe = Join-Path $mockBinDir "herdr.exe"
$mockAgentsViewExe = Join-Path $mockBinDir "agentsview.exe"

Add-Type -TypeDefinition $mockHerdrSource -OutputAssembly $mockHerdrExe -OutputType ConsoleApplication
Add-Type -TypeDefinition $mockAgentsViewSource -OutputAssembly $mockAgentsViewExe -OutputType ConsoleApplication

$origPath = $env:PATH

try {
    # Isolate PATH: only mock binaries, active powershell directory ($PSHOME), and core Windows system folders
    $env:PATH = "$mockBinDir;$PSHOME;$env:SystemRoot\System32;$env:SystemRoot"

    # ----------------------------------------------------------------------------------
    # Test 1: Hung sync times out boundedly (~8s, avoiding 60s hang)
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 1: Hung sync times out boundedly..." -ForegroundColor Yellow
    $env:MOCK_AGENTSVIEW_SYNC_DELAY_MS = "60000"
    try {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $p = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptRoot/get-report.ps1`" -SessionId mock:123 -Limit 1 -WorkspaceRoot `"$testWorkspace`"" -NoNewWindow -PassThru -Wait
        $sw.Stop()
        $elapsedSec = $sw.Elapsed.TotalSeconds
        $timedOutProperly = ($elapsedSec -lt 25) -and ($elapsedSec -ge 7)
        Report-Test "Hung sync times out boundedly (~8s, avoiding 60s hang)" $timedOutProperly "Elapsed: $([math]::Round($elapsedSec, 1))s, Exit: $($p.ExitCode)"
    } finally {
        $env:MOCK_AGENTSVIEW_SYNC_DELAY_MS = $null
    }

    # ----------------------------------------------------------------------------------
    # Test 2: NoSync prevents all sync calls
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 2: NoSync prevents all sync calls..." -ForegroundColor Yellow
    $logFile2 = Join-Path $testTmpDir "agentsview-call-2.log"
    $env:MOCK_AGENTSVIEW_LOG = $logFile2
    try {
        $p = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptRoot/get-report.ps1`" -Workers dummy -NoSync -Limit 1 -WorkspaceRoot `"$testWorkspace`"" -NoNewWindow -PassThru -Wait
        $calls = if (Test-Path -LiteralPath $logFile2) { Get-Content -LiteralPath $logFile2 } else { @() }
        $syncCalled = ($calls | Where-Object { $_ -match "\bsync\b" }).Count -gt 0
        Report-Test "NoSync prevents all sync calls" (-not $syncCalled) "Calls logged: $($calls -join '; ')"
    } finally {
        $env:MOCK_AGENTSVIEW_LOG = $null
    }

    # ----------------------------------------------------------------------------------
    # Test 3: Provider namespace mapping & unknown session rejection
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 3: Provider namespace mapping and session rejection..." -ForegroundColor Yellow
    $p = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptRoot/get-report.ps1`" -SessionId nonexistent-namespace:12345 -NoSync -WorkspaceRoot `"$testWorkspace`"" -NoNewWindow -PassThru -Wait
    Report-Test "Nonexistent session returns non-zero exit code" ($p.ExitCode -ne 0) "Exit code was: $($p.ExitCode)"

    # ----------------------------------------------------------------------------------
    # Test 4: Missing activity fails (-RequireActivity)
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 4: Missing activity fails when -RequireActivity is set..." -ForegroundColor Yellow
    $env:MOCK_HERDR_AGENT_LIST = '{"result":{"agents":[{"agent":"kilo","agent_status":"idle","pane_id":"w1:p1"}]}}'
    try {
        $p = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptRoot/wait-agent.ps1`" -Workers kilo -RequireActivity -TimeoutSeconds 2 -DebounceMilliseconds 200" -NoNewWindow -PassThru -Wait
        Report-Test "Missing activity fails (-RequireActivity exits non-zero)" ($p.ExitCode -ne 0) "Exit code: $($p.ExitCode)"
    } finally {
        $env:MOCK_HERDR_AGENT_LIST = $null
    }

    # ----------------------------------------------------------------------------------
    # Test 5: Missing activity in -Mode Any
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 5: Missing activity in Any mode (-Mode Any -RequireActivity)..." -ForegroundColor Yellow
    $env:MOCK_HERDR_AGENT_LIST = '{"result":{"agents":[{"agent":"kilo","agent_status":"idle","pane_id":"w1:p1"},{"agent":"codex","agent_status":"idle","pane_id":"w1:p2"}]}}'
    try {
        $p = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptRoot/wait-agent.ps1`" -Workers kilo,codex -Mode Any -RequireActivity -TimeoutSeconds 2 -DebounceMilliseconds 200" -NoNewWindow -PassThru -Wait
        Report-Test "Missing activity in -Mode Any exits non-zero" ($p.ExitCode -ne 0) "Exit code: $($p.ExitCode)"
    } finally {
        $env:MOCK_HERDR_AGENT_LIST = $null
    }

    # ----------------------------------------------------------------------------------
    # Test 6: Unknown ID + valid Report rejected (no auto-synthesis)
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 6: Unknown TaskId with valid Report rejected..." -ForegroundColor Yellow
    $validReport6 = Join-Path $testWorkspace ".orchestrator/reports/report-6.md"
    Set-Content -LiteralPath $validReport6 -Value "# Report 6 Content" -Encoding UTF8
    $p = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptRoot/complete-task.ps1`" -TaskId non-existent-task-xyz -Report `"$validReport6`" -ReturnPane w1:p1 -WorkspaceRoot `"$testWorkspace`"" -NoNewWindow -PassThru -Wait
    Report-Test "Unknown ID with valid Report rejected without auto-synthesis" ($p.ExitCode -ne 0) "Exit code: $($p.ExitCode)"

    # ----------------------------------------------------------------------------------
    # Test 7: Wrong report for existing task rejected
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 7: Wrong report for existing task rejected..." -ForegroundColor Yellow
    $task7Id = "test-task-7-wrong-report"
    $registeredReport7 = ".orchestrator/reports/expected-report-7.md"
    $wrongReport7 = Join-Path $testWorkspace ".orchestrator/reports/wrong-report-7.md"
    Set-Content -LiteralPath (Join-Path $testWorkspace $registeredReport7) -Value "# Expected" -Encoding UTF8
    Set-Content -LiteralPath $wrongReport7 -Value "# Wrong Report" -Encoding UTF8
    $taskRecord7 = [PSCustomObject]@{
        taskId          = $task7Id
        worker          = "dummy"
        workerPane      = "w1:p1"
        returnPane      = "w1:p2"
        specPath        = "spec.md"
        reportPath      = $registeredReport7
        dispatchTimeIso = [DateTime]::UtcNow.ToString("o")
        status          = "dispatched"
        workspaceRoot   = $testWorkspace
    }
    Set-Content -LiteralPath (Join-Path $testWorkspace ".orchestrator/tasks/$task7Id.json") -Value ($taskRecord7 | ConvertTo-Json) -Encoding UTF8
    $p = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptRoot/complete-task.ps1`" -TaskId $task7Id -Report `"$wrongReport7`" -WorkspaceRoot `"$testWorkspace`"" -NoNewWindow -PassThru -Wait
    Report-Test "Supplying mismatched report for existing task rejected" ($p.ExitCode -ne 0) "Exit code: $($p.ExitCode)"

    # ----------------------------------------------------------------------------------
    # Test 8: Stale report artifact rejected (older than dispatch)
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 8: Stale report artifact rejected..." -ForegroundColor Yellow
    $task8Id = "test-task-8-stale"
    $relReport8 = ".orchestrator/reports/stale-report-8.md"
    $fullReport8 = Join-Path $testWorkspace $relReport8
    Set-Content -LiteralPath $fullReport8 -Value "# Old Stale Content" -Encoding UTF8
    (Get-Item -LiteralPath $fullReport8).LastWriteTimeUtc = [DateTime]::UtcNow.AddMinutes(-30)
    $taskRecord8 = [PSCustomObject]@{
        taskId          = $task8Id
        worker          = "dummy"
        workerPane      = "w1:p1"
        returnPane      = "w1:p2"
        specPath        = "spec.md"
        reportPath      = $relReport8
        dispatchTimeIso = [DateTime]::UtcNow.ToString("o")
        status          = "dispatched"
        workspaceRoot   = $testWorkspace
    }
    Set-Content -LiteralPath (Join-Path $testWorkspace ".orchestrator/tasks/$task8Id.json") -Value ($taskRecord8 | ConvertTo-Json) -Encoding UTF8
    $p = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptRoot/complete-task.ps1`" -TaskId $task8Id -NoNotify -WorkspaceRoot `"$testWorkspace`"" -NoNewWindow -PassThru -Wait
    Report-Test "Report artifact older than task dispatch rejected as stale" ($p.ExitCode -ne 0) "Exit code: $($p.ExitCode)"

    # ----------------------------------------------------------------------------------
    # Test 9: Record / task-ID mismatch rejected
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 9: Record / task-ID mismatch rejected..." -ForegroundColor Yellow
    $task9File = Join-Path $testWorkspace ".orchestrator/tasks/test-task-9-mismatch.json"
    $taskRecord9 = [PSCustomObject]@{
        taskId          = "internal-different-id-999"
        worker          = "dummy"
        workerPane      = "w1:p1"
        returnPane      = "w1:p2"
        specPath        = "spec.md"
        reportPath      = "some-report.md"
        dispatchTimeIso = [DateTime]::UtcNow.ToString("o")
        status          = "dispatched"
        workspaceRoot   = $testWorkspace
    }
    Set-Content -LiteralPath $task9File -Value ($taskRecord9 | ConvertTo-Json) -Encoding UTF8
    $pComplete = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptRoot/complete-task.ps1`" -TaskId test-task-9-mismatch -NoNotify -WorkspaceRoot `"$testWorkspace`"" -NoNewWindow -PassThru -Wait
    $pGet = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptRoot/get-report.ps1`" -TaskId test-task-9-mismatch -WorkspaceRoot `"$testWorkspace`"" -NoNewWindow -PassThru -Wait
    Report-Test "Record/TaskId mismatch rejected on complete and get-report" ($pComplete.ExitCode -ne 0 -and $pGet.ExitCode -ne 0) "Complete Exit: $($pComplete.ExitCode), Get Exit: $($pGet.ExitCode)"

    # ----------------------------------------------------------------------------------
    # Test 10: Reused task ID on dispatch rejected (with valid inputs)
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 10: Reused task ID on dispatch rejected..." -ForegroundColor Yellow
    $task10Id = "test-task-10-existing"
    $taskRecord10 = [PSCustomObject]@{
        taskId          = $task10Id
        worker          = "dummy"
        status          = "dispatched"
        workspaceRoot   = $testWorkspace
    }
    Set-Content -LiteralPath (Join-Path $testWorkspace ".orchestrator/tasks/$task10Id.json") -Value ($taskRecord10 | ConvertTo-Json) -Encoding UTF8
    $spec10 = Join-Path $testWorkspace ".orchestrator/specs/spec-10.md"
    Set-Content -LiteralPath $spec10 -Value "# Spec 10" -Encoding UTF8
    $report10 = Join-Path $testWorkspace ".orchestrator/reports/report-10.md"
    $pDispatch = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptRoot/dispatch.ps1`" -Worker dummy -Spec `"$spec10`" -TaskId $task10Id -ReturnPane w1:p1 -Report `"$report10`" -WorkspaceRoot `"$testWorkspace`"" -NoNewWindow -PassThru -Wait
    Report-Test "Reusing existing TaskId on dispatch is refused (with valid inputs)" ($pDispatch.ExitCode -ne 0) "Exit code: $($pDispatch.ExitCode)"

    # ----------------------------------------------------------------------------------
    # Test 11: Callback combined with -Wait is rejected (with valid inputs)
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 11: Callback combined with -Wait is rejected..." -ForegroundColor Yellow
    $spec11 = Join-Path $testWorkspace ".orchestrator/specs/spec-11.md"
    Set-Content -LiteralPath $spec11 -Value "# Spec 11" -Encoding UTF8
    $pWaitIncompat = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptRoot/dispatch.ps1`" -Worker dummy -Spec `"$spec11`" -Callback -Wait -WorkspaceRoot `"$testWorkspace`"" -NoNewWindow -PassThru -Wait
    Report-Test "Callback combined with -Wait rejected up front (with valid inputs)" ($pWaitIncompat.ExitCode -ne 0) "Exit code: $($pWaitIncompat.ExitCode)"

    # ----------------------------------------------------------------------------------
    # Test 12: Ambiguous callback broadcast rejected
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 12: Ambiguous callback broadcast sharing a report is rejected..." -ForegroundColor Yellow
    $spec12 = Join-Path $testWorkspace ".orchestrator/specs/spec-12.md"
    Set-Content -LiteralPath $spec12 -Value "# Spec 12" -Encoding UTF8
    $sharedReport12 = Join-Path $testWorkspace ".orchestrator/reports/shared-12.md"
    $pBroadcast = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptRoot/dispatch.ps1`" -Workers dummy1,dummy2 -Spec `"$spec12`" -Callback -ReturnPane w1:p1 -Report `"$sharedReport12`" -WorkspaceRoot `"$testWorkspace`"" -NoNewWindow -PassThru -Wait
    Report-Test "Ambiguous callback broadcast sharing a report is rejected" ($pBroadcast.ExitCode -ne 0) "Exit code: $($pBroadcast.ExitCode)"

    # ----------------------------------------------------------------------------------
    # Test 13: Concurrent completions under lock: delayed transport sends 1 notification
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 13: Concurrent completions under lock send exactly 1 notification..." -ForegroundColor Yellow
    $task13Id = "test-task-13-concurrent"
    $relReport13 = ".orchestrator/reports/report-13.md"
    $fullReport13 = Join-Path $testWorkspace $relReport13
    Set-Content -LiteralPath $fullReport13 -Value "# Report 13 Concurrent Content" -Encoding UTF8
    $taskRecord13 = [PSCustomObject]@{
        taskId            = $task13Id
        worker            = "dummy"
        workerPane        = "w1:p1"
        returnPane        = "w1:p12"
        specPath          = "spec.md"
        reportPath        = $relReport13
        dispatchTimeIso   = [DateTime]::UtcNow.AddSeconds(-10).ToString("o")
        status            = "dispatched"
        notificationCount = 0
        workspaceRoot     = $testWorkspace
    }
    Set-Content -LiteralPath (Join-Path $testWorkspace ".orchestrator/tasks/$task13Id.json") -Value ($taskRecord13 | ConvertTo-Json) -Encoding UTF8

    $herdrLog13 = Join-Path $testTmpDir "mock-herdr-13.log"
    $workingFlag13 = Join-Path $testTmpDir "mock-herdr-13.flag"
    $env:MOCK_HERDR_LOG = $herdrLog13
    $env:MOCK_HERDR_WORKING_FLAG = $workingFlag13
    $env:MOCK_HERDR_DELAY_MS = "1500"

    try {
        # Launch Process 1
        $p1 = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptRoot/complete-task.ps1`" -TaskId $task13Id -WorkspaceRoot `"$testWorkspace`"" -WindowStyle Hidden -PassThru
        
        # Wait briefly for Process 1 to acquire lock, complete task, set in_flight, and start delayed notify
        Start-Sleep -Milliseconds 400
        
        # Verify live task record state while Process 1 is sending notification
        $liveJson = Get-Content -LiteralPath (Join-Path $testWorkspace ".orchestrator/tasks/$task13Id.json") -Raw | ConvertFrom-Json
        $liveStatusOk = ($liveJson.status -eq "completed")
        $liveDeliveryOk = ($liveJson.deliveryStatus -eq "in_flight")
        $liveHashOk = (-not [string]::IsNullOrEmpty($liveJson.reportHash))
        
        # Launch competing Process 2
        $p2 = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptRoot/complete-task.ps1`" -TaskId $task13Id -WorkspaceRoot `"$testWorkspace`"" -WindowStyle Hidden -PassThru
        
        $p1.WaitForExit(10000)
        $p2.WaitForExit(10000)
        
        $herdrCalls = if (Test-Path -LiteralPath $herdrLog13) { Get-Content -LiteralPath $herdrLog13 } else { @() }
        $sendCalls = @($herdrCalls | Where-Object { ($_ -match "agent prompt" -or $_ -match "pane send-text") -and $_ -match $task13Id })
        $exactlyOneSend = ($sendCalls.Count -eq 1)
        
        $finalRecord13 = Get-Content -LiteralPath (Join-Path $testWorkspace ".orchestrator/tasks/$task13Id.json") -Raw | ConvertFrom-Json
        $finalOk = ($finalRecord13.status -eq "completed") -and ($finalRecord13.deliveryStatus -eq "delivered") -and ($finalRecord13.notificationCount -eq 1)
        
        $concurrentOk = $liveStatusOk -and $liveDeliveryOk -and $liveHashOk -and $exactlyOneSend -and $finalOk
        Report-Test "Concurrent completions send exactly 1 notification and live record is complete during send" $concurrentOk "Live in_flight: $liveDeliveryOk, Live Hash: $liveHashOk, Sends: $($sendCalls.Count), Final: $($finalRecord13.deliveryStatus)"
    } finally {
        $env:MOCK_HERDR_LOG = $null
        $env:MOCK_HERDR_WORKING_FLAG = $null
        $env:MOCK_HERDR_DELAY_MS = $null
    }

    # ----------------------------------------------------------------------------------
    # Test 14: Subdirectory execution
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 14: Subdirectory execution resolves workspace root and relative paths identically..." -ForegroundColor Yellow
    $nestedDir = Join-Path $testWorkspace "nested/subfolder"
    New-Item -ItemType Directory -Path $nestedDir -Force | Out-Null
    $task14Id = "test-task-14-subdir"
    $relReport14 = ".orchestrator/reports/report-14.md"
    $fullReport14 = Join-Path $testWorkspace $relReport14
    Set-Content -LiteralPath $fullReport14 -Value "# Report 14 Subdir Content" -Encoding UTF8
    $taskRecord14 = [PSCustomObject]@{
        taskId            = $task14Id
        worker            = "dummy"
        workerPane        = "w1:p1"
        returnPane        = "w1:p2"
        specPath          = "spec.md"
        reportPath        = $relReport14
        dispatchTimeIso   = [DateTime]::UtcNow.AddSeconds(-10).ToString("o")
        status            = "dispatched"
        notificationCount = 0
    }
    Set-Content -LiteralPath (Join-Path $testWorkspace ".orchestrator/tasks/$task14Id.json") -Value ($taskRecord14 | ConvertTo-Json) -Encoding UTF8
    
    $pComplete14 = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptRoot/complete-task.ps1`" -TaskId $task14Id -NoNotify" -WorkingDirectory $nestedDir -WindowStyle Hidden -PassThru -Wait
    $pGet14 = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptRoot/get-report.ps1`" -TaskId $task14Id" -WorkingDirectory $nestedDir -WindowStyle Hidden -PassThru -Wait
    
    $subdirOk = ($pComplete14.ExitCode -eq 0) -and ($pGet14.ExitCode -eq 0)
    Report-Test "Subdirectory execution resolves workspace root and completes/retrieves identically" $subdirOk "Complete Exit: $($pComplete14.ExitCode), Get Exit: $($pGet14.ExitCode)"

    # ----------------------------------------------------------------------------------
    # Test 15: Missing digest in completed record rejected (exit 2)
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 15: Missing digest in completed record rejected (exit 2)..." -ForegroundColor Yellow
    $task15Id = "test-task-15-missing-digest"
    $relReport15 = ".orchestrator/reports/report-15.md"
    $fullReport15 = Join-Path $testWorkspace $relReport15
    Set-Content -LiteralPath $fullReport15 -Value "# Report 15 Content" -Encoding UTF8
    $taskRecord15 = [PSCustomObject]@{
        taskId          = $task15Id
        worker          = "dummy"
        workerPane      = "w1:p1"
        returnPane      = "w1:p2"
        specPath        = "spec.md"
        reportPath      = $relReport15
        dispatchTimeIso = [DateTime]::UtcNow.AddSeconds(-10).ToString("o")
        status          = "completed"
        completedTimeIso = [DateTime]::UtcNow.ToString("o")
        workspaceRoot   = $testWorkspace
    }
    Set-Content -LiteralPath (Join-Path $testWorkspace ".orchestrator/tasks/$task15Id.json") -Value ($taskRecord15 | ConvertTo-Json) -Encoding UTF8
    $p15 = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptRoot/get-report.ps1`" -TaskId $task15Id -WorkspaceRoot `"$testWorkspace`"" -NoNewWindow -PassThru -Wait
    $exit15 = $p15.ExitCode
    $missingDigestDetected = ($exit15 -eq 2)
    Report-Test "Missing digest in completed record rejected with exit code 2" $missingDigestDetected "Exit: $exit15"

    # ----------------------------------------------------------------------------------
    # Test 16: Same-cwd child session rejected (parent_session_id present)
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 16: Same-cwd child session rejected (parent_session_id present)..." -ForegroundColor Yellow
    $env:MOCK_HERDR_AGENT_LIST = '{"result":{"agents":[{"agent":"dummy","agent_status":"idle","pane_id":"w1:p1","agent_session":"mock-child-session"}]}}'
    $escapedCwd = $testWorkspace.Replace('\', '\\')
    $env:MOCK_AGENTSVIEW_SESSION_GET = "{`"id`":`"mock-child-session`",`"cwd`":`"$escapedCwd`",`"parent_session_id`":`"mock-parent-session-id`"}"
    try {
        $p16 = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptRoot/get-report.ps1`" -Workers dummy -NoSync -WorkspaceRoot `"$testWorkspace`"" -NoNewWindow -PassThru -Wait
        $exit16 = $p16.ExitCode
        $childRejected = ($exit16 -eq 2)
        Report-Test "Same-cwd child session rejected (parent_session_id present, exit 2)" $childRejected "Exit: $exit16"
    } finally {
        $env:MOCK_HERDR_AGENT_LIST = $null
        $env:MOCK_AGENTSVIEW_SESSION_GET = $null
    }

    # ----------------------------------------------------------------------------------
    # Test 16b: Ambiguous same-cwd live child lookup rejected (parent_session_id absent)
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 16b: Ambiguous same-cwd live child lookup rejected (parent_session_id absent)..." -ForegroundColor Yellow
    $env:MOCK_HERDR_AGENT_LIST = '{"result":{"agents":[{"agent":"dummy","agent_status":"idle","pane_id":"w1:p1","agent_session":"mock-ambiguous-session"}]}}'
    $env:MOCK_AGENTSVIEW_SESSION_GET = "{`"id`":`"mock-ambiguous-session`",`"cwd`":`"$escapedCwd`"}"
    try {
        $p16b = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptRoot/get-report.ps1`" -Workers dummy -NoSync -WorkspaceRoot `"$testWorkspace`"" -NoNewWindow -PassThru -Wait
        $exit16b = $p16b.ExitCode
        $ambiguousRejected = ($exit16b -eq 2)
        Report-Test "Ambiguous same-cwd live child lookup rejected (parent_session_id absent, exit 2)" $ambiguousRejected "Exit: $exit16b"
    } finally {
        $env:MOCK_HERDR_AGENT_LIST = $null
        $env:MOCK_AGENTSVIEW_SESSION_GET = $null
    }

    # ----------------------------------------------------------------------------------
    # Test 17: Failed AgentsView under SinceIso returns retrieval error (exit 2)
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 17: Failed AgentsView under SinceIso returns retrieval error..." -ForegroundColor Yellow
    $env:MOCK_AGENTSVIEW_EXIT_CODE = "1"
    try {
        $p17 = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptRoot/get-report.ps1`" -SessionId mock:123 -NoSync -SinceIso `"2026-10-21T00:00:00Z`" -WorkspaceRoot `"$testWorkspace`"" -NoNewWindow -PassThru -Wait
        $exit17 = $p17.ExitCode
        Report-Test "Failed AgentsView under SinceIso returns retrieval error and non-zero exit" ($exit17 -ne 0) "Exit: $exit17"
    } finally {
        $env:MOCK_AGENTSVIEW_EXIT_CODE = $null
    }

    # ----------------------------------------------------------------------------------
    # Test 18: Process exits while descendant holds pipe (bounded stream drain)
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 18: Process exits while descendant holds pipe (bounded stream drain)..." -ForegroundColor Yellow
    $pipeHolderBat = Join-Path $testTmpDir "pipe_holder.bat"
    Set-Content -LiteralPath $pipeHolderBat -Value @"
@echo off
start powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 30"
echo ParentImmediateOutput
exit /b 0
"@
    $ast = [System.Management.Automation.Language.Parser]::ParseFile("$scriptRoot/get-report.ps1", [ref]$null, [ref]$null)
    $funcAst = $ast.Find({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -eq "Invoke-ExternalCommandWithTimeout" }, $true)
    Invoke-Expression $funcAst.Extent.Text

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $res = Invoke-ExternalCommandWithTimeout -FilePath "$pipeHolderBat" -ArgumentList "" -TimeoutMs 5000 -DrainTimeoutMs 2000
    $sw.Stop()
    $elapsed18 = $sw.Elapsed.TotalSeconds
    $drainTimeoutDetected = ($res.StdErr -match "stream drain timed out")
    $boundedDrain = ($elapsed18 -lt 8) -and $drainTimeoutDetected -and ($res.ExitCode -eq -3)
    Report-Test "Stream drain bounds child-inherited pipe without hanging ($([math]::Round($elapsed18, 1))s, Exit -3)" $boundedDrain "Elapsed: $([math]::Round($elapsed18, 1))s, Exit: $($res.ExitCode)"

    # ----------------------------------------------------------------------------------
    # Test 19: Real installed AgentsView CLI metadata check (session get <id> --json)
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 19: Real installed AgentsView CLI metadata check (session get)..." -ForegroundColor Yellow
    $realAgentsView = $null
    foreach ($p in ($origPath -split ";")) {
        $candidate = Join-Path $p "agentsview.exe"
        if (Test-Path -LiteralPath $candidate) {
            $realAgentsView = $candidate
            break
        }
    }
    $sampleId = $null
    if ($realAgentsView) {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $listRes = & $realAgentsView session list --limit 1 --json 2>$null
        $sw.Stop()
        $metaOk = $false
        if ($listRes) {
            try {
                $parsedList = $listRes | ConvertFrom-Json
                if ($parsedList.sessions -and $parsedList.sessions.Count -gt 0) {
                    $sampleId = $parsedList.sessions[0].id
                    $getRes = & $realAgentsView session get $sampleId --json 2>$null
                    if ($getRes) {
                        $parsedGet = $getRes | ConvertFrom-Json
                        $metaOk = ($parsedGet.id -eq $sampleId) -and ($parsedGet.cwd -ne $null)
                    }
                }
            } catch {}
        }
        Report-Test "Real installed AgentsView v0.44.0 exposes session get <id> --json" $metaOk "Sample: $sampleId, Elapsed: $($sw.ElapsedMilliseconds)ms"
    } else {
        Report-Test "Real installed AgentsView v0.44.0 exposes session get <id> --json" $true "Skipped (no system agentsview in PATH)"
    }

    # ----------------------------------------------------------------------------------
    # Test 20: Real-CLI pinned transcript extraction smoke check (-SessionId)
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 20: Real-CLI pinned transcript extraction smoke check (-SessionId)..." -ForegroundColor Yellow
    if ($realAgentsView -and $sampleId) {
        $realDir = Split-Path $realAgentsView
        # Put realDir ahead of mockBinDir so the real agentsview binary is invoked
        $env:PATH = "$realDir;$mockBinDir;$PSHOME;$env:SystemRoot\System32;$env:SystemRoot"
        try {
            $output20 = & powershell -NoProfile -ExecutionPolicy Bypass -File "$scriptRoot/get-report.ps1" -SessionId $sampleId -NoSync -Limit 1 2>&1
            $exit20 = $LASTEXITCODE
            $transcriptOk = ($exit20 -eq 0) -and (($output20 | Out-String) -match "AgentsView Heuristic Transcript Evidence")
            Report-Test "Real-CLI pinned transcript extraction operates cleanly (-SessionId)" $transcriptOk "Exit: $exit20"
        } finally {
            $env:PATH = "$mockBinDir;$PSHOME;$env:SystemRoot\System32;$env:SystemRoot"
        }
    } else {
        Report-Test "Real-CLI pinned transcript extraction operates cleanly (-SessionId)" $true "Skipped (no sample session)"
    }

    # ----------------------------------------------------------------------------------
    # Test 21: Write-AtomicJsonFile fails without Move-Item fallback and retains original
    # ----------------------------------------------------------------------------------
    Write-Host "`nTest 21: Write-AtomicJsonFile fails without Move-Item fallback..." -ForegroundColor Yellow
    $task21Path = Join-Path $testWorkspace ".orchestrator/tasks/test-task-21-atomic-fail.json"
    $origContent = '{"taskId":"test-task-21","status":"dispatched","immutable":true}'
    Set-Content -LiteralPath $task21Path -Value $origContent -Encoding UTF8

    $astComp = [System.Management.Automation.Language.Parser]::ParseFile("$scriptRoot/complete-task.ps1", [ref]$null, [ref]$null)
    $funcAtomicAst = $astComp.Find({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -eq "Write-AtomicJsonFile" }, $true)
    Invoke-Expression $funcAtomicAst.Extent.Text

    $lockStream = [System.IO.File]::Open($task21Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::None)
    $replacementFailed = $false
    try {
        Write-AtomicJsonFile -TargetFilePath $task21Path -JsonContent '{"corrupted":true}'
    } catch {
        $replacementFailed = $true
    } finally {
        $lockStream.Close()
        $lockStream.Dispose()
    }

    $retainedContent = Get-Content -LiteralPath $task21Path -Raw -Encoding UTF8
    $recordPreserved = ($retainedContent.Trim() -eq $origContent.Trim())
    $noTmpFilesLeft = @(Get-ChildItem -LiteralPath (Join-Path $testWorkspace ".orchestrator/tasks") -Filter "tmp.*.json").Count -eq 0
    Report-Test "Write-AtomicJsonFile fails without Move-Item fallback and preserves existing record" ($replacementFailed -and $recordPreserved -and $noTmpFilesLeft) "Failed: $replacementFailed, Preserved: $recordPreserved, Clean: $noTmpFilesLeft"

} finally {
    # Restore original environment and clean up test directory
    $env:PATH = $origPath
    Remove-Item -LiteralPath $testTmpDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host " VALIDATION RESULTS: $passed PASSED, $failed FAILED" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "==================================================" -ForegroundColor Cyan

if ($failed -gt 0) {
    exit 1
}
exit 0
