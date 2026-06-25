from src.rule_engine import evaluate_rules
from src.domain_checker import check_job_post
from src.repository import Repository
# checking time taken by each Module
#import time



class RiskEngine:

    def __init__(self, model):

        self.model = model
        self.repository = Repository()

    def analyze(self, text: str):
#implementing time module
        text = text.strip().lower()

        #line below is for checking time for ml
        #print(f"Characters sent to model: {len(text)}")


        #start = time.perf_counter()

        probability = self.model.predict_proba([text])[0][1]
       #model split timer
        #vectorizer = self.model.named_steps["tfdif"]
        #classifier = self.model.named_steps["classifier"]

        #start_vec = time.perf_counter()
        #X = vectorizer.transform([text])
        #end_vec = time.perf_counter()

        #start_clf = time.perf_counter()
        #probability = classifier.predict_proba(X)[0][1]
        #end_clf = time.perf_counter()

        #print(f"Vectorizer: {(end_vec-start_vec):.3f}s")
        #print(f"Classifier: {(end_clf-start_clf):.3f}s")

#continuation of normal code
        #ml_time = time.perf_counter()

        ml_score = float(probability * 100)

        rule_result = evaluate_rules(text)
        #rule_time =time.perf_counter()

        domain_result = check_job_post(text)
        #domain_time = time.perf_counter()

        report = self.calculate_risk(

            ml_score,

            rule_result,

            domain_result

        )
        return report
        #time report
        #end = time.perf_counter()
        #print(f"ML: {(ml_time - start):.3f}s")
        #print(f"Rules: {(rule_time - ml_time):.3f}s")
        #print(f"Domain: {(domain_time - rule_time):.3f}s")
        #print(f"Total Backend: {(end - start):.3f}s")

        #return report

    def calculate_risk(

        self,

        ml_score,

        rule_result,

        domain_result

    ):

        # Base score is the ML probability
        total_score = ml_score

        # Add rule penalties directly
        total_score += rule_result["rule_score"]

        # Add domain penalties directly
        if domain_result["domain_risk"] == "Suspicious":
            total_score += 25

        elif domain_result["domain_risk"] == "Caution":
            total_score += 10

        # Cap at 100
        total_score = round(

            min(total_score, 100),

            2

        )

        return self.build_report(

            total_score,

            ml_score,

            rule_result,

            domain_result

        )

    def build_report(

        self,

        risk_score,

        ml_score,

        rule_result,

        domain_result

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

        reasons = list(dict.fromkeys(reasons))

        if prediction == "Fraudulent":

            summary = (

                "Multiple indicators associated with "

                "fraudulent recruitment were detected."

            )

        elif prediction == "Suspicious":

            summary = (

                "Some suspicious indicators were "

                "identified. Further verification "

                "is recommended."

            )

        else:

            summary = (

                "No major indicators of fraudulent "

                "recruitment were detected."

            )

        report = {

            "prediction": prediction,

            "summary": summary,

            "risk_score": risk_score,

            "confidence": confidence,

            "fraud_probability": round(ml_score, 2),

            "reasons": reasons,

            "recommendation": recommendation,

            "rule_analysis": rule_result,

            "domain_analysis": domain_result

        }

        self.repository.save_scan(report)

        return report

    def calculate_confidence(self, ml_score):

        if ml_score >= 90:

            return "Very High"

        elif ml_score >= 75:

            return "High"

        elif ml_score >= 60:

            return "Medium"

        return "Low"

    def get_recommendation(self, prediction):

        if prediction == "Fraudulent":

            return (

                "Avoid sending money or personal "

                "documents. Verify the vacancy "

                "through the official company "

                "website."

            )

        elif prediction == "Suspicious":

            return (

                "Verify the recruiter, official "

                "website, and contact information "

                "before proceeding."

            )

        return (

            "No major fraud indicators were "

            "detected. Continue using official "

            "recruitment channels."

        )