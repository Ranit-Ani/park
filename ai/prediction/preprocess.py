"""
Text preprocessing used identically at training time and prediction time.
Keeping this in one module (imported by both train.py and predict.py)
guarantees the vectorizer sees the same normalization in both places.
"""
import re

# Small, domain-appropriate stopword list. Deliberately does NOT strip
# words like "how", "when", "who", "not", "no" — those carry intent signal
# in a short-query classifier (e.g. "how do I cancel" vs "cancel").
STOPWORDS = {
    "a", "an", "the", "is", "are", "am", "was", "were", "be", "been", "being",
    "to", "of", "in", "on", "at", "for", "with", "and", "or", "please",
    "can", "could", "would", "i", "me", "my", "you", "your", "it", "this",
    "that", "do", "does", "did", "so", "just", "get", "got",
}

_word_re = re.compile(r"[a-z0-9']+")


def clean_text(text: str) -> str:
    """Lowercase, strip punctuation/digits noise, drop stopwords."""
    if not text:
        return ""
    text = text.lower().strip()
    tokens = _word_re.findall(text)
    tokens = [t for t in tokens if t not in STOPWORDS]
    return " ".join(tokens) if tokens else text.lower()


def clean_batch(texts):
    return [clean_text(t) for t in texts]
