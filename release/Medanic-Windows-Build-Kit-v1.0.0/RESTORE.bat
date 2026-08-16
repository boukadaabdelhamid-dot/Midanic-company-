@echo off
title Medanic Restore
color 0E
cls

echo.
echo  ====================================================
echo            Medanic - Restore Database
echo            استعادة قاعدة البيانات
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

if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

if not exist "%BACKUP_DIR%" (
    color 0C
    echo  ❌ No backups folder found
    echo     لا يوجد مجلد نسخ احتياطية
    pause
    exit /b 1
)

echo  ⚠  WARNING - تحذير
echo  ─────────────────────────────────────────────────
echo  هذه العملية ستستبدل قاعدة البيانات الحالية
echo  بنسخة احتياطية قديمة.
echo  تأكد أن البرنامج مغلق قبل المتابعة!
echo.
echo  Available backups - النسخ المتوفرة:
echo  ─────────────────────────────────────────────────
dir /B /O-D "%BACKUP_DIR%\*.db"
echo  ─────────────────────────────────────────────────
echo.

set /p "CHOICE=اكتب اسم ملف النسخة (مثال: driving_school_2026-05-03_14h30.db): "

if not exist "%BACKUP_DIR%\%CHOICE%" (
    color 0C
    echo.
    echo  ❌ File not found - الملف غير موجود
    pause
    exit /b 1
)

REM ── حفظ نسخة من القاعدة الحالية قبل الاستبدال ───────────
if exist "%DB_FILE%" (
    copy /Y "%DB_FILE%" "%DB_FILE%.before_restore" >nul
    echo  💾 Saved current DB as: driving_school.db.before_restore
)

copy /Y "%BACKUP_DIR%\%CHOICE%" "%DB_FILE%" >nul

if errorlevel 1 (
    color 0C
    echo  ❌ Restore failed
    pause
    exit /b 1
)

echo.
echo  ====================================================
echo            ✔  RESTORE SUCCESSFUL
echo            ✔  تمت الاستعادة بنجاح
echo  ====================================================
echo.
echo   افتح البرنامج الآن لرؤية البيانات المستعادة
echo.
pause
