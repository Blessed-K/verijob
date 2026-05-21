from fastapi import FastAPI
from pydantic import BaseModel, field_validator
import joblib
from pathlib import Path

from src.domain_checker import check_job_post

MODEL_PATH = Path("outputs/models/xgboost_model.pkl")

app = FastAPI(title="VeriJob Fraud Detection API")

model = joblib.load(MODEL_PATH)


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
    text = post.job_text.lower().strip()

    probability = model.predict_proba([text])[0]
    fraud_confidence = float(probability[1])

    domain_result = check_job_post(text)

    if fraud_confidence >= 0.70:
        result = "Fraudulent"
    elif fraud_confidence >= 0.40:
        result = "Suspicious"
    else:
        result = "Legitimate"

    if domain_result["domain_risk"] == "Suspicious" and result == "Legitimate":
        result = "Suspicious"

    return {
        "prediction": result,
        "fraud_probability": round(fraud_confidence * 100, 2),
        "domain_analysis": domain_result
    }