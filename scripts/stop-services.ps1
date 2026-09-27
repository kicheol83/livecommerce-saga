param(
    [switch]$Infrastructure
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$pattern = "(auth-service|api-gateway|order-service|payment-service|inventory-service|live-service|delivery-service)-0\.1\.0\.jar"

$processes = @(Get-CimInstance Win32_Process -Filter "Name = 'java.exe'" | Where-Object { $_.CommandLine -match $pattern })
if ($processes.Count -eq 0) {
    Write-Host "No LiveCommerce services are running."
} else {
    foreach ($process in $processes) {
        $name = [regex]::Match($process.CommandLine, $pattern).Groups[1].Value
        Stop-Process -Id $process.ProcessId -Force
        Write-Host ("{0,-18} stopped (pid {1})" -f $name, $process.ProcessId)
    }
}

if ($Infrastructure) {
    Write-Host "Stopping PostgreSQL, Kafka and Jaeger containers..."
    docker compose -f (Join-Path $root "docker-compose.yml") stop
}
