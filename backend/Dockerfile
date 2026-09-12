FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Note: seeding is handled by on_startup in main.py (only seeds if DB is empty)
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
