# DigiCertify Start Script
Write-Host "Starting DigiCertify Full-Stack Application..." -ForegroundColor Cyan

# Start Backend
Write-Host "Launching Backend (Port 5000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; node index.js"

# Wait a few seconds for backend to initialize
Start-Sleep -Seconds 2

# Start Frontend
Write-Host "Launching Frontend (Vite)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "Both services are starting in separate windows." -ForegroundColor Magenta
Write-Host "Backend: http://localhost:5000"
Write-Host "Frontend: http://localhost:5173"
