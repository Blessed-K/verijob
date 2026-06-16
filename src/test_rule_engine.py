from rule_engine import evaluate_rules

text = """
Immediate hiring.

Earn Ksh 15,000 daily.

Registration fee required.

Send your National ID and bank account details.
"""

print(evaluate_rules(text))