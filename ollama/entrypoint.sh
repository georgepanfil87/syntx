#!/usr/bin/env sh

set -eu

ollama serve &
SERVER_PID=$!

trap 'kill -TERM "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID"' INT TERM

i=0
until ollama list >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "[ollama-bootstrap] server did not become ready within 60s — aborting." >&2
    kill "$SERVER_PID" 2>/dev/null || true
    exit 1
  fi
  sleep 1
done


MODELS=$(echo "${OLLAMA_PULL_MODELS:-}" | tr ',' ' ')
if [ -n "$MODELS" ]; then
  echo "[ollama-bootstrap] ensuring models: $MODELS"
  for model in $MODELS; do
    [ -z "$model" ] && continue
    echo "[ollama-bootstrap] pull → $model"
    if ! ollama pull "$model"; then
      echo "[ollama-bootstrap] ⚠ failed to pull $model — continuing." >&2
    fi
  done
  echo "[ollama-bootstrap] all pulls done."
else
  echo "[ollama-bootstrap] OLLAMA_PULL_MODELS empty — skipping auto-pull."
fi

wait "$SERVER_PID"
