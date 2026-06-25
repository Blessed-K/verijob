import re
from urllib.parse import urlparse


FREE_EMAIL_PROVIDERS = {
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "icloud.com",
    "protonmail.com",
    "consultant.com"
}

SUSPICIOUS_TLDS = {
    ".xyz",
    ".top",
    ".click",
    ".work",
    ".online",
    ".site"
}

SHORTENERS = {
    "bit.ly",
    "tinyurl.com",
    "t.co",
    "is.gd",
    "cutt.ly"
}


def extract_emails(text):
    pattern = r"[\w\.-]+@[\w\.-]+\.\w+"
    return re.findall(pattern, text)


def extract_urls(text):
    pattern = r"https?://[^\s]+|www\.[^\s]+"
    return re.findall(pattern, text)


def clean_domain(url):
    if url.startswith("www."):
        url = "https://" + url

    parsed = urlparse(url)
    domain = parsed.netloc.lower()

    if domain.startswith("www."):
        domain = domain[4:]

    return domain


def analyze_emails(emails):

    results = []

    for email in emails:

        domain = email.split("@")[-1].lower()

        if domain in FREE_EMAIL_PROVIDERS:

            results.append({
                "email": email,
                "domain": domain,
                "risk": "Caution",
                "reason": (
                    "Recruiter uses a free email provider. "
                    "Verify the organisation before proceeding."
                )
            })

        else:

            results.append({
                "email": email,
                "domain": domain,
                "risk": "Likely Legitimate",
                "reason": "Recruiter uses a professional email domain."
            })

    return results


def analyze_urls(urls):

    results = []

    for url in urls:

        domain = clean_domain(url)

        risk = "Likely Legitimate"
        reason = "No obvious suspicious URL pattern detected."

        if domain in SHORTENERS:

            risk = "Suspicious"
            reason = "Shortened URL detected."

        elif any(domain.endswith(tld) for tld in SUSPICIOUS_TLDS):

            risk = "Suspicious"
            reason = "Suspicious top-level domain detected."

        results.append({
            "url": url,
            "domain": domain,
            "risk": risk,
            "reason": reason
        })

    return results


def check_job_post(text):

    emails = list(dict.fromkeys(extract_emails(text)))
    urls = list(dict.fromkeys(extract_urls(text)))

    email_results = analyze_emails(emails)
    url_results = analyze_urls(urls)

    risk_flags = []

    has_suspicious = False
    has_caution = False

    for item in email_results + url_results:

        if item["risk"] == "Suspicious":

            has_suspicious = True
            risk_flags.append(item["reason"])

        elif item["risk"] == "Caution":

            has_caution = True
            risk_flags.append(item["reason"])

    if has_suspicious:

        overall_risk = "Suspicious"

    elif has_caution:

        overall_risk = "Caution"

    else:

        overall_risk = "No obvious domain risk detected"

    return {

        "emails_found": emails,

        "urls_found": urls,

        "email_analysis": email_results,

        "url_analysis": url_results,

        "domain_risk": overall_risk,

        "risk_flags": list(dict.fromkeys(risk_flags))

    }