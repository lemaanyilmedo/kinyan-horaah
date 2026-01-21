@echo off
echo ========================================
echo Firebase Deployment Script
echo ========================================
echo.

echo Step 1: Login to Firebase
npx firebase-tools login
if %errorlevel% neq 0 (
    echo ERROR: Login failed
    pause
    exit /b 1
)

echo.
echo Step 2: Initialize Firebase (if needed)
if not exist .firebaserc (
    echo Initializing Firebase project...
    npx firebase-tools init
)

echo.
echo Step 3: Deploy to Firebase Hosting
npx firebase-tools deploy --only hosting
if %errorlevel% neq 0 (
    echo ERROR: Deployment failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo Deployment completed successfully!
echo ========================================
pause
