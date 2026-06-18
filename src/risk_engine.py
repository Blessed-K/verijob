from src.rule_engine import evaluate_rules
from src.domain_checker import check_job_post
from src.repository import Repository


class RiskEngine:

    def __init__(self, model):
        self.model = model

        self.repository = Repository()

    def analyze(self, text: str):

        text = text.strip().lower()

        #Machine Learning Analysis
        probability = self.model.predict_proba([text])[0][1]

        ml_score = float(probability * 100)

        #Rule Analysis
        rule_result = evaluate_rules(text)

        #Domain Analysis
        domain_result = check_job_post(text)

        #Company Analysis
        company_result = {
            "risk_score": 0,
            "reasons": []
        }

        #Combined results for final report for API

        report = self.calculate_risk(
            ml_score,
            rule_result,
            domain_result,
            company_result
        )

        return report
    #Risk calculator
    def calculate_risk(
        self,
        ml_score,
        rule_result,
        domain_result,
        company_result
    ):

        weighted_ml = ml_score * 0.70

        weighted_rules = rule_result["rule_score"] * 0.15

        domain_score = 15 if domain_result["domain_risk"] == "Suspicious" else 0

        weighted_domain = domain_score * 0.10

        weighted_company = company_result["risk_score"] * 0.05

        total_score = (
            weighted_ml
            + weighted_rules
            + weighted_domain
            + weighted_company
        )

        total_score = round(min(total_score, 100), 2)

        return self.build_report(
            total_score,
            ml_score,
            rule_result,
            domain_result,
            company_result
            )
    # Report Builder
    def build_report(
        self,
        risk_score,
        ml_score,
        rule_result,
        domain_result,
        company_result
    ):

        if risk_score >= 70:
            prediction = "Fraudulent"

        elif risk_score >= 40:
            prediction = "Suspicious"

        else:
            prediction = "Legitimate"

        confidence = self.calculate_confidence(ml_score)

        recommendation = self.get_recommendation(prediction)

        reasons = []

        reasons.extend(rule_result["reasons"])

        reasons.extend(domain_result["risk_flags"])

        reasons.extend(company_result["reasons"])

        report = {

            "prediction": prediction,

            "risk_score": risk_score,

            "confidence": confidence,

            "fraud_probability": round(ml_score,2),

            "reasons": list(set(reasons)),

            "recommendation": recommendation,

            "rule_analysis": rule_result,

            "domain_analysis": domain_result,

            "company_analysis": company_result

        }

        self.repository.save_scan(report)
        return report
    
    #confidence calculator
    def calculate_confidence(self, ml_score):

        if ml_score >= 90:
            return "Very High"

        elif ml_score >= 75:
            return "High"

        elif ml_score >= 60:
            return "Medium"

        return "Low"

#recommendation generator
    def get_recommendation(self, prediction):

        if prediction == "Fraudulent":

            return (
                "Avoid sending money or personal documents. "
                "Verify the vacancy through the official company website."
            )

        if prediction == "Suspicious":

            return (
                "Verify the recruiter, company website, and email "
                "before proceeding with the application."
            )

        return (
            "No major fraud indicators detected. Continue using "
            "official recruitment channels."
        )