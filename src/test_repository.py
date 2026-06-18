from src.repository import Repository

repo = Repository()

report = {

    "prediction": "Fraudulent",

    "fraud_probability": 92.3,

    "risk_score": 88.4,

    "confidence": "Very High"

}

scan = repo.save_scan(report)

print(scan.id)

repo.close()