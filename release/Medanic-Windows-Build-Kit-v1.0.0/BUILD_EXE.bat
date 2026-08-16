@echo off
title Medanic - Build EXE
color 0E
cls

echo.
echo  ====================================================
echo         Medanic - Build Standalone EXE
echo         بناء ملف EXE محمي للتوزيع
echo  ====================================================
echo.
echo  Folder: %~dp0
echo.
pause

REM ── 1. التحقق من Python ─────────────────────────────────
echo.
echo  [1/5] Checking Python...
python --version
if errorlevel 1 (
    color 0C
    echo  ERROR: Python is not installed
    pause
    exit /b 1
)
echo       OK
echo.

REM ── 2. التحقق من الملفات المطلوبة ───────────────────────
echo  [2/5] Checking required files...
if not exist "driving_school_single.py" (
    color 0C
    echo  ERROR: driving_school_single.py not found
    pause
    exit /b 1
)
if not exist "license_guard.py" (
    color 0C
    echo  ERROR: license_guard.py not found
    pause
    exit /b 1
)
if not exist "medanic_icon.ico" (
    color 0C
    echo  ERROR: medanic_icon.ico not found
    pause
    exit /b 1
)
echo       OK
echo.

REM ── 3. تثبيت PyInstaller والمكتبات ──────────────────────
echo  [3/5] Installing PyInstaller and libraries (2-3 min)...
pip install --upgrade pyinstaller reportlab arabic-reshaper python-bidi pillow
if errorlevel 1 (
    color 0C
    echo  ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo       OK
echo.

REM ── 4. حذف البناء القديم ────────────────────────────────
echo  [4/5] Cleaning old build...
if exist "build" rmdir /S /Q "build"
if exist "dist" rmdir /S /Q "dist"
if exist "Medanic.spec" del /Q "Medanic.spec"
echo       OK
echo.

REM ── 5. بناء ملف EXE ─────────────────────────────────────
echo  [5/5] Building Medanic.exe (3-5 minutes, please wait)...
echo.

pyinstaller --onefile --windowed ^
    --name Medanic ^
    --icon medanic_icon.ico ^
    --add-data "medanic_icon.ico;." ^
    --add-data "medanic_logo.png;." ^
    --add-data "license_guard.py;." ^
    --hidden-import license_guard ^
    --hidden-import reportlab ^
    --hidden-import reportlab.pdfgen ^
    --hidden-import reportlab.pdfbase ^
    --hidden-import reportlab.pdfbase.ttfonts ^
    --hidden-import reportlab.lib ^
    --hidden-import reportlab.lib.pagesizes ^
    --hidden-import reportlab.platypus ^
    --hidden-import arabic_reshaper ^
    --hidden-import bidi ^
    --hidden-import bidi.algorithm ^
    --hidden-import PIL ^
    --hidden-import PIL.Image ^
    --hidden-import sqlite3 ^
    --hidden-import tkinter ^
    --hidden-import tkinter.ttk ^
    --hidden-import tkinter.messagebox ^
    --hidden-import tkinter.filedialog ^
    driving_school_single.py

if errorlevel 1 (
    color 0C
    echo.
    echo  ERROR: Build failed - check messages above
    pause
    exit /b 1
)

if not exist "dist\Medanic.exe" (
    color 0C
    echo  ERROR: Medanic.exe was not created
    pause
    exit /b 1
)

REM ── حساب الحجم ──────────────────────────────────────────
for %%A in ("dist\Medanic.exe") do set SIZE=%%~zA
set /a SIZE_MB=%SIZE% / 1048576

color 0A
echo.
echo  ====================================================
echo            ✔  BUILD SUCCESSFUL
echo            ✔  تم البناء بنجاح
echo  ====================================================
echo.
echo   📦 File: dist\Medanic.exe
echo   📏 Size: %SIZE_MB% MB
echo.
echo   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   هذا الملف الوحيد الذي ترسله للعملاء
echo   لا يحتاج Python على جهاز العميل
echo   الكود محمي تماماً داخل الملف
echo   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
pause
