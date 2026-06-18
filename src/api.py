from fastapi import FastAPI
from pydantic import BaseModel, field_validator
import joblib
from pathlib import Path
from fastapi import HTTPException 

from src.risk_engine import RiskEngine

MODEL_PATH = Path("outputs/models/xgboost_model.pkl")

app = FastAPI(title="VeriJob Fraud Detection API")

model = joblib.load(MODEL_PATH)
risk_engine = RiskEngine(model)


class JobPost(BaseModel):
    job_text: str

    @field_validator("job_text")
    @classmethod
    def validate_job_text(cls, value):
        value = value.strip()

        if len(value) < 20:
            raise ValueError("Job text is too short to analyze")
        
        if len(value) > 20000:
            raise ValueError("Job text is too long to analyze")
        
        return value


@app.get("/")
def home():
    return {
        "message": "VeriJob Fraud Detection API is running"
    }


@app.post("/predict")
def predict_job(post: JobPost):

    try:
        return risk_engine.analyze(post.job_text)
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )

  