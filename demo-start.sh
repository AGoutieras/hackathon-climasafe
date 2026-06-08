#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
PYTHON_BIN="$ROOT_DIR/.venv/bin/python"
BACKEND_URL="http://127.0.0.1:8000"
DEMO_PORT="4175"

BACKEND_PID=""
DEMO_PID=""
NGROK_PID=""

cleanup() {
  echo ""
  echo "Shutting down..."
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "${DEMO_PID:-}"    ]] && kill "$DEMO_PID"    2>/dev/null || true
  [[ -n "${NGROK_PID:-}"   ]] && kill "$NGROK_PID"   2>/dev/null || true
}
trap cleanup EXIT INT TERM

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "Python venv not found at $PYTHON_BIN" >&2
  exit 1
fi

# ── Backend ────────────────────────────────────────────────────────────────
echo "Starting backend on http://127.0.0.1:8000 ..."
(cd "$BACKEND_DIR" && "$PYTHON_BIN" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload) &
BACKEND_PID=$!

echo "Waiting for backend to be ready ..."
until curl -fsS "$BACKEND_URL/api/health" >/dev/null 2>&1; do
  sleep 1
done

# ── Frontend build ─────────────────────────────────────────────────────────
echo "Building frontend ..."
(cd "$FRONTEND_DIR" && npm run build)

# ── Demo server ────────────────────────────────────────────────────────────
echo "Starting demo server on http://127.0.0.1:$DEMO_PORT ..."
(cd "$FRONTEND_DIR" && PORT="$DEMO_PORT" BACKEND_URL="$BACKEND_URL" node demo-server.mjs) &
DEMO_PID=$!

echo "Waiting for demo server to be ready ..."
until curl -fsS "http://127.0.0.1:$DEMO_PORT/" >/dev/null 2>&1; do
  sleep 1
done

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Demo server prêt !                                  ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Local : http://127.0.0.1:$DEMO_PORT                     ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Tunnel ngrok ───────────────────────────────────────────────────────────
if ! command -v ngrok &>/dev/null; then
  echo "⚠️  ngrok non trouvé."
  echo "   Installe-le : https://ngrok.com/download"
  echo "   Puis relance ce script."
  wait $BACKEND_PID 2>/dev/null || true
  exit 0
fi

echo "Lancement du tunnel ngrok..."
ngrok http "$DEMO_PORT" --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

# Attend jusqu'à 15s que l'URL soit dispo via l'API ngrok
NGROK_URL=""
for i in $(seq 1 15); do
  NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null \
    | grep -o '"public_url":"https://[^"]*' \
    | head -1 \
    | cut -d'"' -f4) || true
  [[ -n "$NGROK_URL" ]] && break
  sleep 1
done

if [[ -n "$NGROK_URL" ]]; then
  echo ""
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║  ✅ Tunnel public ngrok actif !                      ║"
  echo "╠══════════════════════════════════════════════════════╣"
  echo "║  $NGROK_URL"
  echo "║                                                      ║"
  echo "║  Ouvre cette URL sur n'importe quel mobile 📱        ║"
  echo "║  Ctrl+C pour tout arrêter                            ║"
  echo "╚══════════════════════════════════════════════════════╝"
  echo ""
else
  echo "⚠️  ngrok n'a pas retourné d'URL dans les temps."
  echo "   Vérifie ton authtoken : ngrok config add-authtoken TON_TOKEN"
  echo "   Ou lance manuellement : ngrok http $DEMO_PORT"
fi

wait $BACKEND_PID 2>/dev/null || true