from src.database import SessionLocal
from src.models import JobScan


class Repository:

    def __init__(self):
        self.db = SessionLocal()

    def close(self):
        self.db.close()
    
    def save_scan(self, report):

        scan = JobScan(

            prediction=report["prediction"],

            fraud_probability=report["fraud_probability"],

            risk_score=report["risk_score"],

            confidence=report["confidence"]

        )

        self.db.add(scan)

        self.db.commit()

        self.db.refresh(scan)

        return scan
    
    def get_recent_scans(self, limit=10):

        return (

            self.db.query(JobScan)

            .order_by(JobScan.scanned_at.desc())

            .limit(limit)

            .all()

        )