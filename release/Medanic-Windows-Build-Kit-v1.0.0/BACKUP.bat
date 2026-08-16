@echo off
title Medanic Backup
color 0B
cls

echo.
echo  ====================================================
echo            Medanic - Backup Database
echo            النسخ الاحتياطي لقاعدة البيانات
echo  ====================================================
echo.

set "APP_DIR=%~dp0"
set "APP_DIR=%APP_DIR:~0,-1%"
set "DATA_ROOT=%LOCALAPPDATA%"
if not defined DATA_ROOT set "DATA_ROOT=%APPDATA%"
if not defined DATA_ROOT set "DATA_ROOT=%USERPROFILE%"
set "DATA_DIR=%DATA_ROOT%\Medanic"
set "DB_FILE=%DATA_DIR%\driving_school.db"
set "BACKUP_DIR=%DATA_DIR%\Backups"
if not exist "%DB_FILE%" if exist "%APP_DIR%\driving_school.db" set "DB_FILE=%APP_DIR%\driving_school.db"

REM ── التحقق من وجود قاعدة البيانات ───────────────────────
if not exist "%DB_FILE%" (
    color 0C
    echo  ❌ ERROR: driving_school.db not found
    echo     لم يتم العثور على قاعدة البيانات
    echo.
    echo     Path: %DB_FILE%
    echo.
    pause
    exit /b 1
)

REM ── إنشاء مجلد النسخ الاحتياطية ─────────────────────────
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM ── توليد اسم الملف بتاريخ اليوم ─────────────────────────
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set DT=%%I
set "STAMP=%DT:~0,4%-%DT:~4,2%-%DT:~6,2%_%DT:~8,2%h%DT:~10,2%"
set "BACKUP_FILE=%BACKUP_DIR%\driving_school_%STAMP%.db"

echo  📂 Source : %DB_FILE%
echo  💾 Target : %BACKUP_FILE%
echo.
echo  Copying... جاري النسخ...
copy /Y "%DB_FILE%" "%BACKUP_FILE%" >nul

if errorlevel 1 (
    color 0C
    echo  ❌ Backup failed - فشل النسخ
    pause
    exit /b 1
)

REM ── حساب حجم الملف ───────────────────────────────────────
for %%A in ("%BACKUP_FILE%") do set SIZE=%%~zA
set /a SIZE_KB=%SIZE% / 1024

echo.
echo  ====================================================
echo            ✔  BACKUP SUCCESSFUL
echo            ✔  تم النسخ الاحتياطي بنجاح
echo  ====================================================
echo.
echo   📦 File saved: driving_school_%STAMP%.db
echo   📏 Size: %SIZE_KB% KB
echo   📁 Location: %BACKUP_DIR%
echo.
echo   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   💡 احتفظ بنسخة على USB أو Google Drive للأمان
echo   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
pause
