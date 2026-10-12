<#
GO Structural Analysis - Windows installer build.
Run from a normal PowerShell console with Windows C++ Build Tools/WebView2 installed.
Creates a local unsigned NSIS setup EXE and a SHA256 summary; no administrator rights
required to execute this script. Does not change GitHub Actions or its billing settings.
#>
param(
    [switch]$SkipEngineTests
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Exec([string]$Command, [string[]]$Arguments) {
    Write-Host ("==> " + $Command + " " + ($Arguments -join " ")) -ForegroundColor Cyan
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $Command" }
}
# Install checks are Windows-specific. Rustup typically lives in %USERPROFILE%\.cargo\bin,
# which is not visible to an already-open terminal after the Rust installer finishes.
foreach ($cmd in @('node','npm.cmd')) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "Missing $cmd. Install Node.js 22 LTS from https://nodejs.org/ and reopen PowerShell."
    }
}
$cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
if ((Test-Path (Join-Path $cargoBin 'rustup.exe')) -and
    -not (Get-Command 'rustup' -ErrorAction SilentlyContinue)) {
    $env:Path = "$cargoBin;$env:Path"
    Write-Host "Rustup found on disk; updated PATH in this PowerShell process." -ForegroundColor Green
}
if (-not (Get-Command 'rustup' -ErrorAction SilentlyContinue)) {
    if (-not (Get-Command 'winget' -ErrorAction SilentlyContinue)) {
        throw "Rustup missing. Install from https://rustup.rs/ or run winget install --id Rustlang.Rustup -e in PowerShell."
    }
    Write-Host "Rustup is missing. Installing official Rustlang.Rustup with winget..." -ForegroundColor Yellow
    Exec 'winget' @('install','--id','Rustlang.Rustup','-e','--source','winget','--accept-package-agreements','--accept-source-agreements')
    if (Test-Path (Join-Path $cargoBin 'rustup.exe')) {
        $env:Path = "$cargoBin;$env:Path"
    }
}
foreach ($cmd in @('rustup','cargo','rustc')) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "Missing $cmd after Rustup installation. Close PowerShell, open a new terminal, and rerun build-windows.ps1. Check $cargoBin."
    }
}
$root = $PSScriptRoot
$web = Join-Path $root 'web'
if (-not (Test-Path (Join-Path $web 'package.json'))) { throw "Run this script from a complete Git checkout." }

