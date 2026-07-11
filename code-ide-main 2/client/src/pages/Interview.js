import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import axios from "axios";
import { globalAudioContext } from "./Landing"; 
import { useSession } from "../context/SessionContext";
import ProctorMonitor from "../components/proctoring/ProctorMonitor";

const Interview = () => {
  const { problemId } = useParams();
  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session") || "default";
  const navigate = useNavigate();
  const { userId } = useSession();

  const lastMsgCount = useRef(0);

  const [isDark, setIsDark] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  const [hasStarted, setHasStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const [problem, setProblem] = useState(null);
  const [code, setCode] = useState(`#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}`);
  const [userInput, setUserInput] = useState("");
  const [output, setOutput] = useState("");
  const [chatLog, setChatLog] = useState([{ role: "AI", text: "Welcome! I'm your tutor for today. Start by reading the problem on the left.", level: 0 }]);
  const [chatHistory, setChatHistory] = useState([]);
  const [timeLeft, setTimeLeft] = useState(600);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [micPermission, setMicPermission] = useState("unknown"); // 'unknown' | 'granted' | 'denied'
  const recognitionRef = useRef(null);
  const welcomePlayed = useRef(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' }).then(status => {
        setMicPermission(status.state); // 'granted', 'denied', 'prompt'
        status.onchange = () => setMicPermission(status.state);
      }).catch(() => setMicPermission("unknown"));
    }
  }, []);

  const T = {
    bg:        isDark ? "#020810"                    : "#f0f4fa",
    panel:     isDark ? "#050d1c"                    : "#ffffff",
    panel2:    isDark ? "#08152a"                    : "#eaf0fb",
    border:    isDark ? "rgba(16,96,240,.14)"        : "#c5d5f0",
    border2:   isDark ? "rgba(0,207,255,.18)"        : "#90bce8",
    text:      isDark ? "#edf4ff"                    : "#0c1d3a",
    muted:     isDark ? "#8aaed4"                    : "#426080",
    accent:    isDark ? "#1060f0"                    : "#1060f0",
    cyan:      isDark ? "#00cfff"                    : "#00cfff",
    mint:      isDark ? "#00e5a0"                    : "#00b37a",
    aiMsg:     isDark ? "rgba(16,96,240,0.06)"       : "#e3eeff",
    aiBorder:  isDark ? "rgba(0,207,255,.18)"        : "#b3cfff",
    userMsg:   isDark ? "rgba(16,96,240,0.18)"       : "#1060f0",
    input:     isDark ? "#0c1d3a"                    : "#fff",
    inputText: isDark ? "#edf4ff"                    : "#0c1d3a",
    glow:      isDark ? "rgba(16,96,240,.2)"         : "transparent",
    glow2:     isDark ? "rgba(0,207,255,.15)"        : "transparent",
    tabActive: isDark ? "#0c1d3a"                    : "#fff",
    toolbarBg: isDark ? "#050d1c"                    : "#f0f4fa",
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog, isThinking]);

  const stopAudio = useCallback(() => {
    try { globalAudioContext.pause(); globalAudioContext.currentTime = 0; } catch (e) {}
  }, []);

  const playBase64Audio = useCallback((base64String) => {
    try {
      if (!base64String) return;
      stopAudio(); // Stop any existing audio
      globalAudioContext.src = "data:audio/wav;base64," + base64String;
      globalAudioContext.load();
      const playPromise = globalAudioContext.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
            console.error("Audio playback error:", e);
            setTimeout(() => globalAudioContext.play().catch(m => console.log("Still blocked")), 500);
        });
      }
    } catch (e) { console.error(e); }
  }, [stopAudio]);

  useEffect(() => {
    const fetchProblem = async () => {
      try {
        const res = await axios.get(`${API_URL}/problem/${problemId || 1}`);
        setProblem(res.data);
      } catch (err) { console.error("Error fetching problem:", err); }
    };
    fetchProblem();
  }, [problemId, API_URL]);

  useEffect(() => {
    if (problem && !welcomePlayed.current) {
      welcomePlayed.current = true;
      const savedAudio = sessionStorage.getItem(`welcomeAudio_${sessionId}`);
      if (savedAudio) {
        playBase64Audio(savedAudio);
        sessionStorage.removeItem(`welcomeAudio_${sessionId}`);
      } else {
        axios.post(`${API_URL}/ai/welcome`, { code: "", problemId: problemId || 1 })
          .then(res => { if (res.data.audio) playBase64Audio(res.data.audio); })
          .catch(e => console.log(e));
      }
    }
  }, [problem, playBase64Audio, sessionId, problemId, API_URL]);

  const triggerAIAnalysis = useCallback(async (type) => {
    setIsThinking(true);
    try {
      const res = await axios.post(`${API_URL}/ai/${type}`, {
        code, problemId: problemId || 1, session_id: sessionId, user_id: userId
      });
      setChatLog(prev => [...prev, { role: "AI", text: res.data.feedback }]);
      if (res.data.level !== undefined) setHintLevel(res.data.level);
      if (res.data.audio) playBase64Audio(res.data.audio);
    } catch (err) {
      console.error("AI Error:", err.response?.data || err.message);
    } finally { setIsThinking(false); }
  }, [code, problemId, sessionId, userId, playBase64Audio, API_URL]);


  const handleEndInterview = useCallback(() => {
    stopAudio();
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} setIsRecording(false); }
    navigate(`/analysis?session=${sessionId}`);
  }, [stopAudio, sessionId, navigate]);

  const handleFinalSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setIsFinished(true); // Instantly trigger ProctorMonitor to stop tracks
    stopAudio();
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} setIsRecording(false); }
    try {
      const res = await axios.post(`${API_URL}/ai/evaluation`, { code, problemId: problemId || 1, session_id: sessionId, user_id: userId, time_taken: 600 - timeLeft });
      setChatLog(prev => [...prev, { role: "SYSTEM", text: "SUBMITTED" }, { role: "AI", text: res.data.feedback }]);
      if (res.data.audio) {
        setTimeout(() => navigate(`/analysis?session=${sessionId}`, { state: { finalAudio: res.data.audio } }), 1000);
      } else {
        setTimeout(() => navigate(`/analysis?session=${sessionId}`), 1000);
      }
    } catch (err) {
      console.error("Evaluation Error", err);
      navigate(`/analysis?session=${sessionId}`);
    }
    setIsSubmitting(false);
  }, [isSubmitting, code, problemId, sessionId, userId, playBase64Audio, stopAudio, navigate, API_URL, timeLeft]);

  const sendChatMessage = useCallback(async (msg) => {
    const text = msg || chatInput;
    if (!text.trim()) return;
    setChatLog(prev => [...prev, { role: "USER", text }]);
    setChatInput("");
    setIsThinking(true);
    try {
      const res = await axios.post(`${API_URL}/ai/chat`, {
        message: text, session_id: sessionId, user_id: userId, code, problemId: problemId || 1, history: chatHistory
      });
      const aiReply = res.data.feedback;
      setChatLog(prev => [...prev, { role: "AI", text: aiReply }]);
      setChatHistory(prev => [...prev, { role: "user", content: text }, { role: "assistant", content: aiReply }]);
      if (res.data.audio) playBase64Audio(res.data.audio);
    } catch (err) { console.error("Chat Error:", err); }
    finally { setIsThinking(false); }
  }, [chatInput, chatHistory, code, problemId, sessionId, userId, playBase64Audio, API_URL]);

  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      if (!('webkitSpeechRecognition' in window)) {
        alert("Web Speech API not supported. Try Chrome.");
        return;
      }
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      const initialInput = chatInput;
      let finalTranscript = '';
      recognition.onstart = () => setIsRecording(true);
      recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
          else interimTranscript += event.results[i][0].transcript;
        }
        setChatInput(initialInput + (initialInput ? " " : "") + finalTranscript + interimTranscript);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  const syncWithBackend = useCallback(async (currentOutput) => {
    if (!problem) return;
    try {
      const res = await axios.post(`${API_URL}/update_code`, {
        session_id: sessionId, user_id: userId, problem_statement: problem.description, current_code: code, compiler_output: currentOutput || output
      });
      if (res.data.messages) {
        const aiMessages = res.data.messages.filter(m => m.role === "AI");
        if (aiMessages.length > lastMsgCount.current) {
          setChatLog(prev => [...prev, ...aiMessages.slice(lastMsgCount.current)]);
          lastMsgCount.current = aiMessages.length;
        }
      }
      if (res.data.audio) playBase64Audio(res.data.audio);
    } catch (err) { console.error("Sync Error:", err); }
  }, [code, output, problem, sessionId, userId, playBase64Audio, API_URL]);

  useEffect(() => {
    if (!hasStarted || isFinished) return;
    if (timeLeft <= 0) { handleFinalSubmit(); return; }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, handleFinalSubmit, hasStarted, isFinished]);

  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  useEffect(() => {
    if (timeLeft > 0 && timeLeft < 600 && (600 - timeLeft) % 180 === 0) triggerAIAnalysis("periodic");
  }, [timeLeft, triggerAIAnalysis]);

  const runCode = async () => {
    try {
      const res = await axios.post(`${API_URL}/run`, { code, input: userInput });
      setOutput(res.data.output);
      await syncWithBackend(res.data.output);
    } catch (err) { setOutput("Execution Error: " + err.message); }
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60 < 10 ? '0' : '') + (s % 60)}`;


  if (!problem) return (
    <div style={{ height: '100vh', background: '#020810', color: '#edf4ff', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '18px', fontFamily: "'SF Pro Display','SF Pro Text','Segoe UI',system-ui,'Inter',sans-serif", gap: '12px' }}>
      <span style={{ color: '#00cfff', animation: 'ss-pulse 1.4s ease-in-out infinite' }}>◉</span> Loading Workspace...
    </div>
  );

  if (!hasStarted) {
    return (
      <div style={{ display: "flex", height: "100vh", background: T.bg, color: T.text, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "24px", fontFamily: "'SF Pro Display','SF Pro Text','Segoe UI',system-ui,'Inter',sans-serif" }}>
        <h1 style={{ color: T.text, fontSize: "36px", margin: 0, fontWeight: "800", letterSpacing: "-0.5px" }}>{problem?.title || "Interview Session"}</h1>
        <div style={{ background: T.panel, border: `1px solid ${T.border}`, padding: "24px", borderRadius: "16px", maxWidth: "480px", textAlign: "center", boxShadow: isDark ? `0 8px 32px ${T.glow}` : "0 8px 32px rgba(0,0,0,0.05)" }}>
          <p style={{ color: T.muted, fontSize: "16px", lineHeight: "1.6", margin: "0 0 24px 0" }}>
            Ready to begin? Clicking start will request <strong>camera and microphone</strong> permissions for AI proctoring, and begin your 10-minute timer.
          </p>
          <button 
            onClick={() => setHasStarted(true)}
            style={{ padding: "14px 32px", width: "100%", background: `linear-gradient(135deg, ${T.accent}, #0040b8)`, color: "#fff", border: "none", borderRadius: "12px", fontSize: "16px", fontWeight: "700", cursor: "pointer", boxShadow: isDark ? `0 0 20px ${T.glow}` : "0 4px 14px rgba(16,96,240,0.2)", transition: "transform 0.2s ease", transform: "translateY(0)" }}
            onMouseOver={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
            onMouseOut={(e) => e.currentTarget.style.transform = "translateY(0)"}
          >
            Start Interview
          </button>
        </div>
      </div>
    );
  }


  const iconBtn = (bg = T.panel2) => ({
    background: bg,
    border: `1px solid ${T.border}`,
    color: T.text,
    padding: "6px 10px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    transition: "all 0.2s ease",
    boxShadow: isDark ? `0 2px 8px ${T.glow}` : "none",
  });

  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, color: T.text, fontFamily: "'SF Pro Display','SF Pro Text','Segoe UI',system-ui,'Inter',sans-serif", overflow: "hidden", transition: "background 0.3s" }}>

      {/* ── LEFT: Problem Description (hidden in fullscreen) ─────── */}
      {!isFullscreen && (
        <div style={{ width: "300px", flexShrink: 0, display: "flex", flexDirection: "column", borderRight: `1px solid ${T.border}`, background: T.panel, padding: "20px", overflowY: "auto", transition: "background 0.3s", boxShadow: isDark ? `inset -1px 0 0 ${T.border2}` : "none" }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: T.text, letterSpacing: '0.2px' }}>{problem.title}</h2>
            <span style={{ background: 'rgba(255,60,60,0.15)', color: '#ff6b6b', border: '1px solid rgba(255,60,60,0.3)', padding: '2px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{problem.difficulty}</span>
          </div>
          <hr style={{ borderColor: T.border, margin: '10px 0', borderTop: `1px solid ${T.border}`, borderBottom: 'none' }} />
          <p style={{ whiteSpace: "pre-wrap", lineHeight: "1.8", fontSize: "13px", color: T.muted }}>{problem.description}</p>
        </div>
      )}

      {/* ── MIDDLE: Editor + Toolbar ─────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: showChat && !isFullscreen ? `1px solid ${T.border}` : "none", minWidth: 0 }}>

        {/* Toolbar — ScholarSync themed */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.toolbarBg, borderBottom: `1px solid ${T.border}`, paddingRight: "12px", height: "46px", backdropFilter: "blur(8px)", overflow: "hidden" }}>

          {/* Left: Language Tabs */}
          <div style={{ display: "flex", height: "100%" }}>
            {/* C++ only - Java and Python removed */}
          <div style={{ padding: "0 20px", display: "flex", alignItems: "center", background: T.tabActive, borderTop: `2px solid ${T.cyan}`, borderRight: `1px solid ${T.border}`, cursor: "pointer", fontSize: "13px", color: T.cyan, fontWeight: "600", letterSpacing: "0.3px", boxShadow: isDark ? `0 2px 12px ${T.glow2}` : "none" }}>
            C++
          </div>
          </div>

          {/* Center: Utility controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ background: isDark ? "rgba(16,96,240,0.1)" : "#e8f0fe", border: `1px solid ${T.border}`, padding: "4px 12px", borderRadius: "8px", display: "flex", alignItems: "center", boxShadow: isDark ? `0 0 8px ${T.glow}` : "none" }}>
              <span style={{ color: timeLeft < 60 ? "#ff6b6b" : T.mint, fontWeight: "700", fontSize: "13px", minWidth: "50px", textAlign: "center", fontFamily: "'SF Mono','Fira Code','Consolas',monospace", letterSpacing: "0.5px" }}>
                ⏳ {formatTime(timeLeft)}
              </span>
            </div>


            {!isFullscreen && !showChat && (
              <button
                style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.azure2 || '#3d7fff'})`, border: `1px solid ${T.border2}`, color: "#fff", padding: "6px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", boxShadow: isDark ? `0 0 16px ${T.glow}` : "none", transition: "all 0.2s ease", letterSpacing: "0.2px" }}
                onClick={() => setShowChat(true)} title="AI Help"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>
                AI Help
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button onClick={runCode}
              style={{ background: `linear-gradient(135deg, #00875a, ${T.mint})`, border: "1px solid rgba(0,229,160,0.3)", color: "#fff", padding: "5px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", fontWeight: "600", boxShadow: isDark ? "0 0 12px rgba(0,229,160,0.2)" : "none", transition: "all 0.2s ease", letterSpacing: "0.2px" }}>
              <span style={{ fontSize: "11px" }}>▶</span> Run Code
            </button>
            <button onClick={handleFinalSubmit} disabled={isSubmitting}
              style={{ background: isSubmitting ? "transparent" : "transparent", border: "1px solid rgba(255,107,107,0.3)", color: "#ff6b6b", padding: "5px 14px", borderRadius: "8px", cursor: isSubmitting ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: "600", transition: "all 0.2s ease" }}>
              {isSubmitting ? "Saving..." : "Finish Interview"}
            </button>
          </div>
        </div>

        {/* Monaco Editor */}
        <Editor
          height={isFullscreen ? "75vh" : "62vh"}
          theme={isDark ? "vs-dark" : "vs"}
          defaultLanguage="cpp"
          value={code}
          onChange={setCode}
          options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false }}
        />

        {/* Input / Output — ScholarSync themed */}
        <div style={{ padding: "12px 16px", display: "flex", gap: "14px", background: T.panel2, borderTop: `1px solid ${T.border}`, flex: 1 }}>
          <div style={{ flex: 1 }}>
            <small style={{ color: T.muted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "600" }}>Input (stdin)</small>
            <textarea
              style={{ width: "100%", height: "72px", background: T.input, color: T.mint, border: `1px solid ${T.border}`, padding: "10px", marginTop: '6px', borderRadius: '10px', fontFamily: "'SF Mono','Fira Code','Cascadia Code','Consolas',monospace", resize: 'none', fontSize: "13px", outline: "none", boxShadow: isDark ? `0 0 8px ${T.glow}` : "none", transition: "border 0.2s, box-shadow 0.2s" }}
              value={userInput} onChange={(e) => setUserInput(e.target.value)} />
            <button onClick={runCode}
              style={{ width: "100%", marginTop: "8px", padding: "9px", background: `linear-gradient(135deg, #00875a, ${T.mint})`, color: "#fff", border: "1px solid rgba(0,229,160,0.3)", cursor: "pointer", borderRadius: '10px', fontWeight: '700', fontSize: "13px", letterSpacing: "0.3px", boxShadow: isDark ? "0 0 12px rgba(0,229,160,0.15)" : "none", transition: "all 0.2s ease" }}>
              ▶ Run Tests
            </button>
          </div>
          <div style={{ flex: 1 }}>
            <small style={{ color: T.muted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "600" }}>Console Output</small>
            <pre style={{ background: T.input, height: "108px", padding: "10px", overflow: "auto", margin: '6px 0 0 0', fontSize: "13px", color: isDark ? "#00e5a0" : "#007700", border: `1px solid ${T.border}`, borderRadius: '10px', fontFamily: "'SF Mono','Fira Code','Cascadia Code','Consolas',monospace", boxShadow: isDark ? `inset 0 0 10px rgba(0,207,255,.04)` : "none" }}>
              {output || "Output will appear here..."}
            </pre>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Sidebar (Fixed Proctoring + Collapsible Chat) ─────────────────────── */}
      {!isFullscreen && (
        <div style={{ width: "340px", flexShrink: 0, display: "flex", flexDirection: "column", background: T.panel, transition: "background 0.3s", borderLeft: `1px solid ${T.border}`, boxShadow: isDark ? `-4px 0 20px rgba(16,96,240,.08)` : "none" }}>

          {/* Fixed Camera Section */}
          <ProctorMonitor sessionId={sessionId} onAutoSubmit={handleFinalSubmit} isActive={hasStarted && !isFinished} inline={true} />

          {/* Chat header / Toggle */}
          <div 
            onClick={() => setShowChat(!showChat)}
            style={{ padding: "14px 16px", borderBottom: showChat ? `1px solid ${T.border}` : "none", fontWeight: "600", background: T.panel2, fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "space-between", letterSpacing: "0.3px", cursor: "pointer", transition: "all 0.2s" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.cyan} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>
              <span style={{ color: T.text }}>AI Help</span>
            </div>
            <span style={{ color: T.muted, fontSize: "11px", fontWeight: "bold" }}>{showChat ? "▼ COLLAPSE" : "▶ EXPAND"}</span>
          </div>

          {/* Collapsible Chat Body */}
          {showChat && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>

          {/* Chat messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {chatLog.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === "USER" ? "flex-end" : "flex-start",
                maxWidth: "90%",
                padding: "10px 14px",
                borderRadius: msg.role === "USER" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: msg.role === "AI" ? T.aiMsg : T.userMsg,
                border: msg.role === "AI" ? `1px solid ${T.aiBorder}` : `1px solid rgba(16,96,240,.3)`,
                boxShadow: isDark ? (msg.role === "AI" ? `0 2px 12px ${T.glow2}` : `0 2px 12px ${T.glow}`) : "0 2px 6px rgba(0,0,0,0.08)",
                animation: "ss-fade-in 0.2s ease",
              }}>
                <small style={{ color: msg.role === "AI" ? T.cyan : "#edf4ff", fontSize: '10px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: "0.8px" }}>{msg.role}</small>
                <p style={{ margin: "5px 0 0 0", fontSize: "13px", lineHeight: "1.6", color: msg.role === "USER" ? "#edf4ff" : T.text, whiteSpace: "pre-wrap" }}>{msg.text}</p>
              </div>
            ))}
            {isThinking && (
              <div style={{ alignSelf: "flex-start", background: T.aiMsg, border: `1px solid ${T.aiBorder}`, padding: "8px 16px", borderRadius: "14px 14px 14px 4px", fontSize: "12px", color: T.cyan, fontStyle: "italic", animation: "ss-pulse 1.4s ease-in-out infinite" }}>
                AI is thinking...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div style={{ padding: "10px 12px", background: T.panel2, borderTop: `1px solid ${T.border}`, display: "flex", gap: "6px" }}>
            <input type="text" value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendChatMessage()}
              placeholder="Ask for guidance..."
              style={{ flex: 1, background: T.input, color: T.inputText, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "9px 12px", fontSize: "13px", outline: "none", transition: "border 0.2s, box-shadow 0.2s", fontFamily: "inherit" }} />
            <button onClick={() => sendChatMessage()} style={{ ...iconBtn(), padding: "8px 10px" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
            <button onClick={toggleRecording}
              style={{ ...iconBtn(isRecording ? "rgba(255,60,60,0.15)" : undefined), border: isRecording ? "1px solid rgba(255,107,107,0.4)" : `1px solid ${T.border}`, color: isRecording ? "#ff6b6b" : T.text, padding: "8px 10px" }} title="Voice input">
              {isRecording ? "🔴" : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>}
            </button>
          </div>

          {/* Hints section */}
          <div style={{ padding: "14px 16px", background: T.panel2, borderTop: `1px solid ${T.border}` }}>
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <small style={{ color: T.muted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: '600' }}>Hint Level</small>
              <div style={{ display: 'flex', gap: '5px' }}>
                {[1, 2, 3, 4, 5].map(l => (
                  <div key={l} style={{ width: '20px', height: '4px', borderRadius: '3px', background: l <= hintLevel ? T.cyan : T.border, boxShadow: l <= hintLevel && isDark ? `0 0 6px ${T.glow2}` : "none", transition: 'background 0.3s, box-shadow 0.3s' }} />
                ))}
              </div>
            </div>
            <button onClick={() => triggerAIAnalysis("hint")} disabled={isThinking}
              style={{ width: "100%", padding: "10px", background: isDark ? "rgba(16,96,240,0.08)" : "#e8f0fe", border: `1px solid ${T.border}`, color: T.text, cursor: isThinking ? "not-allowed" : "pointer", borderRadius: '10px', transition: 'all 0.2s', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isThinking ? 0.6 : 1 }}
              onMouseOver={(e) => { if (!isThinking) { e.currentTarget.style.background = isDark ? "rgba(16,96,240,0.15)" : "#d8e8fe"; e.currentTarget.style.boxShadow = isDark ? `0 0 14px ${T.glow}` : "none"; } }}
              onMouseOut={(e) => { e.currentTarget.style.background = isDark ? "rgba(16,96,240,0.08)" : "#e8f0fe"; e.currentTarget.style.boxShadow = "none"; }}
            >
              {isThinking ? "Consulting..." : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.cyan} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg> Request a Hint</>}
            </button>
          </div>
          </div>
          )}
        </div>
      )}

      {/* Floating chat toggle when in fullscreen */}
      {(isFullscreen && !showChat) && (
        <button
          onClick={() => { setIsFullscreen(false); setShowChat(true); }}
          title="Open AI Help"
          style={{
            position: "fixed", bottom: "24px", right: "24px",
            background: isDark ? T.panel2 : "#fff",
            color: T.cyan,
            border: `1px solid ${T.border2}`,
            borderRadius: "50%",
            width: "54px",
            height: "54px",
            cursor: "pointer",
            fontSize: "22px",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: isDark ? `0 0 20px ${T.glow2}, 0 4px 16px rgba(0,0,0,0.4)` : "0 4px 16px rgba(0,0,0,0.15)",
            transition: "all 0.2s ease",
          }}
        >
          💬
        </button>
      )}
    </div>
  );
};

export default Interview;
