# setup-local-db.ps1
# ─────────────────────────────────────────────────────────────────────────────
# Full local database setup for AI For Accountability Hackathon.
#
# WHEN TO RUN:
#   Step 1 (right now):        Run to create local PostgreSQL DB + set connection strings
#   Step 2 (on event day):     Run with -Export to pull data from the live Render DB
#   Step 3 (after export):     Run with -Import to load data into your local DB
#
# USAGE:
#   .\setup-local-db.ps1                  # Step 1: create DB, write .env files
#   .\setup-local-db.ps1 -Export          # Step 2: dump Render → local JSONL (needs .env.public)
#   .\setup-local-db.ps1 -Import          # Step 3: import JSONL → local Postgres
#   .\setup-local-db.ps1 -Export -Import  # Steps 2+3 in one go
#   .\setup-local-db.ps1 -Schema cra      # Import only one schema
# ─────────────────────────────────────────────────────────────────────────────

param(
    [switch]$Export,
    [switch]$Import,
    [string]$Schema = "",      # blank = all schemas
    [string]$PgPassword = "postgres123",
    [string]$PgUser = "postgres",
    [string]$PgHost = "localhost",
    [int]$PgPort = 5432,
    [string]$DbName = "hackathon"
)

$ErrorActionPreference = "Stop"
$root   = Split-Path -Parent $MyInvocation.MyCommand.Definition
$localDb = Join-Path $root ".local-db"
$pgBin  = "C:\Program Files\PostgreSQL\17\bin"

$localConn = "postgresql://${PgUser}:${PgPassword}@${PgHost}:${PgPort}/${DbName}"

Write-Host "`n=== AI For Accountability — Local DB Setup ===" -ForegroundColor Cyan

# ── Verify psql is reachable ────────────────────────────────────────────────
$psql = Join-Path $pgBin "psql.exe"
if (-not (Test-Path $psql)) {
    Write-Host "ERROR: psql not found at $psql" -ForegroundColor Red
    Write-Host "Is PostgreSQL 17 installed? Check C:\Program Files\PostgreSQL\" -ForegroundColor Yellow
    exit 1
}
Write-Host "PostgreSQL found: $psql" -ForegroundColor Green

# ── Step 1: Create database + write .env files ───────────────────────────────
if (-not $Export -and -not $Import) {
    Write-Host "`n[Step 1] Creating local database '$DbName'..." -ForegroundColor Yellow

    $env:PGPASSWORD = $PgPassword
    & $psql -U $PgUser -h $PgHost -p $PgPort -c "CREATE DATABASE $DbName;" postgres 2>&1 | ForEach-Object {
        if ($_ -match "already exists") { Write-Host "  Database already exists — skipping" -ForegroundColor Gray }
        elseif ($_ -match "ERROR")      { Write-Host "  $_" -ForegroundColor Red }
        else                            { Write-Host "  $_" }
    }

    # Enable required extensions
    Write-Host "`nEnabling pg_trgm and fuzzystrmatch extensions..." -ForegroundColor Yellow
    & $psql -U $PgUser -h $PgHost -p $PgPort -d $DbName -c "CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;" 2>&1 | Out-Null
    Write-Host "  Extensions ready" -ForegroundColor Green

    # Write .env files for all 4 modules (local overrides)
    Write-Host "`nWriting local .env files for each module..." -ForegroundColor Yellow
    $envContent = "DB_CONNECTION_STRING=$localConn"
    foreach ($mod in @("CRA","FED","AB","general",".local-db")) {
        $envPath = Join-Path $root "$mod\.env"
        Set-Content $envPath $envContent
        Write-Host "  Wrote $mod\.env" -ForegroundColor Green
    }

    Write-Host "`n[Step 1 complete]" -ForegroundColor Green
    Write-Host "Local DB connection: $localConn" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  On event day (April 29), after getting .env.public:"
    Write-Host "  1. Copy .env.public to CRA\, FED\, AB\, general\"
    Write-Host "  2. Run: .\setup-local-db.ps1 -Export   (dumps live DB to JSONL, ~1-3 hrs)"
    Write-Host "  3. Run: .\setup-local-db.ps1 -Import   (loads JSONL into local Postgres)"
    Write-Host ""
    Write-Host "Then update CRA\.env (overrides .env.public) for your apps:"
    Write-Host "  DB_CONNECTION_STRING=$localConn"
    return
}

# ── Step 2: Export from live Render DB → local JSONL files ──────────────────
if ($Export) {
    Write-Host "`n[Step 2] Exporting live database to JSONL files..." -ForegroundColor Yellow

    # Find .env.public to get live connection string
    $liveConn = $null
    foreach ($mod in @("CRA","FED","AB","general")) {
        $pub = Join-Path $root "$mod\.env.public"
        if (Test-Path $pub) {
            $line = Get-Content $pub | Where-Object { $_ -match "^DB_CONNECTION_STRING=" }
            if ($line) {
                $liveConn = $line -replace "^DB_CONNECTION_STRING=",""
                Write-Host "  Using credentials from $mod\.env.public" -ForegroundColor Green
                break
            }
        }
    }

    if (-not $liveConn) {
        Write-Host "ERROR: No .env.public found in CRA/, FED/, AB/, or general/" -ForegroundColor Red
        Write-Host "Place the event-day .env.public files first, then re-run with -Export" -ForegroundColor Yellow
        exit 1
    }

    Write-Host "  Live DB: $($liveConn -replace ':([^:@]+)@',':***@')" -ForegroundColor Gray
    Write-Host "  This will export ~13 GB of JSONL data — may take 1-3 hours..." -ForegroundColor Yellow
    Write-Host "  Output: .local-db\data\" -ForegroundColor Gray
    Write-Host ""

    $env:DB_CONNECTION_STRING = $liveConn
    Set-Location $localDb
    $exportArgs = @("export.js")
    if ($Schema) { $exportArgs += "--schema"; $exportArgs += $Schema }
    node @exportArgs
}

# ── Step 3: Import JSONL → local Postgres ───────────────────────────────────
if ($Import) {
    Write-Host "`n[Step 3] Importing JSONL data into local database..." -ForegroundColor Yellow

    $dataDir = Join-Path $localDb "data"
    if (-not (Test-Path $dataDir)) {
        Write-Host "ERROR: .local-db\data\ not found." -ForegroundColor Red
        Write-Host "Run with -Export first to download the data, then -Import." -ForegroundColor Yellow
        exit 1
    }

    Write-Host "  Local DB: $localConn" -ForegroundColor Gray
    Write-Host "  This will import ~23 million rows — may take 20-30 minutes..." -ForegroundColor Yellow
    Write-Host ""

    $env:DB_CONNECTION_STRING = $localConn
    Set-Location $localDb
    $importArgs = @("import.js")
    if ($Schema) { $importArgs += "--schema"; $importArgs += $Schema }
    node @importArgs

    Write-Host "`n[Import complete!]" -ForegroundColor Green
    Write-Host "Your local DB is ready at: $localConn" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Test it:"
    Write-Host "  & '$pgBin\psql.exe' -U $PgUser -d $DbName -c 'SELECT COUNT(*) FROM cra.loops;'"
}
