
# RUN:.\kill-port.ps1 -Port 7233.
param(
    [int]$Port = 7233
)

Write-Host "Looking for processes using port $Port..."

# Get all PIDs using the port
$processIds = netstat -ano | Select-String ":$Port" | ForEach-Object {
    ($_ -split '\s+')[-1]
} | Where-Object { $_ -match '^\d+$' } | Sort-Object -Unique

if ($processIds.Count -eq 0) {
    Write-Host "No processes found using port $Port."
} else {
    Write-Host "Found processes: $($processIds -join ', ')"
    foreach ($processId in $processIds) {
        try {
            # Skip PID 0 (system process)
            if ($processId -eq "0") {
                Write-Host "Skipping system process (PID 0)"
                continue
            }
            
            Stop-Process -Id $processId -Force -ErrorAction Stop
            Write-Host "✅ Killed process $processId"
        } catch {
            Write-Host "❌ Could not kill process $processId (may have already exited)"
        }
    }
}

Write-Host "`nPort $Port should now be free!" 