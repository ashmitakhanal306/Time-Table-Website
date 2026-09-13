FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (layer caching)
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy entire project
COPY . .

# Set PYTHONPATH so `backend.` imports resolve
ENV PYTHONPATH=/app

# Use $PORT from Railway (default 8000 for local)
CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}
