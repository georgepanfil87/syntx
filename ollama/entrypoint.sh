#!/usr/bin/env sh

set -e

ollama serve &
SERVER_PID=$!

cleanup() {
  kill -TERM "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID"
}

trap cleanup INT TERM

echo "[ollama-bootstrap] waiting for ollama server..."

i=0
until ollama list >/dev/null 2>&1; do
  i=$((i + 1))

  if [ "$i" -ge 60 ]; then
    echo "[ollama-bootstrap] server not ready after 60s"
    cleanup
    exit 1
  fi

  sleep 1
done

echo "[ollama-bootstrap] server ready"

IFS=','

for model in ${OLLAMA_PULL_MODELS:-}; do
  model="$(echo "$model" | xargs)"

  [ -z "$model" ] && continue

  echo "[ollama-bootstrap] pulling: $model"

  ollama pull "$model" || {
    echo "[ollama-bootstrap] failed: $model"
    continue
  }

  echo "[ollama-bootstrap] installed: $model"
done

unset IFS

echo "[ollama-bootstrap] installed models:"
ollama list

wait "$SERVER_PID"