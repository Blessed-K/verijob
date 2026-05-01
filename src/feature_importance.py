import pandas as pd
from pathlib import Path

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from xgboost import XGBClassifier
import matplotlib.pyplot as plt
import numpy as np


DATA_PATH = Path("outputs/cleaned_data/combined_cleaned_jobs.csv")
FIGURE_DIR = Path("outputs/figures")

FIGURE_DIR.mkdir(parents=True, exist_ok=True)


df = pd.read_csv(DATA_PATH)

X = df["combined_text"]
y = df["fraudulent"]

# TF-IDF
vectorizer = TfidfVectorizer(
    max_features=10000,
    ngram_range=(1, 2)
)

X_tfidf = vectorizer.fit_transform(X)

X_train, X_test, y_train, y_test = train_test_split(
    X_tfidf,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

model = XGBClassifier(
    n_estimators=200,
    max_depth=6,
    learning_rate=0.1,
    subsample=0.8,
    colsample_bytree=0.8,
    eval_metric="logloss",
    random_state=42
)

model.fit(X_train, y_train)

# Feature importance
feature_names = np.array(vectorizer.get_feature_names_out())
importances = model.feature_importances_

indices = np.argsort(importances)[::-1][:20]

top_features = feature_names[indices]
top_importances = importances[indices]

print("\nTop 20 Fraud Detection Features:\n")

for feature, score in zip(top_features, top_importances):
    print(f"{feature}: {score:.4f}")

plt.figure(figsize=(10, 6))
plt.barh(top_features[::-1], top_importances[::-1])
plt.xlabel("Importance Score")
plt.title("Top 20 Most Important Fraud Detection Features")
plt.tight_layout()

plt.savefig(FIGURE_DIR / "feature_importance.png")
plt.show()