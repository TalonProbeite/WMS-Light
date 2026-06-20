# Берем официальный Python с Docker Hub
FROM python:3.12-slim

# Копируем бинарник uv прямо из официального образа (это работает везде и мега-надежно)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Если COPY --from выше тоже выдаст ошибку сети, то альтернативный 100% рабочий вариант:
# RUN pip install --no-cache-dir uv

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# Копируем файлы зависимостей
COPY pyproject.toml uv.lock* requirements.txt* ./

# Устанавливаем зависимости
RUN if [ -f uv.lock ]; then uv sync --frozen --no-dev; \
    elif [ -f requirements.txt ]; then uv pip install --system --no-cache-dir -r requirements.txt; \
    else echo "No dependency file found" && exit 1; fi

COPY . .

EXPOSE 8000

CMD ["uv", "run", "python", "run.py"]