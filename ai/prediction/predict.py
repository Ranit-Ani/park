"""
Loads the trained TF-IDF vectorizer + classifier once, and exposes
predict_intent(text) for the API layer (and for quick CLI testing).
"""
import sys
import json
import pickle
from pathlib import Path

AI_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AI_ROOT))
from prediction.preprocess import clean_text  # noqa: E402

MODEL_DIR = AI_ROOT / "model"
VECTORIZER_PATH = MODEL_DIR / "tfidf_vectorizer.pkl"
CLASSIFIER_PATH = MODEL_DIR / "intent_classifier.pkl"
CONFIG_PATH = AI_ROOT / "config" / "intents.json"

_vectorizer = None
_classifier = None
_config = None


class ModelNotTrainedError(Exception):
    pass


def _load():
    global _vectorizer, _classifier, _config
    if _vectorizer is not None and _classifier is not None:
        return
    if not VECTORIZER_PATH.exists() or not CLASSIFIER_PATH.exists():
        raise ModelNotTrainedError(
            "Model files not found. Run `python training/train.py` first."
        )
    with open(VECTORIZER_PATH, "rb") as f:
        _vectorizer = pickle.load(f)
    with open(CLASSIFIER_PATH, "rb") as f:
        _classifier = pickle.load(f)
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        _config = json.load(f)


def get_confidence_threshold() -> float:
    _load()
    return float(_config.get("confidence_threshold", 0.35))


def predict_intent(text: str, top_k: int = 3):
    """
    Returns:
        {
          "intent": "check_availability",
          "confidence": 0.83,
          "below_threshold": False,
          "alternatives": [{"intent": "...", "confidence": 0.05}, ...]
        }
    Falls back to intent="unknown" when confidence is below the configured
    threshold, so the caller never has to special-case low-confidence cases.
    """
    _load()
    cleaned = clean_text(text)
    X = _vectorizer.transform([cleaned])

    probs = _classifier.predict_proba(X)[0]
    classes = _classifier.classes_
    ranked = sorted(zip(classes, probs), key=lambda p: p[1], reverse=True)

    top_intent, top_conf = ranked[0]
    threshold = get_confidence_threshold()
    below = bool(top_conf < threshold)

    return {
        "intent": "unknown" if below else str(top_intent),
        "raw_intent": str(top_intent),
        "confidence": round(float(top_conf), 4),
        "below_threshold": below,
        "alternatives": [
            {"intent": str(i), "confidence": round(float(c), 4)}
            for i, c in ranked[1:top_k]
        ],
    }


if __name__ == "__main__":
    # Quick CLI check: python prediction/predict.py "how do i cancel a booking"
    query = " ".join(sys.argv[1:]) or "how many slots are available"
    result = predict_intent(query)
    print(json.dumps(result, indent=2))
