#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
PYTHON_BIN="$ROOT_DIR/.venv/bin/python"
BACKEND_URL="http://127.0.0.1:8000"
DEMO_PORT="4175"

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi

  if [[ -n "${DEMO_PID:-}" ]] && kill -0 "$DEMO_PID" 2>/dev/null; then
    kill "$DEMO_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "Python venv not found at $PYTHON_BIN" >&2
  exit 1
fi

echo "Starting backend on http://127.0.0.1:8000 ..."
(cd "$BACKEND_DIR" && "$PYTHON_BIN" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload) &
BACKEND_PID=$!

echo "Waiting for backend to be ready ..."
until curl -fsS "$BACKEND_URL/api/health" >/dev/null 2>&1; do
  sleep 1
done

echo "Building frontend ..."
(cd "$FRONTEND_DIR" && npm run build)

echo "Starting demo server on http://127.0.0.1:$DEMO_PORT ..."
(cd "$FRONTEND_DIR" && PORT="$DEMO_PORT" BACKEND_URL="$BACKEND_URL" node demo-server.mjs) &
DEMO_PID=$!

echo "Waiting for demo server to be ready ..."
until curl -fsS "http://127.0.0.1:$DEMO_PORT/" >/dev/null 2>&1; do
  sleep 1
done

echo "Opening public tunnel ..."
cd "$FRONTEND_DIR"
npx --yes localtunnel --port "$DEMO_PORT" --local-host 127.0.0.1