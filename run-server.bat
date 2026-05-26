@echo off
REM Mino Bimaadiziwin Community Atlas — Windows start script
setlocal
cd /d %~dp0

if not exist .venv (
  echo Creating Python virtual environment...
  python -m venv .venv
)

call .venv\Scripts\activate.bat

echo Installing/updating dependencies...
python -m pip install --quiet --disable-pip-version-check -r server\requirements.txt

echo.
echo Mino Bimaadiziwin Atlas is starting on http://localhost:8000
echo   Dashboard: http://localhost:8000/
echo   CMS:       http://localhost:8000/cms
echo   API docs:  http://localhost:8000/docs
echo.
python -m server.main
