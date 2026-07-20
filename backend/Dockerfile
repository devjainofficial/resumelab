# ResumeLab API. Runs identically on Render (x86) and Oracle ARM (aarch64):
# python:3.11-slim is multi-arch, and every dependency has wheels for both.
FROM python:3.11-slim

# WeasyPrint native deps (the real PDF engine in production).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangocairo-1.0-0 libharfbuzz0b fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
