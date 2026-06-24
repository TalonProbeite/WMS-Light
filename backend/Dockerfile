
FROM python:3.12-slim


COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app



ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy


COPY pyproject.toml uv.lock* requirements.txt* ./


RUN if [ -f uv.lock ]; then uv sync --frozen --no-dev; \
    elif [ -f requirements.txt ]; then uv pip install --system --no-cache-dir -r requirements.txt; \
    else echo "No dependency file found" && exit 1; fi

COPY . .

EXPOSE 8000

CMD ["uv", "run", "python", "run.py"]