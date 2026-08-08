"""
Trains the parking-assistant intent classifier.

    python training/train.py

Reads dataset/parking_intents.csv (columns: text,intent), vectorizes with
TF-IDF, trains a Logistic Regression classifier, and saves both to model/.
"""
import sys
import csv
import pickle
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

AI_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AI_ROOT))
from prediction.preprocess import clean_batch  # noqa: E402

DATASET_PATH = AI_ROOT / "dataset" / "parking_intents.csv"
MODEL_DIR = AI_ROOT / "model"
VECTORIZER_PATH = MODEL_DIR / "tfidf_vectorizer.pkl"
CLASSIFIER_PATH = MODEL_DIR / "intent_classifier.pkl"


def load_dataset(path: Path):
    texts, labels = [], []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            text = (row.get("text") or "").strip()
            intent = (row.get("intent") or "").strip()
            if text and intent:
                texts.append(text)
                labels.append(intent)
    return texts, labels


def main():
    if not DATASET_PATH.exists():
        print(f"Dataset not found at {DATASET_PATH}. Run dataset/build_dataset.py first.")
        sys.exit(1)

    print(f"Loading dataset from {DATASET_PATH} ...")
    texts, labels = load_dataset(DATASET_PATH)
    print(f"Loaded {len(texts)} examples across {len(set(labels))} intents.")

    cleaned = clean_batch(texts)

    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),   # unigrams + bigrams: "how do", "check in", etc.
        min_df=1,
        sublinear_tf=True,
    )
    X = vectorizer.fit_transform(cleaned)

    clf = LogisticRegression(
        max_iter=1000,
        C=5.0,
        class_weight="balanced",
    )
    clf.fit(X, labels)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    with open(VECTORIZER_PATH, "wb") as f:
        pickle.dump(vectorizer, f)
    with open(CLASSIFIER_PATH, "wb") as f:
        pickle.dump(clf, f)

    train_acc = clf.score(X, labels)
    print(f"Training accuracy: {train_acc:.4f}")
    print(f"Saved vectorizer -> {VECTORIZER_PATH}")
    print(f"Saved classifier -> {CLASSIFIER_PATH}")
    print("\nRun `python training/evaluate.py` to check accuracy on held-out test_data.csv.")


if __name__ == "__main__":
    main()
