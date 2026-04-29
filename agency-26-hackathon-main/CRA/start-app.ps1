# start-app.ps1 - Run from CRA/ directory
# Works with or without .env.public (uses demo data if no DB credentials found)

Write-Host "`nFollow the Money — Funding Loop Intelligence" -ForegroundColor Cyan

# Detect which DB to use: local .env wins over .env.public (live Render)
if (Test-Path "$PSScriptRoot\.env") {
    $envLine = Get-Content "$PSScriptRoot\.env" | Where-Object { $_ -match "^DB_CONNECTION_STRING=" }
    if ($envLine -match "localhost") {
        Write-Host "Using LOCAL PostgreSQL database" -ForegroundColor Green
    } else {
        Write-Host "Using .env credentials" -ForegroundColor Green
    }
} elseif (Test-Path "$PSScriptRoot\.env.public") {
    Write-Host "Using live Render database (.env.public)" -ForegroundColor Green
} else {
    Write-Host "No credentials found — running in DEMO MODE with sample data" -ForegroundColor Yellow
}

Write-Host "Starting API server on port 3000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$PSScriptRoot'; node visualizations/server.js" -WindowStyle Normal

Start-Sleep 2

Write-Host "Starting React dev server on port 5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$PSScriptRoot\funding-loops-app'; npm run dev" -WindowStyle Normal

Start-Sleep 3
Write-Host "`nApp ready!" -ForegroundColor Green
Write-Host "Open: http://localhost:5173  (React app)" -ForegroundColor Cyan
Write-Host "API:  http://localhost:3000/api/stats" -ForegroundColor Gray
Write-Host ""
