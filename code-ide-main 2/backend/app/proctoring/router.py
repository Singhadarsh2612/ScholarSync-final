# router.py
import base64
import binascii
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.proctoring.engine import get_engine

router = APIRouter()


class ProctorPayload(BaseModel):
    session_id: str
    user_id: str
    frame_base64: str
    frame_id: int


@router.post("/proctor")
def process_proctor_frame(payload: ProctorPayload):
    # Strip data URI prefix if present
    if payload.frame_base64.startswith("data:image"):
        base64_data = payload.frame_base64.split(",", 1)[1]
    else:
        base64_data = payload.frame_base64

    if not base64_data.strip():
        raise HTTPException(status_code=400, detail="Empty frame data")

    try:
        img_data = base64.b64decode(base64_data)
    except binascii.Error:
        raise HTTPException(status_code=400, detail="Invalid base64 encoding")

    # Azure Face API every 30 frames (~1 call per 3s at 10fps)
    check_face_count = (payload.frame_id % 30 == 0)

    try:
        result = get_engine().process_frame(
            frame_bytes=img_data,
            run_face_api=check_face_count
        )
        alerts = result.get("alerts", [])
        detections = result.get("detections", [])
        violations = result.get("violations", [])
    except Exception as e:
        import traceback
        print(f"[PROCTOR ERROR] {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Frame processing failed")

    return {
        "success": True,
        "session_id": payload.session_id,
        "frame_id": payload.frame_id,
        "alerts": alerts,
        "detections": detections,
        "violations": violations
    }