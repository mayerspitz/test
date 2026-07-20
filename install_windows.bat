@echo off
setlocal
title PhotoRounds installer
cd /d "%~dp0"

echo.
echo  PhotoRounds one-time setup
echo  ==========================
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo  Python is not installed yet. Opening the download page...
    start "" https://www.python.org/downloads/
    echo.
    echo  1. Install Python from the page that just opened.
    echo     IMPORTANT: tick "Add python.exe to PATH" on the first screen.
    echo  2. Then double-click this file again.
    echo.
    pause
    exit /b 1
)

echo  Creating the app environment (one-time, please wait)...
if not exist .venv (
    python -m venv .venv
    if errorlevel 1 goto :err
)

echo  Installing PhotoRounds and photo format support...
.venv\Scripts\python -m pip install --upgrade pip --quiet
.venv\Scripts\pip install -e .[all] --quiet
if errorlevel 1 (
    echo  Full install failed, retrying without optional RAW/HEIC extras...
    .venv\Scripts\pip install -e . --quiet
    if errorlevel 1 goto :err
)

echo  Creating the Desktop shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\PhotoRounds.lnk');" ^
  "$s.TargetPath='%~dp0.venv\Scripts\pythonw.exe';" ^
  "$s.Arguments='-m photorounds';" ^
  "$s.WorkingDirectory='%~dp0';" ^
  "$s.Description='PhotoRounds - offline photo and video organizer';" ^
  "$s.Save()"

echo.
echo  ==========================================================
echo  Done! Double-click the "PhotoRounds" icon on your Desktop.
echo  ==========================================================
echo.
echo  Optional (recommended) free helpers - the app works without them:
echo    - ExifTool  (better dates for RAW and video): https://exiftool.org
echo    - ffmpeg    (video conversion to MP4):  winget install ffmpeg
echo.
pause
exit /b 0

:err
echo.
echo  Something went wrong - see the messages above.
echo  You can also try the ready-made PhotoRounds.exe from the project's
echo  GitHub "Releases" page instead (no Python needed).
pause
exit /b 1
