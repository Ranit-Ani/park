"""
Evaluates the trained model against the held-out test set.

    python training/evaluate.py

Prints accuracy, per-intent precision/recall/F1, and a confusion matrix.
"""
import sys
import csv
import pickle
from pathlib import Path

from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

AI_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AI_ROOT))
from prediction.preprocess import clean_batch  # noqa: E402

DATASET_PATH = AI_ROOT / "dataset" / "test_data.csv"
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
    if not VECTORIZER_PATH.exists() or not CLASSIFIER_PATH.exists():
        print("No trained model found. Run `python training/train.py` first.")
        sys.exit(1)
    if not DATASET_PATH.exists():
        print(f"Test set not found at {DATASET_PATH}. Run dataset/build_dataset.py first.")
        sys.exit(1)

    with open(VECTORIZER_PATH, "rb") as f:
        vectorizer = pickle.load(f)
    with open(CLASSIFIER_PATH, "rb") as f:
        clf = pickle.load(f)

    texts, y_true = load_dataset(DATASET_PATH)
    cleaned = clean_batch(texts)
    X = vectorizer.transform(cleaned)
    y_pred = clf.predict(X)

    acc = accuracy_score(y_true, y_pred)
    print(f"Test accuracy: {acc:.4f}  ({len(y_true)} examples)\n")

    labels_sorted = sorted(set(y_true) | set(y_pred))
    print("Classification report (precision / recall / F1 per intent):")
    print(classification_report(y_true, y_pred, labels=labels_sorted, zero_division=0))

    print("Confusion matrix (rows = true intent, cols = predicted intent):")
    cm = confusion_matrix(y_true, y_pred, labels=labels_sorted)
    header = "".join(f"{l[:8]:>10}" for l in labels_sorted)
    print(" " * 22 + header)
    for label, row in zip(labels_sorted, cm):
        print(f"{label[:20]:>22}" + "".join(f"{v:>10}" for v in row))

    print("\nMisclassified examples:")
    misses = [(t, yt, yp) for t, yt, yp in zip(texts, y_true, y_pred) if yt != yp]
    if not misses:
        print("  (none)")
    else:
        for text, true_label, pred_label in misses:
            print(f"  '{text}'  ->  predicted={pred_label}, actual={true_label}")


if __name__ == "__main__":
    main()
