# School Timetable System

A full-stack web application for automatically generating conflict-free school timetables.

## Local Development (Without Docker)

### Backend (Python/FastAPI)

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # macOS/Linux
   source venv/bin/activate
   ```
3. Install requirements:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the development server:
   ```bash
   uvicorn backend.main:app --reload
   ```

### Frontend (React/Vite)

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## Production / Full Stack (Docker Compose)

1. Run the entire stack (Postgres, Backend, Frontend) using Docker Compose:
   ```bash
   docker-compose up --build
   ```
2. Access the frontend at `http://localhost:5173`.
3. Access the backend API at `http://localhost:8000`.
