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

cleanup() {
  echo ""
  echo "Shutting down..."
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

# ── IP locale (toujours dispo) ─────────────────────────────────────────────
LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Demo server prêt !                                  ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Local  : http://127.0.0.1:$DEMO_PORT                    ║"
if [[ -n "$LOCAL_IP" ]]; then
echo "║  Réseau : http://$LOCAL_IP:$DEMO_PORT                ║"
fi
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Tunnel public (optionnel) ──────────────────────────────────────────────
cd "$FRONTEND_DIR"

echo "Tentative de tunnel public via localtunnel..."

# Fichier temporaire pour capturer la sortie du tunnel
TUNNEL_LOG=$(mktemp)

# Lance localtunnel UNE SEULE FOIS en arrière-plan, redirige sa sortie
npx --yes localtunnel --port "$DEMO_PORT" --local-host 127.0.0.1 >"$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

# Attend jusqu'à 10s que l'URL apparaisse dans la sortie
TUNNEL_URL=""
for i in $(seq 1 10); do
  TUNNEL_URL=$(grep -o 'https://[^ ]*' "$TUNNEL_LOG" 2>/dev/null | head -1) || true
  [[ -n "$TUNNEL_URL" ]] && break
  sleep 1
done

rm -f "$TUNNEL_LOG"

if [[ -n "$TUNNEL_URL" ]] && kill -0 "$TUNNEL_PID" 2>/dev/null; then
  echo ""
  echo "✅ Tunnel public : $TUNNEL_URL"
  echo ""
  echo "   Ouvre cette URL sur ton mobile ⬆️"
  echo "   (appuie sur Ctrl+C pour arrêter)"
  echo ""
  wait $TUNNEL_PID 2>/dev/null || true
elif command -v ngrok &>/dev/null; then
  echo "localtunnel indisponible, lancement de ngrok..."
  kill "$TUNNEL_PID" 2>/dev/null || true
  ngrok http "$DEMO_PORT" &
  NGROK_PID=$!
  sleep 3
  NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null \
    | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4) || true
  if [[ -n "$NGROK_URL" ]]; then
    echo ""
    echo "✅ Tunnel public (ngrok) : $NGROK_URL"
    echo ""
  fi
  wait $NGROK_PID 2>/dev/null || true
else
  kill "$TUNNEL_PID" 2>/dev/null || true
  echo ""
  echo "⚠️  Tunnel public indisponible."
  echo "   Sur mobile (même WiFi) : http://$LOCAL_IP:$DEMO_PORT"
  echo ""
  echo "   Pour un tunnel public : https://ngrok.com/download"
  echo ""
  wait $BACKEND_PID 2>/dev/null || true
fi