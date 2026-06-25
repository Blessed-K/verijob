import re


RULES = {

    "advance_payment": {
        "patterns": [
            r"(?<!no )(?<!not )(?<!never )(?<!without )(?<!any )registration fee",
            r"(?<!no )(?<!not )(?<!never )(?<!without )(?<!any )application fee",
            r"(?<!no )(?<!not )(?<!never )(?<!without )(?<!any )processing fee",
            r"(?<!no )(?<!not )(?<!never )(?<!without )(?<!any )training fee",
            r"(?<!no )(?<!not )(?<!never )(?<!without )(?<!any )security deposit",
            r"(?<!no )(?<!not )(?<!never )(?<!without )(?<!any )activation fee",
            r"(?<!do not )(?<!don't )(?<!never )pay.*registration",
            r"(?<!do not )(?<!don't )(?<!never )pay.*before interview",
            r"(?<!no )(?<!not )(?<!never )(?<!without )(?<!any )payment required before",
            r"(?<!no )(?<!not )(?<!never )(?<!without )(?<!any )deposit required",
            r"(?<!do not )(?<!don't )(?<!never )pay before employment"
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
    },

    "logistics_scam": {
        "patterns": [
            r"package forwarding",
            r"package forwarder",
            r"re-package",
            r"receive packages",
            r"receive incoming parcels",
            r"inspect physical merchandise",
            r"home delivery inspection"
        ],
        "score": 35,
        "category": "Logistics Scam",
        "reason": "The job description details package-forwarding tasks from a home address, indicative of a package mule scam."
    },

    "malware_download": {
        "patterns": [
            r"\.exe",
            r"\.zip",
            r"assessment tool",
            r"download.*assessment",
            r"install.*software",
            r"proprietary.*tool",
            r"moderator_assessment"
        ],
        "score": 40,
        "category": "Malware Risk",
        "reason": "The listing requires downloading/installing executable software (.exe or .zip) for interview screening, presenting a malware risk."
    },

    "pii_harvesting": {
        "patterns": [
            r"social security number",
            r"ssn",
            r"driver's license",
            r"upload.*id",
            r"upload.*state id",
            r"front and back photos"
        ],
        "score": 35,
        "category": "Identity Phishing",
        "reason": "The listing asks for highly sensitive personally identifiable information (SSN/ID upload) before a formal interview."
    },

    "unofficial_interview": {
        "patterns": [
            r"skype chat",
            r"text-based interview",
            r"interview.*skype",
            r"interview.*telegram",
            r"interview.*whatsapp",
            r"interview.*signal"
        ],
        "score": 20,
        "category": "Communication",
        "reason": "The recruiter proposes conducting interviews entirely via text-based chat channels."
    },

    "financial_forwarding": {
        "patterns": [
            r"transaction assistant",
            r"receive funds",
            r"forward funds",
            r"commission per transaction",
            r"percent per transaction",
            r"process payments"
        ],
        "score": 35,
        "category": "Financial Scam",
        "reason": "The role involves receiving and forwarding money, which is typical of money laundering / fake check scams."
    },

    "check_scam": {
        "patterns": [
            r"cashier's check",
            r"certified check",
            r"mail.*check",
            r"send.*check",
            r"purchase.*equipment",
            r"purchase.*laptop",
            r"approved equipment vendor"
        ],
        "score": 35,
        "category": "Check Scam",
        "reason": "The advert details a check-cashing scheme for purchasing equipment, which is a common employment scam."
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