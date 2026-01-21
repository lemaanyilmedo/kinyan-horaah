# Quick Firebase Deployment Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Firebase Quick Deploy" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Firebase CLI is available
Write-Host "Checking Firebase CLI..." -ForegroundColor Yellow
$firebaseVersion = npx firebase-tools --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Firebase CLI found (version $firebaseVersion)" -ForegroundColor Green
} else {
    Write-Host "✗ Firebase CLI not found" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 1: Login to Firebase" -ForegroundColor Yellow
npx firebase-tools login --no-localhost

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Login failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Deploy to Firebase Hosting" -ForegroundColor Yellow
npx firebase-tools deploy --only hosting

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✓ Deployment completed successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "✗ Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
