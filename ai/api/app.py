# File: ai/api/app.py
# Purpose: Small Flask API wrapping prediction/predict.py so the Node backend can call the
# model over HTTP. Endpoints: GET /health, POST /predict.
# Original description: Small Flask API that wraps prediction/predict.py so the Node.js
# backend can call the model over HTTP instead of importing Python directly. Run: python
# api/app.py Listens on PORT (default 5001). Endpoints: GET /health -> { status,
# model_loaded } POST /predict body: { "text": "how do i cancel a booking" } -> { success,
# data: { intent, confidence, ... } }
# Contains:
#   - health
#   - predict
#
# NOTE: Source code intentionally removed. Implementation goes here.
