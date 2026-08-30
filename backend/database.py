import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.models import Base

# By default, use SQLite in the current directory if DATABASE_URL is not set
DB_PATH = os.path.join(os.path.dirname(__file__), "timetable.db")
SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{DB_PATH}")

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
