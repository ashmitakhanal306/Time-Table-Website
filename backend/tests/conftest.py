import os
import sys

# Ensure the project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

# Set DATABASE_URL to a test database before database module is imported
db_path = os.path.join(os.path.dirname(__file__), "test_timetable.db")
os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

# Import engine AFTER setting the environment variable
from backend.database import engine, SessionLocal, Base
import pytest

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Create all tables and seed the database for tests."""
    from backend.seed import seed
    seed()
    yield
    # Cleanup after tests
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
        except PermissionError:
            pass # Windows lock issue

@pytest.fixture
def db():
    """Provide a database session for a test."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
