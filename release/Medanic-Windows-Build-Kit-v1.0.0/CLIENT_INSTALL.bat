@echo off
title Medanic - Setup
color 0A
cls

echo.
echo  ====================================================
echo            تثبيت برنامج ميدانيك
echo  ====================================================
echo.

set "APP_DIR=%~dp0"
set "APP_DIR=%APP_DIR:~0,-1%"
set "EXE_FILE=%APP_DIR%\Medanic.exe"

if not exist "%EXE_FILE%" (
    color 0C
    echo  ❌ ERROR: Medanic.exe not found
    echo     ضع Medanic.exe في نفس مجلد هذا الملف
    pause
    exit /b 1
)

echo  📂 Folder: %APP_DIR%
echo.
echo  Creating Desktop shortcut...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $desk = [Environment]::GetFolderPath('Desktop'); $lnk = $ws.CreateShortcut(\"$desk\Medanic.lnk\"); $lnk.TargetPath = '%EXE_FILE%'; $lnk.WorkingDirectory = '%APP_DIR%'; $lnk.IconLocation = '%EXE_FILE%'; $lnk.Description = 'Medanic - Driving School Management'; $lnk.Save()"

if errorlevel 1 (
    color 0C
    echo  ❌ Failed to create shortcut
    pause
    exit /b 1
)

echo.
echo  ====================================================
echo            ✔  TERMINÉ - تم بنجاح
echo  ====================================================
echo.
echo   ابحث عن أيقونة "Medanic" على سطح المكتب
echo   انقر عليها مرتين لفتح البرنامج
echo.
pause
