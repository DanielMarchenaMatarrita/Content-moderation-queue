$ErrorActionPreference = 'Stop'

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

docker compose up --build -d --wait --wait-timeout 240
if ($LASTEXITCODE -ne 0) {
    throw 'CMQ Docker stack failed to start. Run: docker compose logs'
}

Write-Host ''
Write-Host 'CMQ is ready:'
Write-Host '  Frontend:  http://localhost:8080'
Write-Host '  API:       http://localhost:3000'
Write-Host '  Swagger:   http://localhost:3000/docs'
Write-Host '  RabbitMQ:  http://localhost:15672'
