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
foreach ($cmd in @('node','npm')) {
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
        Exec 'npm' @('install','--no-package-lock')
        Exec 'npm' @('run','wasm')
        Exec 'npm' @('run','desktop:smoke')
        Exec 'npm' @('run','desktop:verify-solver')
        Exec 'npm' @('run','desktop:frontend')
        Exec 'cargo' @('+stable','test','--manifest-path','src-tauri/Cargo.toml')
        Exec 'npm' @('run','desktop:build')
    } finally { Pop-Location }

    $nsisDir = Join-Path $root 'web\src-tauri\target\release\bundle\nsis'
    $installers = @(Get-ChildItem -LiteralPath $nsisDir -Filter '*.exe' -File -ErrorAction SilentlyContinue)
    if ($installers.Count -eq 0) { throw "Tauri did not produce an NSIS .exe in $nsisDir" }
    foreach ($installer in $installers) {
        $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $installer.FullName
        Write-Host "INSTALLER: $($installer.FullName)" -ForegroundColor Green
        Write-Host "SHA256: $($hash.Hash)" -ForegroundColor Green
    }
    Write-Host 'Windows NSIS build complete. Install and run offline/WebView2 acceptance checks before release.' -ForegroundColor Green
} finally { Pop-Location }
