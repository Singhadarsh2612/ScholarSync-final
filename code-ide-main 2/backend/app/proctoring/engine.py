# engine.py
import cv2
import numpy as np
import requests
import os
from ultralytics import YOLO


def get_head_pose(frame):
    return "Forward"


def get_eye_direction(frame):
    return "Eyes Center"


# Violation type → display info
VIOLATION_MAP = {
    # Mobile / electronic devices
    "cell phone": {
        "type": "MOBILE",
        "severity": "HIGH",
        "alert": "📱 VIOLATION: Mobile phone detected!",
        "detail": "Mobile devices are strictly prohibited during the interview."
    },
    "remote": {
        "type": "MOBILE",
        "severity": "HIGH",
        "alert": "📱 VIOLATION: Electronic device detected!",
        "detail": "Electronic devices are not allowed in the exam room."
    },
    "laptop": {
        "type": "DEVICE",
        "severity": "HIGH",
        "alert": "💻 VIOLATION: Secondary device (laptop) detected!",
        "detail": "Only one screen/device is permitted."
    },
    "tv": {
        "type": "DEVICE",
        "severity": "MEDIUM",
        "alert": "🖥️ WARNING: Screen/monitor detected!",
        "detail": "Additional screens may indicate unauthorized resources."
    },
    "keyboard": {
        "type": "DEVICE",
        "severity": "LOW",
        "alert": "⌨️ Note: External keyboard detected.",
        "detail": "Ensure only permitted peripherals are used."
    },
    # Books / printed materials
    "book": {
        "type": "BOOK",
        "severity": "HIGH",
        "alert": "📚 VIOLATION: Book/printed material detected!",
        "detail": "No reference materials are allowed during the interview."
    },
    "magazine": {
        "type": "BOOK",
        "severity": "HIGH",
        "alert": "📰 VIOLATION: Printed material detected!",
        "detail": "No printed reference materials allowed."
    },
    # Suspicious items
    "toothbrush": {
        "type": "SUSPICIOUS",
        "severity": "MEDIUM",
        "alert": "🔍 Suspicious object detected.",
        "detail": "Possible pen or pointing device detected."
    },
    "pen": {
        "type": "SUSPICIOUS",
        "severity": "LOW",
        "alert": "🖊️ Writing instrument detected.",
        "detail": "Note-taking is not allowed."
    },
    "scissors": {
        "type": "SUSPICIOUS",
        "severity": "MEDIUM",
        "alert": "✂️ Suspicious object in frame.",
        "detail": "Unusual objects detected in examination area."
    },
}


class ProctorEngine:
    def __init__(self):
        try:
            self.model = YOLO("yolov8n.pt")
            print("[ProctorEngine] YOLOv8 model loaded successfully.")
        except Exception as e:
            print(f"[ProctorEngine] WARNING: Could not load YOLO model: {e}")
            self.model = None

        self.azure_key = os.getenv("AZURE_FACE_KEY", "")
        base_url = os.getenv("AZURE_FACE_ENDPOINT", "").rstrip("/")
        self.azure_endpoint = f"{base_url}/face/v1.0/detect"

        self.headers = {
            "Ocp-Apim-Subscription-Key": self.azure_key,
            "Content-Type": "application/octet-stream"
        }
        self.params = {"returnFaceId": "false"}

    def process_frame(self, frame_bytes: bytes, run_face_api: bool = False):
        nparr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            return {"alerts": ["⚠️ Invalid frame data"], "detections": [], "violations": []}

        alerts = []
        detections = []
        violations = []   # Structured violation list for frontend

        # ── 1. YOLO Detection ────────────────────────────────────────
        if self.model is not None:
            results = self.model(frame, conf=0.2)
            person_count = 0
            seen_violations = set()  # Deduplicate by violation type

            for r in results:
                for box in r.boxes:
                    cls_id = int(box.cls[0])
                    name = self.model.names[cls_id]
                    conf = float(box.conf[0])
                    xyxy = box.xyxy[0].tolist()

                    detections.append({
                        "label": name,
                        "confidence": conf,
                        "box": xyxy
                    })

                    print(f"[YOLO] Detected: {name} (conf={conf:.2f})")

                    if name == "person":
                        person_count += 1
                    elif name in VIOLATION_MAP:
                        vdef = VIOLATION_MAP[name]
                        vkey = vdef["type"]
                        if vkey not in seen_violations:
                            seen_violations.add(vkey)
                            alerts.append(vdef["alert"])
                            violations.append({
                                "type": vdef["type"],
                                "severity": vdef["severity"],
                                "label": name,
                                "alert": vdef["alert"],
                                "detail": vdef["detail"],
                                "confidence": round(conf * 100),
                            })
                            print(f"[PROCTOR] {vdef['severity']} VIOLATION: {name}")

            # Multi-face detection
            if person_count >= 2:
                msg = f"🚨 HIGH ALERT: {person_count} persons detected in frame!"
                alerts.append(msg)
                violations.append({
                    "type": "MULTI_FACE",
                    "severity": "CRITICAL",
                    "label": f"{person_count} persons",
                    "alert": msg,
                    "detail": "Only the candidate should be visible on camera.",
                    "confidence": 95,
                })
                print(f"[PROCTOR] CRITICAL: {person_count} persons detected!")
            
            print(f"[PROCTOR] Frame processed: {person_count} persons, {len(violations)} violations, {len(detections)} detections")

        # ── 2. Azure Face API (optional) ─────────────────────────────
        if run_face_api and self.azure_key:
            try:
                res = requests.post(
                    self.azure_endpoint,
                    headers=self.headers,
                    params=self.params,
                    data=frame_bytes,
                    timeout=5
                )
                if res.status_code == 200:
                    faces = res.json()
                    face_count = len(faces)
                    if face_count == 0:
                        alerts.append("⚠️ No face detected — candidate may have left")
                    elif face_count > 1:
                        alerts.append(f"⚠️ Azure: {face_count} faces confirmed")
                    for face in faces:
                        fr = face.get("faceRectangle", {})
                        if fr:
                            detections.append({
                                "label": "face",
                                "confidence": 1.0,
                                "box": [fr["left"], fr["top"], fr["left"]+fr["width"], fr["top"]+fr["height"]]
                            })
            except requests.exceptions.Timeout:
                print("[AZURE FACE] Request timed out")
            except Exception as e:
                print(f"[AZURE FACE] Exception: {e}")

        # Deduplicate alerts
        alerts = list(dict.fromkeys(alerts))

        return {
            "alerts": alerts,
            "detections": detections,
            "violations": violations,  # Structured list for rich frontend display
        }


# Lazy singleton
_engine_instance = None

def get_engine() -> ProctorEngine:
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = ProctorEngine()
    return _engine_instance