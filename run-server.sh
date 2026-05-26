#!/usr/bin/env bash
# Mino Bimaadiziwin Community Atlas — POSIX start script
set -e
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

echo "Installing/updating dependencies..."
python -m pip install --quiet --disable-pip-version-check -r server/requirements.txt

echo
echo "Mino Bimaadiziwin Atlas is starting on http://localhost:${PORT:-8000}"
echo "  Dashboard: http://localhost:${PORT:-8000}/"
echo "  CMS:       http://localhost:${PORT:-8000}/cms"
echo "  API docs:  http://localhost:${PORT:-8000}/docs"
echo
exec python -m server.main