# Validate and initialize Microsoft Visual C++ Build Tools before compiling anything.
# Installing Rust alone does not install link.exe or the Windows SDK.
function Enable-MsvcBuildEnvironment {
    $link = Get-Command 'link.exe' -ErrorAction SilentlyContinue
    if ($link) {
        Write-Host "MSVC linker available: $($link.Source)" -ForegroundColor Green
        return
    }

    $help = @'
Microsoft Visual C++ linker link.exe is missing.
Install Visual Studio Build Tools 2022 (Desktop development with C++).
Select MSVC v143 x64/x86 build tools and a Windows 10/11 SDK.

Run in an elevated PowerShell:
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --source winget --override "--passive --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"

If Build Tools is already installed, open "Visual Studio Installer", click
"Modify" on Build Tools, select "Desktop development with C++", and apply.
Then reopen PowerShell and rerun build-windows.ps1.
Documentation: https://v2.tauri.app/start/prerequisites/
'@

    $programFilesX86 = [Environment]::GetFolderPath('ProgramFilesX86')
    $vswhere = Join-Path $programFilesX86 'Microsoft Visual Studio\Installer\vswhere.exe'
    if (-not (Test-Path -LiteralPath $vswhere)) {
        throw $help
    }

    # Search installed instances by required MSVC workload component, not a
    # fixed version-specific installation path; supports nondefault locations.
    $instances = @(& $vswhere -latest -products '*' -requires 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64' -property installationPath)
    $instances = @($instances | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($LASTEXITCODE -ne 0 -or $instances.Count -eq 0) {
        throw $help
    }

    $vsDevCmd = Join-Path $instances[0] 'Common7\Tools\VsDevCmd.bat'
    if (-not (Test-Path -LiteralPath $vsDevCmd)) {
        throw "Visual Studio C++ tools found but VsDevCmd.bat is missing: $vsDevCmd. Repair Build Tools in Visual Studio Installer."
    }

    # Import MSVC + Windows SDK PATH, LIB and INCLUDE into THIS PowerShell
    # process so Rust/Cargo and wasm-pack can resolve link.exe and *.lib.
    $cmdLine = 'call "' + $vsDevCmd + '" -no_logo -arch=amd64 -host_arch=amd64 >nul && set'
    $envDump = @(& cmd.exe /d /c $cmdLine)
    if ($LASTEXITCODE -ne 0) {
        throw "Could not initialize MSVC developer environment. Check Visual Studio Installer for missing C++ components and Windows SDK."
    }
    foreach ($line in $envDump) {
        $index = $line.IndexOf('=')
        if ($index -gt 0) {
            $name = $line.Substring(0, $index)
            $value = $line.Substring($index + 1)
            [Environment]::SetEnvironmentVariable($name, $value, 'Process')
        }
    }

    $link = Get-Command 'link.exe' -ErrorAction SilentlyContinue
    if (-not $link -or [string]::IsNullOrWhiteSpace($env:LIB)) {
        throw "MSVC initialization did not make link.exe and SDK library paths available. Repair C++ Build Tools and Windows SDK, then rerun."
    }
    Write-Host "MSVC linker ready: $($link.Source)" -ForegroundColor Green
    Write-Host "Visual Studio tools: $($instances[0])" -ForegroundColor Green
}
Enable-MsvcBuildEnvironment

# Tauri on Windows requires MSVC, not GNU. Nightly is needed by this engine.
Exec 'rustup' @('default','stable-msvc')
Exec 'rustup' @('toolchain','install','stable','--profile','minimal')
Exec 'rustup' @('toolchain','install','nightly','--profile','minimal','--component','rust-src','--target','wasm32-unknown-unknown')

if (-not (Get-Command 'wasm-pack' -ErrorAction SilentlyContinue)) {
    Write-Host "Installing wasm-pack..." -ForegroundColor Cyan
    Exec 'cargo' @('+stable','install','wasm-pack','--locked')
}

Push-Location $root
try {
    if (-not $SkipEngineTests) {
        Exec 'cargo' @('+stable','test','--manifest-path','engine/Cargo.toml','--lib')
    }
    Push-Location $web
    try {
        # Execute npm.cmd, NOT npm.ps1: the latter accesses $MyInvocation.Statement
        # and fails under Set-StrictMode -Version Latest on Windows PowerShell 5.1.
        Exec 'npm.cmd' @('install','--no-package-lock')
        Exec 'npm.cmd' @('run','wasm')
        Exec 'npm.cmd' @('run','desktop:smoke')
        Exec 'npm.cmd' @('run','desktop:verify-solver')
        Exec 'npm.cmd' @('run','desktop:frontend')
        Exec 'cargo' @('+stable','test','--manifest-path','src-tauri/Cargo.toml')
        Exec 'npm.cmd' @('run','desktop:build')
    } finally { Pop-Location }

    $nsisDir = Join-Path $root 'web\src-tauri\target\release\bundle\nsis'
    # Do not mistake a leftover v0.1.0 installer for the freshly built v0.1.1 package.
    $tauriConfig = Get-Content -LiteralPath (Join-Path $web 'src-tauri\tauri.conf.json') -Raw | ConvertFrom-Json
    $expectedVersion = [string]$tauriConfig.version
    $expectedFilter = "*_${expectedVersion}_*-setup.exe"
    $installers = @(Get-ChildItem -LiteralPath $nsisDir -Filter $expectedFilter -File -ErrorAction SilentlyContinue)
    if ($installers.Count -eq 0) { throw "Tauri did not produce a NEW v$expectedVersion NSIS .exe in $nsisDir (expected $expectedFilter)" }
    foreach ($installer in $installers) {
        $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $installer.FullName
        Write-Host "INSTALLER: $($installer.FullName)" -ForegroundColor Green
        Write-Host "SHA256: $($hash.Hash)" -ForegroundColor Green
    }
    Write-Host 'Windows NSIS build complete. Install and run offline/WebView2 acceptance checks before release.' -ForegroundColor Green
} finally { Pop-Location }
