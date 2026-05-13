
FROM ollama/ollama:latest

ENV OLLAMA_PULL_MODELS="qwen2.5-coder:1.5b nomic-embed-text"

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["serve"]
