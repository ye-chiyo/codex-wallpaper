#Requires -Version 5.1

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$powerShell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

function Get-ApplicationPath($Name) {
    $command = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($command) {
        return $command.Source
    }
    return $null
}

function Test-WScriptShellCom {
    $shell = $null
    try {
        $shell = New-Object -ComObject WScript.Shell
        return $true
    } catch {
        return $false
    } finally {
        if ($null -ne $shell) {
            [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell)
        }
    }
}

function Format-Duration($Stopwatch) {
    return "{0:N3}s" -f $Stopwatch.Elapsed.TotalSeconds
}

$pnpm = Get-ApplicationPath "pnpm.cmd"
$ffmpeg = Get-ApplicationPath "ffmpeg.exe"
$edgeAvailable = Test-Path -LiteralPath $edgePath -PathType Leaf
$comAvailable = Test-WScriptShellCom

if ($edgeAvailable) {
    $edgeVersion = (Get-Item -LiteralPath $edgePath).VersionInfo.ProductVersion
    Write-Host "[environment] Edge: AVAILABLE ($edgeVersion) at $edgePath"
} else {
    Write-Host "[environment] Edge: BLOCKED (missing $edgePath)"
}

if ($ffmpeg) {
    Write-Host "[environment] ffmpeg.exe: AVAILABLE at $ffmpeg"
} else {
    Write-Host "[environment] ffmpeg.exe: BLOCKED (not found on PATH)"
}

if ($comAvailable) {
    Write-Host "[environment] PowerShell COM: AVAILABLE (WScript.Shell)"
} else {
    Write-Host "[environment] PowerShell COM: BLOCKED (WScript.Shell unavailable)"
}

$nodeBlockers = @()
if (-not $pnpm) {
    $nodeBlockers += "pnpm.cmd unavailable"
}
if (-not $edgeAvailable) {
    $nodeBlockers += "Edge unavailable at $edgePath"
}

$desktopBlockers = @()
if (-not $ffmpeg) {
    $desktopBlockers += "ffmpeg.exe unavailable on PATH"
}

$startupEntryBlockers = @()
if (-not $comAvailable) {
    $startupEntryBlockers += "WScript.Shell COM unavailable"
}

$suites = @(
    [pscustomobject]@{
        Name = "Node tests (pnpm test)"
        Type = "node"
        Blockers = $nodeBlockers
    },
    [pscustomobject]@{
        Name = "desktop-entry.test.ps1"
        Type = "desktop-entry"
        Blockers = $desktopBlockers
    },
    [pscustomobject]@{
        Name = "profile-preflight.test.ps1"
        Type = "profile-preflight"
        Blockers = @()
    },
    [pscustomobject]@{
        Name = "startup-entry.test.ps1"
        Type = "startup-entry"
        Blockers = $startupEntryBlockers
    },
    [pscustomobject]@{
        Name = "startup-roots.test.ps1"
        Type = "startup-roots"
        Blockers = @()
    }
)

Push-Location -LiteralPath $repoRoot
try {
    $results = [Collections.Generic.List[object]]::new()
    foreach ($suite in $suites) {
        Write-Host "::group::$($suite.Name)"

        if ($suite.Blockers.Count -gt 0) {
            $reason = $suite.Blockers -join "; "
            Write-Host "BLOCKED: $reason"
            [void]$results.Add([pscustomobject]@{
                Name = $suite.Name
                Status = "BLOCKED"
                Duration = "not run"
                ExitCode = "-"
            })
            Write-Host "::endgroup::"
            continue
        }

        $watch = [Diagnostics.Stopwatch]::StartNew()
        $exitCode = 1
        try {
            switch ($suite.Type) {
                "node" {
                    & $pnpm test | Out-Host
                }
                { $_ -in @("desktop-entry", "profile-preflight", "startup-entry", "startup-roots") } {
                    $scriptPath = Join-Path $PSScriptRoot "$($suite.Type).test.ps1"
                    & $powerShell -NoProfile -ExecutionPolicy Bypass -File $scriptPath | Out-Host
                }
            }
            $exitCode = $LASTEXITCODE
        } catch {
            Write-Host "ERROR: $($_.Exception.Message)"
            $exitCode = 1
        } finally {
            $watch.Stop()
        }

        $status = if ($exitCode -eq 0) { "PASS" } else { "FAIL" }
        $result = [pscustomobject]@{
            Name = $suite.Name
            Status = $status
            Duration = (Format-Duration $watch)
            ExitCode = $exitCode
        }
        Write-Host "RESULT $($result.Name): $($result.Status); duration=$($result.Duration); exit=$($result.ExitCode)"
        [void]$results.Add($result)
        Write-Host "::endgroup::"
    }

    Write-Host ""
    Write-Host "Test suite summary"
    foreach ($result in $results) {
        Write-Host (
            "  {0}: {1}; duration={2}; exit={3}" -f
            $result.Name,
            $result.Status,
            $result.Duration,
            $result.ExitCode
        )
    }

    $failed = @($results | Where-Object Status -eq "FAIL")
    $blocked = @($results | Where-Object Status -eq "BLOCKED")
    if ($failed.Count -gt 0) {
        Write-Host "Overall: FAIL ($(($failed | ForEach-Object Name) -join ", "))"
        exit 1
    }
    if ($blocked.Count -gt 0) {
        Write-Host "Overall: BLOCKED ($(($blocked | ForEach-Object Name) -join ", "))"
        exit 1
    }

    Write-Host "Overall: PASS"
    exit 0
} finally {
    Pop-Location
}
