param(
    [string]$JavaHome = $env:JAVA_HOME,
    [int]$TimeoutSeconds = 240,
    [switch]$SkipInfrastructure
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($JavaHome)) {
    throw "JAVA_HOME is not set. Pass -JavaHome 'C:\path\to\jdk-21' or set the JAVA_HOME environment variable."
}
$java = Join-Path $JavaHome "bin\java.exe"
if (-not (Test-Path $java)) {
    throw "java.exe was not found at $java"
}

$services = @(
    @{ Name = "auth-service"; Port = 8085 },
    @{ Name = "api-gateway"; Port = 8080 },
    @{ Name = "inventory-service"; Port = 8083 },
    @{ Name = "payment-service"; Port = 8082 },
    @{ Name = "order-service"; Port = 8081 },
    @{ Name = "live-service"; Port = 8084 },
    @{ Name = "delivery-service"; Port = 8086 }
)

foreach ($service in $services) {
    $jar = Join-Path $root ("{0}\build\libs\{0}-0.1.0.jar" -f $service.Name)
    if (-not (Test-Path $jar)) {
        throw "Missing $jar. Run .\gradlew assemble first."
    }
    $service.Jar = $jar
}

function Test-PortListening([int]$Port) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
    return $null -ne $listener
}

if (-not $SkipInfrastructure) {
    Write-Host "Starting PostgreSQL, Kafka and Jaeger containers..."
    docker compose -f (Join-Path $root "docker-compose.yml") up -d postgres-order postgres-payment postgres-inventory postgres-auth postgres-delivery kafka jaeger
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose up failed. Is Docker Desktop running?"
    }
}

foreach ($service in $services) {
    if (Test-PortListening $service.Port) {
        Write-Host ("{0,-18} already listening on {1}, skipped" -f $service.Name, $service.Port)
        continue
    }
    $command = "`$Host.UI.RawUI.WindowTitle = '{0}'; & '{1}' -jar '{2}'" -f $service.Name, $java, $service.Jar
    Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoExit", "-NoProfile", "-Command", $command) -WorkingDirectory $root | Out-Null
    Write-Host ("{0,-18} launched" -f $service.Name)
    Start-Sleep -Seconds 2
}

Write-Host "Waiting for every service to accept connections (up to $TimeoutSeconds s)..."
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$pending = @($services)
while ($pending.Count -gt 0 -and (Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 3
    $pending = @($pending | Where-Object { -not (Test-PortListening $_.Port) })
}

foreach ($service in $services) {
    $state = if (Test-PortListening $service.Port) { "UP" } else { "NOT READY" }
    Write-Host ("{0,-18} :{1}  {2}" -f $service.Name, $service.Port, $state)
}

if ($pending.Count -gt 0) {
    Write-Warning "Some services did not start in time. Check their windows for 'APPLICATION FAILED TO START'."
    exit 1
}

Write-Host ""
Write-Host "All services are up."
Write-Host "  Gateway   http://localhost:8080"
Write-Host "  Jaeger    http://localhost:16686"
Write-Host "  Frontend  cd frontend; npm run dev  ->  http://localhost:3000"
