import re
from urllib.parse import urlparse
from datetime import datetime, timezone

import whois


FREE_EMAIL_PROVIDERS = {
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "icloud.com",
    "protonmail.com"
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


def get_domain_age_days(domain):
    try:
        domain_info = whois.whois(domain)
        creation_date = domain_info.creation_date

        if isinstance(creation_date, list):
            creation_date = creation_date[0]

        if creation_date is None:
            return None

        if creation_date.tzinfo is None:
            creation_date = creation_date.replace(tzinfo=timezone.utc)

        today = datetime.now(timezone.utc)

        age_days = (today - creation_date).days

        return age_days

    except Exception:
        return None


def analyze_emails(emails):
    results = []

    for email in emails:
        domain = email.split("@")[-1].lower()

        if domain in FREE_EMAIL_PROVIDERS:
            results.append({
                "email": email,
                "domain": domain,
                "risk": "Suspicious",
                "reason": "Recruiter is using a free email provider"
            })
        else:
            age_days = get_domain_age_days(domain)

            if age_days is not None and age_days < 180:
                results.append({
                    "email": email,
                    "domain": domain,
                    "domain_age_days": age_days,
                    "risk": "Suspicious",
                    "reason": "Recruiter email domain is recently registered"
                })
            else:
                results.append({
                    "email": email,
                    "domain": domain,
                    "domain_age_days": age_days,
                    "risk": "Likely Legitimate",
                    "reason": "Recruiter email uses a professional domain"
                })

    return results


def analyze_urls(urls):
    results = []

    for url in urls:
        domain = clean_domain(url)

        risk = "Likely Legitimate"
        reason = "No obvious suspicious URL pattern detected"

        if domain in SHORTENERS:
            risk = "Suspicious"
            reason = "Shortened URL detected"

        elif any(domain.endswith(tld) for tld in SUSPICIOUS_TLDS):
            risk = "Suspicious"
            reason = "Suspicious top-level domain detected"

        age_days = get_domain_age_days(domain)

        if age_days is not None and age_days < 180:
            risk = "Suspicious"
            reason = "Domain is recently registered"

        results.append({
            "url": url,
            "domain": domain,
            "domain_age_days": age_days,
            "risk": risk,
            "reason": reason
        })

    return results


def check_job_post(text):
    emails = extract_emails(text)
    urls = extract_urls(text)

    email_results = analyze_emails(emails)
    url_results = analyze_urls(urls)

    risk_flags = []

    for item in email_results + url_results:
        if item["risk"] == "Suspicious":
            risk_flags.append(item["reason"])

    if risk_flags:
        overall_risk = "Suspicious"
    else:
        overall_risk = "No obvious domain risk detected"

    return {
        "emails_found": emails,
        "urls_found": urls,
        "email_analysis": email_results,
        "url_analysis": url_results,
        "domain_risk": overall_risk,
        "risk_flags": list(set(risk_flags))
    }