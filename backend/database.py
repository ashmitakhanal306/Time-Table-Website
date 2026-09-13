import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.models import Base

# SQLite fallback path — use /tmp for any cloud environment (ephemeral FS)
_is_cloud = any(os.environ.get(v) for v in ("RAILWAY_ENVIRONMENT", "VERCEL", "AWS_LAMBDA_FUNCTION_NAME", "RENDER"))
DB_PATH = "/tmp/timetable.db" if _is_cloud else os.path.join(os.path.dirname(__file__), "timetable.db")
_sqlite_url = f"sqlite:///{DB_PATH}"

# Use DATABASE_URL if set AND non-empty; otherwise fall back to SQLite
raw_db_url = os.environ.get("DATABASE_URL") or _sqlite_url
# Render/Railway sometimes use postgres:// scheme — SQLAlchemy needs postgresql://
if raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)

SQLALCHEMY_DATABASE_URL = raw_db_url
print(f"[DB] Using: {SQLALCHEMY_DATABASE_URL[:60]}...")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

if __name__ == "__main__":
    print("[Database] Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("[Database] Tables created successfully.")
