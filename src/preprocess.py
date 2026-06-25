import pandas as pd
from pathlib import Path

DATA_DIR = Path("data")
OUTPUT_DIR = Path("outputs/cleaned_data")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

#reading the datasets and creating df from them
def load_datasets():
    local_df = pd.read_excel(DATA_DIR / "local_data.xlsx")
    nigeria_df = pd.read_csv(DATA_DIR / "CompiledjobListNigeria.csv")
    fake_postings_df = pd.read_csv(DATA_DIR / "Fake Postings.csv")
    kaggle_df = pd.read_csv(DATA_DIR / "fake_job_postings.csv")

    return local_df, nigeria_df, fake_postings_df, kaggle_df

#standerdizing column names for the datasets
def standardize_columns():
    local_df, nigeria_df, fake_postings_df, kaggle_df = load_datasets()

    # LOCAL
    local_df = local_df.rename(columns={
        "company_name": "company",
        "contact_info_provided": "contact_info",
        "pii_requested": "pii_requests"
    })

    # NIGERIA
    nigeria_df = nigeria_df.rename(columns={
        "company_name": "company",
        "job_desc": "job_description",
        "job_requirement": "requirements",
        "label": "fraudulent"
    })

    # FAKE POSTINGS
    fake_postings_df = fake_postings_df.rename(columns={
        "title": "job_title",
        "description": "job_description",
        "salary_range": "salary",
    })

    # KAGGLE
    kaggle_df = kaggle_df.rename(columns={
        "title": "job_title",
        "description": "job_description",
        "salary_range": "salary",
    })

    return local_df, nigeria_df, fake_postings_df, kaggle_df

#
if __name__ == "__main__":
    datasets = standardize_columns()

    names = ["local", "nigeria", "fake_postings", "kaggle"]

    for name, df in zip(names, datasets):
        print(f"\n{name.upper()}")
        print(df.columns.tolist())
        print(df.shape)

COMMON_COLUMNS = [
    "job_title",
    "company",
    "location",
    "job_description",
    "requirements",
    "salary",
    "contact_info",
    "pii_requests",
    "employment_type",
    "fraudulent"
]


def prepare_common_dataset(df):
    for col in COMMON_COLUMNS:
        if col not in df.columns:
            df[col] = ""

    df = df[COMMON_COLUMNS].copy()

    text_cols = [
        "job_title",
        "company",
        "location",
        "job_description",
        "requirements",
        "salary",
        "contact_info",
        "pii_requests",
        "employment_type"
    ]

    for col in text_cols:
        df[col] = df[col].fillna("").astype(str).str.strip()

    df["fraudulent"] = df["fraudulent"].astype(int)

    return df


def combine_datasets():
    local_df, nigeria_df, fake_postings_df, kaggle_df = standardize_columns()

    datasets = [
        prepare_common_dataset(local_df),
        prepare_common_dataset(nigeria_df),
        prepare_common_dataset(fake_postings_df),
        prepare_common_dataset(kaggle_df)
    ]

    combined_df = pd.concat(datasets, ignore_index=True)

    combined_df = combined_df.drop_duplicates()

    combined_df["combined_text"] = (
        combined_df["job_title"] + " " +
        combined_df["company"] + " " +
        combined_df["location"] + " " +
        combined_df["job_description"] + " " +
        combined_df["requirements"] + " " +
        combined_df["salary"] + " " +
        combined_df["contact_info"] + " " +
        combined_df["pii_requests"] + " " +
        combined_df["employment_type"]
    )

    combined_df["combined_text"] = (
        combined_df["combined_text"]
        .str.lower()
        .str.replace(r"\s+", " ", regex=True)
        .str.strip()
    )

    combined_df.to_csv(OUTPUT_DIR / "combined_cleaned_jobs.csv", index=False)

    print("\nCOMBINED DATASET")
    print("Shape:", combined_df.shape)
    print("\nLabel distribution:")
    print(combined_df["fraudulent"].value_counts())

    return combined_df

if __name__ == "__main__":
    combined_df = combine_datasets()