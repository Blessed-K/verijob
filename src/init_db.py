from src.database import engine
from src.models import Base

Base.metadata.create_all(bind=engine)

print("Database created successfully.")