#!/bin/bash

# Script pour démarrer le serveur LLM local avec vLLM
# Il faut avoir vLLM installé et que le modèle soit téléchargé

MODEL_ID="neuralmagic/Meta-Llama-3.1-8B-Instruct-FP8"
PORT=8000

echo "Démarrage du serveur LLM local avec vLLM..."
python3 -m vllm.entrypoints.openai.api_server \
  --model "$MODEL_ID" \
  --port "$PORT"