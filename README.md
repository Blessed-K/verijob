# VeriJob

VeriJob is a browser-based recruitment fraud detection system that helps job seekers identify potentially fraudulent job advertisements before applying.

The system combines Machine Learning with a Rule-Based Detection Engine to provide explainable fraud analysis directly from a Chrome Extension.

---

## Features

- Hybrid fraud detection (Machine Learning + Rule Engine)
- Chrome Extension built with React
- FastAPI REST API
- XGBoost fraud classification model
- Rule-based fraud detection
- Domain verification
- Risk scoring
- Fraud probability estimation
- PostgreSQL database
- Cloud deployment using Render

---

## Technology Stack

### Frontend

- React
- TypeScript
- Tailwind CSS
- Chrome Extension (Manifest V3)

### Backend

- FastAPI
- SQLAlchemy
- PostgreSQL
- XGBoost
- Scikit-learn
- Pandas

---

## System Architecture

Chrome Extension

↓

FastAPI REST API

↓

Hybrid Fraud Detection Engine

├── Machine Learning Model

├── Rule Engine

└── Domain Checker

↓

PostgreSQL Database

---

## Machine Learning

The fraud detection model was trained using an XGBoost classifier with TF-IDF vectorization on labelled job advertisements.

The Machine Learning model performs the primary fraud classification while the Rule Engine identifies explicit fraud indicators to improve explainability.

---

## API Endpoint

POST

```
/predict
```

Example Request

```json
{
  "job_text": "Paste a job advertisement here..."
}
```

---

## Running Locally

Clone the repository

```bash
git clone https://github.com/Blessed-K/verijob.git
```

Install dependencies

```bash
pip install -r requirements.txt
```

Run the API

```bash
uvicorn src.api:app --reload
```

---

## Deployment

Backend is deployed using Render.

Database uses PostgreSQL.

Frontend is a React-based Chrome Extension.

---

## Author

Blessed Kimani

Bachelor of Technology in Information Technology

Final Year Project