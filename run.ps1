$ErrorActionPreference = 'Stop'

$envPath = Join-Path $PSScriptRoot '.env'
$envExamplePath = Join-Path $PSScriptRoot '.env.example'
$credentialInstruction = 'Set non-empty POSTGRES_PASSWORD and RABBITMQ_PASSWORD in .env, then rerun this script.'

if (-not (Test-Path -LiteralPath $envPath)) {
    Copy-Item -LiteralPath $envExamplePath -Destination $envPath
    [Console]::Error.WriteLine($credentialInstruction)
    exit 1
}

function Get-DotEnvValue {
    param([Parameter(Mandatory)][string]$Name)

    foreach ($line in [System.IO.File]::ReadLines($envPath)) {
        if ($line -match "^\s*$([regex]::Escape($Name))\s*=(.*)$") {
            $value = $Matches[1].Trim()
            if ($value.Length -ge 2 -and (($value[0] -eq '"' -and $value[-1] -eq '"') -or ($value[0] -eq "'" -and $value[-1] -eq "'"))) {
                return $value.Substring(1, $value.Length - 2)
            }
            return $value
        }
    }

    return $null
}

function Test-InvalidCredential {
    param([AllowNull()][string]$Value)

    return [string]::IsNullOrWhiteSpace($Value) -or $Value -match '(?i)(placeholder|change[-_ ]?me|replace[-_ ]?with|example|your[-_ ])'
}

$postgresPassword = Get-DotEnvValue -Name 'POSTGRES_PASSWORD'
$rabbitPassword = Get-DotEnvValue -Name 'RABBITMQ_PASSWORD'
if ((Test-InvalidCredential $postgresPassword) -or (Test-InvalidCredential $rabbitPassword)) {
    [Console]::Error.WriteLine($credentialInstruction)
    exit 1
}

$rabbitManagementPort = Get-DotEnvValue -Name 'RABBITMQ_MANAGEMENT_PORT'
if ([string]::IsNullOrWhiteSpace($rabbitManagementPort)) {
    $rabbitManagementPort = '15672'
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker is required but was not found in PATH.'
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker daemon is not available. Start Docker Desktop and retry.'
}

docker compose version *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Compose is required but unavailable.'
}

docker compose --project-directory $PSScriptRoot --env-file $envPath pull
if ($LASTEXITCODE -ne 0) {
    throw 'PayGrid images failed to pull. Check registry access and image tags.'
}

docker compose --project-directory $PSScriptRoot --env-file $envPath up --no-build -d --wait --wait-timeout 240
if ($LASTEXITCODE -ne 0) {
    throw 'PayGrid Docker stack failed to start. Run: docker compose logs'
}

Write-Host ''
Write-Host 'PayGrid is ready:'
Write-Host '  PayGrid:   http://localhost:8080'
Write-Host '  API:       http://localhost:3000/orders'
Write-Host '  API docs:  http://localhost:3000/docs'
Write-Host "  RabbitMQ:  http://localhost:$rabbitManagementPort (local host only)"
