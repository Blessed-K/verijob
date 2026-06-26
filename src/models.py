from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import Float
from sqlalchemy import String
from sqlalchemy import DateTime

from datetime import datetime, timezone

from src.database import Base


class JobScan(Base):

    __tablename__ = "job_scans"

    id = Column(Integer, primary_key=True, index=True)

    prediction = Column(String)

    fraud_probability = Column(Float)

    job_text = Column(String)

    risk_score = Column(Float)

    confidence = Column(String)

    scanned_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc)
    )