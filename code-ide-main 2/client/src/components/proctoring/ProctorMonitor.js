import React, { useRef, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { globalAudioContext } from "../../pages/Landing";

/**
 * ProctorMonitor - Continuously sends frames to /ai/proctor every 10 seconds.
 * Strictly respects the `isActive` prop for media lifecycle (camera/mic).
 */
const ProctorMonitor = ({ sessionId, onAutoSubmit, isActive, inline }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null); // To hold the MediaStream object
  const intervalRef = useRef(null); // To hold the interval ID

  // Refs for values used inside setInterval (avoids stale closures)
  const hasPermissionRef = useRef(false);
  const warningCountRef = useRef(0);
  const frameIdRef = useRef(0);

  // UI state only
  const [permError, setPermError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [facesDetected, setFacesDetected] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [activeViolations, setActiveViolations] = useState([]); // List of {type, alert, detail, severity}
  const [isHighAlert, setIsHighAlert] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

  // ── Core: send a frame to the backend ────────────────────────────────────
  const sendFrame = useCallback(async () => {
    if (!hasPermissionRef.current || !isActive) return; // Ensure active before sending
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    // Capture frame
    const tmp = document.createElement("canvas");
    tmp.width = 640;
    tmp.height = 480;
    tmp.getContext("2d").drawImage(video, 0, 0, 640, 480);
    const frameBase64 = tmp.toDataURL("image/jpeg", 0.75);
    frameIdRef.current += 1;

    try {
      const res = await axios.post(`${API_URL}/ai/proctor`, {
        session_id: sessionId || "default",
        user_id: "proctor_user",
        frame_base64: frameBase64,
        frame_id: frameIdRef.current,
      });

      const violations = res.data?.violations || [];
      const detections = res.data?.detections || [];
      const personCount = detections.filter(d => d.label === "person" || d.label === "face").length;

      setFacesDetected(personCount);
      drawDetections(detections, personCount);
      
      setActiveViolations(violations);
      
      const hasHighViolation = violations.some(v => v.severity === "HIGH" || v.severity === "CRITICAL");
      setIsHighAlert(hasHighViolation);

      if (violations.length > 0) {
        triggerWarning();
      }
    } catch (err) {
      console.error("[Proctor] API Error:", err.message);
    }
  }, [sessionId, API_URL, isActive]); // Add isActive to dependencies

  // ── Draw bounding boxes on canvas overlay ────────────────────────────────
  function drawDetections(detections, faceCount) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const det of detections) {
      if (!det.box || det.box.length < 4) continue;
      const [x1, y1, x2, y2] = det.box;
      const isPerson = det.label === "person" || det.label === "face";
      const isViolation = ["cell phone", "book", "laptop", "remote"].includes(det.label);
      const isExtra = (isPerson && faceCount >= 2) || isViolation;

      ctx.lineWidth = isExtra ? 4 : 2;
      ctx.strokeStyle = isExtra ? "#ff3e3e" : isPerson ? "#00cfff" : "#ffb400";
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      const label = `${det.label} ${Math.round(det.confidence * 100)}%`;
      ctx.font = "bold 13px sans-serif";
      const tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = isExtra ? "rgba(220,20,20,0.85)" : isPerson ? "rgba(0,160,200,0.85)" : "rgba(200,140,0,0.85)";
      ctx.fillRect(x1, y1 - 22, tw, 22);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, x1 + 5, y1 - 6);
    }
  }

  const playBase64Audio = (base64String) => {
    try {
      if (!base64String || !globalAudioContext) return;
      try { globalAudioContext.pause(); globalAudioContext.currentTime = 0; } catch (e) {}
      globalAudioContext.src = "data:audio/wav;base64," + base64String;
      globalAudioContext.load();
      globalAudioContext.play().catch(e => console.error("Proctor audio error:", e));
    } catch (e) { console.error(e); }
  };

  const triggerWarning = useCallback(() => {
    warningCountRef.current += 1;
    const count = warningCountRef.current;
    setWarningCount(count);

    let warningText = "";
    if (count >= 3) {
      warningText = "This is your final warning. Please stop this immediately. Your interview is being submitted now.";
    } else {
      warningText = `Warning ${count}. Please stop this. If you continue, your interview will be submitted.`;
    }

    // Call backend for TTS
    axios.post(`${API_URL}/ai/warning_tts`, { text: warningText })
      .then(res => {
        if (res.data?.audio) playBase64Audio(res.data.audio);
      })
      .catch(err => console.error("TTS Error:", err));

    if (count >= 3 && onAutoSubmit) {
      console.warn("[Proctor] Max warnings reached — auto submitting");
      setTimeout(onAutoSubmit, 4000); // Wait 4s for audio to begin/play before redirecting
    }
  }, [API_URL, onAutoSubmit]);

  // Camera Lifecycle Manager
  useEffect(() => {
    let isMounted = true;
    let localStream = null;

    const startCamera = async () => {
      setPermError(null);
      setCameraReady(false);
      hasPermissionRef.current = false;
      warningCountRef.current = 0;
      setWarningCount(0);
      setActiveViolations([]);
      setIsHighAlert(false);

      const attempts = [
        { video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: true },
        { video: true, audio: true },
        { video: { width: 320, height: 240 }, audio: true },
      ];

      for (const constraints of attempts) {
        try {
          localStream = await navigator.mediaDevices.getUserMedia(constraints);
          break; // Success, break out of loop
        } catch (err) {
          console.warn("[Proctor] Camera attempt failed:", constraints, err.name, err.message);
          localStream = null;
        }
      }

      // If unmounted while fetching, kill the tracks immediately
      if (!isMounted) {
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
        }
        return;
      }

      if (localStream) {
        streamRef.current = localStream;
        if (videoRef.current) {
          videoRef.current.srcObject = localStream;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              videoRef.current.play().catch(() => {});
            }
            hasPermissionRef.current = true;
            setCameraReady(true);
            setPermError(null);
            console.log("[Proctor] Camera started ✓");

            // Start the frame sending loop once video is genuinely active
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => {
              if (streamRef.current) {
                const tracks = streamRef.current.getTracks();
                const isAlive = tracks.length > 0 && tracks.every(t => t.readyState === 'live' && t.enabled);
                if (!isAlive) {
                  console.error("[Proctor] Critical Violation: Camera feed disabled or revoked mid-session!");
                  triggerWarning();
                  return; 
                }
              }
              sendFrame();
            }, 10000);
            setTimeout(sendFrame, 2000);
          };
        }
      } else {
        setPermError("Camera blocked. Please allow access and refresh.");
        console.error("Camera access denied or error: No suitable camera stream found.");
      }
    };

    const stopCamera = () => {
      console.log("[Proctor] Stopping camera and clearing intervals.");
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      hasPermissionRef.current = false;
      setCameraReady(false);
      setPermError(null);
      setFacesDetected(0);
      setWarningCount(0);
      warningCountRef.current = 0;
      setActiveViolations([]);
      setIsHighAlert(false);
    };

    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isActive, sendFrame]); // sendFrame is a dependency because it's called inside startCamera

  if (!isActive) return null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={
      inline 
      ? {
          width: "100%",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          background: "linear-gradient(145deg, #0c1d3a, #08152a)",
          flexShrink: 0
        }
      : {
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "10px",
          pointerEvents: "none",
        }
    }>
      {/* VIOLATION CARDS */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: inline ? "100%" : "260px" }}>
        {activeViolations.map((v, i) => (
          <div key={i} style={{
            background: v.severity === "CRITICAL" || v.severity === "HIGH" ? "rgba(220,20,20,0.95)" : "rgba(245,158,11,0.95)",
            color: "#fff",
            padding: "12px 16px",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.1)",
            animation: "ss-shake 0.4s ease, ss-fade-in 0.3s ease",
            pointerEvents: "auto",
          }}>
            <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "2px" }}>{v.alert}</div>
            <div style={{ fontSize: "11px", opacity: 0.9 }}>{v.detail}</div>
            {v.confidence && <div style={{ fontSize: "9px", marginTop: "4px", background: "rgba(0,0,0,0.2)", display: "inline-block", padding: "1px 6px", borderRadius: "10px" }}>Confidence: {v.confidence}%</div>}
          </div>
        ))}
        
        {warningCount > 0 && activeViolations.length === 0 && (
          <div style={{
            background: "rgba(30,41,59,0.9)",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: "10px",
            fontSize: "12px",
            textAlign: "center",
            border: "1px solid rgba(255,255,255,0.05)",
            pointerEvents: "auto",
          }}>
            ⚠️ Total Warnings: <span style={{ color: "#ffb400", fontWeight: "700" }}>{warningCount}/3</span>
          </div>
        )}
      </div>

      {/* CAMERA PREVIEW */}
      <div style={{
        width: inline ? "100%" : "220px",
        height: inline ? "210px" : "165px",
        borderRadius: "12px",
        overflow: "hidden",
        background: "#050d1c",
        border: `2px solid ${isHighAlert ? "#ff3e3e" : activeViolations.length > 0 ? "#f59e0b" : cameraReady ? "rgba(16,96,240,0.4)" : "rgba(100,100,100,0.4)"}`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.6)${isHighAlert ? ", 0 0 20px rgba(255,62,62,0.3)" : ""}`,
        position: "relative",
        transition: "all 0.3s ease",
        pointerEvents: "auto",
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: "scaleX(-1)", pointerEvents: "none" }}
        />
        {!cameraReady && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(5,13,28,0.9)", color: permError ? "#ff6b6b" : "#ffb400", textAlign: "center", padding: "15px" }}>
            <span style={{ fontSize: "24px", marginBottom: "8px" }}>{permError ? "🚫" : "⏳"}</span>
            <span style={{ fontSize: "11px", fontWeight: "700" }}>{permError ? "Camera Error" : "Initializing..."}</span>
          </div>
        )}
        {cameraReady && (
          <div style={{ position: "absolute", top: "8px", left: "8px", display: "flex", gap: "4px" }}>
             <div style={{ background: facesDetected >= 2 ? "#ef4444" : "rgba(16,185,129,0.8)", color: "#fff", padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "700", backdropFilter: "blur(4px)" }}>
              {facesDetected} {facesDetected === 1 ? "Person" : "Persons ⚠"}
            </div>
          </div>
        )}
      </div>

      <div style={{
        background: "rgba(15,23,42,0.9)",
        backdropFilter: "blur(12px)",
        color: isHighAlert ? "#ff3e3e" : activeViolations.length > 0 ? "#f59e0b" : "#10b981",
        padding: "6px 14px",
        borderRadius: "20px",
        border: "1px solid rgba(255,255,255,0.08)",
        fontSize: "10px",
        fontWeight: "800",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        letterSpacing: "0.5px",
        textTransform: "uppercase",
        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
      }}>
        <div style={{ width: "6px", height: "6px", background: "currentColor", borderRadius: "50%", animation: "ss-pulse 1.5s infinite" }} />
        {cameraReady ? `Monitoring Active · ${warningCount}/3` : "Starting..."}
      </div>
    </div>
  );
};

export default ProctorMonitor;
