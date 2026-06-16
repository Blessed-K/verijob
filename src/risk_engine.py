from src.rule_engine import evaluate_rules
from src.domain_checker import check_job_post


class RiskEngine:

    def __init__(self, model):
        self.model = model

    def analyze(self, text: str):

        text = text.strip().lower()

        # Machine Learning Analysis
        probability = self.model.predict_proba([text])[0][1]

        ml_score = probability * 100

        # Rule Analysis
        rule_result = evaluate_rules(text)

        # Domain Analysis
        domain_result = check_job_post(text)

        # Company Analysis
        company_result = {
            "risk_score": 0,
            "reasons": []
        }

        # Combined Results for final report for API

        report = self.calculate_risk(
            ml_score,
            rule_result,
            domain_result,
            company_result
        )

        return report