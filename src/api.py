from fastapi import FastAPI
from pydantic import BaseModel
import joblib
from pathlib import Path

MODEL_PATH = Path("outputs/models/xgboost_model.pkl")

app = FastAPI(title="VeriJob Fraud Detection API")

model = joblib.load(MODEL_PATH)


class JobPost(BaseModel):
    job_text: str


@app.get("/")
def home():
    return {
        "message": "VeriJob Fraud Detection API is running"
    }


@app.post("/predict")
def predict_job(post: JobPost):
    text = post.job_text.lower().strip()

    probability = model.predict_proba([text])[0]
    fraud_confidence = float(probability[1] * 100)

    if fraud_confidence >= 0.70:
        result = "Fraudulent"
    elif fraud_confidence >= 0.40:
        result = "Suspicious"
    else:
        result = "Legitimate"

    return {
        "prediction": result,
        "fraud_probability": round(fraud_confidence, 2)
    }