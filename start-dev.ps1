<#
.SYNOPSIS
  Space Mission Operations & Satellite Management System
  Quick-Start Launcher for Windows PowerShell
#>

$ErrorActionPreference = "Stop"
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Space Mission Operations & Satellite Management System   " -ForegroundColor Cyan
Write-Host " Windows Development Launcher                            " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Refresh PATH for the current PowerShell session
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","User") + ";" + [System.Environment]::GetEnvironmentVariable("Path","Machine")

Write-Host "`n[1/3] Checking Node.js runtime..." -ForegroundColor Yellow
$nodeVersion = node -v
Write-Host "  -> Node: $nodeVersion" -ForegroundColor Green
$npmVersion = npm.cmd -v
Write-Host "  -> npm:  $npmVersion" -ForegroundColor Green

Write-Host "`n[2/3] Checking dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "server\node_modules")) {
    Write-Host "  -> Installing server packages..." -ForegroundColor Gray
    npm.cmd --prefix server install
}
if (-not (Test-Path "client\node_modules")) {
    Write-Host "  -> Installing client packages..." -ForegroundColor Gray
    npm.cmd --prefix client install
}
Write-Host "  -> Dependencies verified!" -ForegroundColor Green

Write-Host "`n[3/3] Launching Mission Operations Console..." -ForegroundColor Yellow
Write-Host "  -> Backend API:  http://localhost:5000" -ForegroundColor Cyan
Write-Host "  -> Health Check: http://localhost:5000/api/health" -ForegroundColor Cyan
Write-Host "  -> Frontend App: http://localhost:5173" -ForegroundColor Cyan
Write-Host "  -> Demo Logins:  admin@spaceops.local / MissionControl2026!`n" -ForegroundColor Green

npm.cmd run dev
