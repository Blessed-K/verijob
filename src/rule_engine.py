import re


RULES = {

    "registration_fee": {
        "patterns": [
            r"registration fee",
            r"processing fee",
            r"pay.*fee",
            r"training fee",
            r"application fee"
        ],
        "score": 20,
        "reason": "Registration or processing fee requested."
    },

    "urgent_hiring": {
        "patterns": [
            r"immediate hiring",
            r"apply today",
            r"urgent hiring",
            r"limited slots",
            r"hiring immediately"
        ],
        "score": 10,
        "reason": "Urgency language detected."
    },

    "personal_information": {
        "patterns": [
            r"national id",
            r"passport",
            r"bank account",
            r"credit card",
            r"mpesa pin",
            r"social security"
        ],
        "score": 25,
        "reason": "Sensitive personal information requested."
    },

    "high_salary": {
        "patterns": [
            r"ksh\s?\d{3,}",
            r"\$\d{3,}",
            r"earn.*daily",
            r"earn.*weekly"
        ],
        "score": 10,
        "reason": "Potentially unrealistic salary claim."
    }

}

def evaluate_rules(text):

    score = 0

    reasons = []

    triggered = []

    lower = text.lower()

    for rule_name, rule in RULES.items():

        for pattern in rule["patterns"]:

            if re.search(pattern, lower):

                score += rule["score"]

                reasons.append(rule["reason"])

                triggered.append(rule_name)

                break

    return {

        "rule_score": score,

        "reasons": reasons,

        "triggered_rules": triggered

    }