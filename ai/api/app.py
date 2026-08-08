"""
Small Flask API that wraps prediction/predict.py so the Node.js backend can
call the model over HTTP instead of importing Python directly.

Run:
    python api/app.py
Listens on PORT (default 5001).

Endpoints:
    GET  /health            -> { status, model_loaded }
    POST /predict            body: { "text": "how do i cancel a booking" }
                              -> { success, data: { intent, confidence, ... } }
"""
import os
import sys
from pathlib import Path

from flask import Flask, request, jsonify

AI_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AI_ROOT))
from prediction.predict import predict_intent, ModelNotTrainedError  # noqa: E402

app = Flask(__name__)

# Restrict to local calls from the Node backend only. In production these
# two processes run on the same host/container, so this API is never
# exposed publicly — see README for the deployment note.


@app.route("/health", methods=["GET"])
def health():
    try:
        # Cheap way to confirm the model is loadable without predicting.
        predict_intent("health check ping")
        return jsonify({"status": "ok", "model_loaded": True})
    except ModelNotTrainedError as e:
        return jsonify({"status": "model_not_trained", "model_loaded": False, "error": str(e)}), 503


@app.route("/predict", methods=["POST"])
def predict():
    body = request.get_json(silent=True) or {}
    text = (body.get("text") or "").strip()
    if not text:
        return jsonify({"success": False, "message": "text is required."}), 400

    try:
        result = predict_intent(text)
        return jsonify({"success": True, "data": result})
    except ModelNotTrainedError as e:
        return jsonify({"success": False, "message": str(e)}), 503
    except Exception as e:  # noqa: BLE001
        return jsonify({"success": False, "message": f"Prediction failed: {e}"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("AI_API_PORT", 5001))
    app.run(host="127.0.0.1", port=port)
