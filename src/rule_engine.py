import re


RULES = {

    "advance_payment": {
        "patterns": [
            r"registration fee",
            r"application fee",
            r"processing fee",
            r"training fee",
            r"security deposit",
            r"activation fee",
            r"pay.*registration",
            r"pay.*before interview",
            r"payment required before",
            r"deposit required",
            r"pay before employment"
        ],
        "score": 35,
        "category": "Payment Scam",
        "reason": "The advert requests payment before employment."
    },

    "interview_bypass": {
        "patterns": [
            r"no interview",
            r"without interview",
            r"no cv required",
            r"guaranteed employment",
            r"automatic employment",
            r"instant employment",
            r"direct employment"
        ],
        "score": 25,
        "category": "Recruitment Process",
        "reason": "The advert bypasses normal recruitment procedures."
    },

    "unofficial_contact": {
        "patterns": [
            r"apply.*whatsapp",
            r"send.*cv.*whatsapp",
            r"contact.*whatsapp",
            r"whatsapp only",
            r"telegram only",
            r"contact.*telegram",
            r"send.*cv.*telegram",
            r"inbox me",
            r"dm me"
        ],
        "score": 15,
        "category": "Communication",
        "reason": "The advert requests communication through unofficial channels."
    },

    "crypto_payment": {
        "patterns": [
            r"pay in bitcoin",
            r"payment in bitcoin",
            r"bitcoin wallet",
            r"crypto wallet",
            r"payment in usdt",
            r"send usdt",
            r"send btc",
            r"pay with cryptocurrency"
        ],
        "score": 25,
        "category": "Payment Scam",
        "reason": "The advert requests cryptocurrency payment."
    }

}


def evaluate_rules(text):

    text = text.lower()

    total_score = 0

    reasons = []

    triggered_rules = []

    findings = []

    for rule_name, rule in RULES.items():

        for pattern in rule["patterns"]:

            if re.search(pattern, text):

                total_score += rule["score"]

                reasons.append(rule["reason"])

                triggered_rules.append(rule_name)

                findings.append({

                    "category": rule["category"],

                    "reason": rule["reason"],

                    "score": rule["score"]

                })

                break

    return {

        "rule_score": total_score,

        "reasons": list(dict.fromkeys(reasons)),

        "triggered_rules": triggered_rules,

        "findings": findings

    }