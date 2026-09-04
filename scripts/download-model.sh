#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODELS_DIR="${ROOT}/models"
MODEL_FILE="${MODELS_DIR}/Qwen_Qwen3-0.6B-Q4_K_M.gguf"
REPO="bartowski/Qwen_Qwen3-0.6B-GGUF"
FILENAME="Qwen_Qwen3-0.6B-Q4_K_M.gguf"
URL="https://huggingface.co/${REPO}/resolve/main/${FILENAME}"

mkdir -p "${MODELS_DIR}"

if [[ -f "${MODEL_FILE}" ]]; then
  if head -c 4 "${MODEL_FILE}" | grep -q "GGUF"; then
    echo "Model already present: ${MODEL_FILE}"
    ls -lh "${MODEL_FILE}"
    exit 0
  fi
  echo "Removing invalid model file (not GGUF): ${MODEL_FILE}"
  rm -f "${MODEL_FILE}"
fi

echo "Downloading ${FILENAME} (~484 MB)..."
echo "Source: ${URL}"

if command -v huggingface-cli >/dev/null 2>&1; then
  huggingface-cli download "${REPO}" "${FILENAME}" --local-dir "${MODELS_DIR}"
elif command -v curl >/dev/null 2>&1; then
  curl -L --fail --progress-bar -o "${MODEL_FILE}" "${URL}"
else
  echo "Install curl or huggingface-cli to download the model." >&2
  exit 1
fi

if ! head -c 4 "${MODEL_FILE}" | grep -q "GGUF"; then
  echo "Download failed: file is not a valid GGUF model." >&2
  head -c 80 "${MODEL_FILE}" || true
  echo
  rm -f "${MODEL_FILE}"
  exit 1
fi

echo "Done."
ls -lh "${MODEL_FILE}"
echo
echo "Set in .env:"
echo "LLM_MODEL_PATH=/models/Qwen_Qwen3-0.6B-Q4_K_M.gguf"
