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
foreach ($cmd in @('node','npm','rustup','cargo')) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "Missing $cmd. Install Node.js 22 and Rustup, then retry."
    }
}
if (-not (Get-Command 'wasm-pack' -ErrorAction SilentlyContinue)) {
    Write-Host "Installing wasm-pack..." -ForegroundColor Cyan
    Exec 'cargo' @('+stable','install','wasm-pack','--locked')
}
$root = $PSScriptRoot
$web = Join-Path $root 'web'
if (-not (Test-Path (Join-Path $web 'package.json'))) { throw "Run this script from a complete Git checkout." }

# The checked-in engine/rust-toolchain.toml uses nightly + build-std.
Exec 'rustup' @('toolchain','install','stable','--profile','minimal')
Exec 'rustup' @('toolchain','install','nightly','--profile','minimal','--component','rust-src','--target','wasm32-unknown-unknown')

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
