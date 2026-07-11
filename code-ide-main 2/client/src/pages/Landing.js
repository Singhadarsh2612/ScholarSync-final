import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useSession } from "../context/SessionContext";
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
    Tooltip, ResponsiveContainer
} from "recharts";

export const globalAudioContext = new Audio();
globalAudioContext.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="; // 1ms silent wav

const CHART_COLORS = ["#00cfff", "#6aa0ff", "#00e5a0", "#3d7fff", "#f59e0b", "#a855f7", "#84cc16"];

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ background: "rgba(5,13,28,0.97)", border: "1px solid rgba(16,96,240,.25)", borderRadius: "8px", padding: "8px 14px", fontSize: "13px", color: "#edf4ff", boxShadow: "0 4px 16px rgba(16,96,240,.2)" }}>
                <strong>{payload[0].name}</strong>: {payload[0].value}
            </div>
        );
    }
    return null;
};

const Landing = () => {
    const navigate = useNavigate();
    const API_URL = process.env.REACT_APP_API_URL || "https://codeide-backend.mangopebble-d7a787f1.centralindia.azurecontainerapps.io";
    const { session, userId, startSession, setResumeData, clearSession, hasActiveSession } = useSession();
    const [resumeFile, setResumeFile] = useState(null);
    const [isParsing, setIsParsing] = useState(false);
    const [parsedData, setParsedData] = useState(null);
    const [rawData, setRawData] = useState(null);
    const [sessionId] = useState(
        () => session.sessionId || userId || Math.random().toString(36).substring(7)
    );
    const [showUpload, setShowUpload] = useState(false);

    const handleUpload = async () => {
        if (!resumeFile) return;
        setIsParsing(true);
        try {
            const formData = new FormData();
            formData.append("file", resumeFile);
            formData.append("session_id", sessionId);
            formData.append("user_id", userId);
            const res = await axios.post(`${API_URL}/ai/parse_resume`, formData);
            if (res.data.success) {
                const cv = res.data.data || {};
                setRawData(cv);
                setResumeData(resumeFile.name, cv);
                const name = cv.name || "Candidate";
                const skills = (cv.skills && Object.values(cv.skills).flat().filter(Boolean).join(", ")) || "Extracted core skills.";
                const summary = `Name: ${name}\nSkills Detected: ${skills}\nExperience Length: ${cv.experience ? cv.experience.length : 0} roles.\n\nYour interviewer has saved this context to personalize your questions.`;
                setParsedData(summary);
            } else {
                setParsedData("Failed to parse resume, but you can still proceed.");
                setRawData(null);
            }
        } catch (err) {
            console.error("Resume parsing error:", err);
            setParsedData("Network error while parsing resume, but you can still proceed.");
            setRawData(null);
        } finally {
            setIsParsing(false);
        }
    };

    const handleStartInterview = async () => {
        startSession(sessionId);
        try { 
            globalAudioContext.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
            globalAudioContext.load();
            globalAudioContext.play().catch(e => console.warn("Audio unlock prevented", e)); 
        } catch(e){}
        navigate(`/topics?session=${sessionId}`);
    };

    const getSkillsPieData = () => {
        if (!rawData || !rawData.skills) return [];
        const sk = rawData.skills;
        const data = [];
        if (sk.languages && sk.languages.length) data.push({ name: "Languages", value: sk.languages.length });
        if (sk.tools && sk.tools.length) data.push({ name: "Tools & Frameworks", value: sk.tools.length });
        if (sk.concepts && sk.concepts.length) data.push({ name: "Concepts", value: sk.concepts.length });
        return data;
    };

    const getBarData = () => {
        if (!rawData) return [];
        return [
            { name: "Projects", count: rawData.projects ? rawData.projects.length : 0 },
            { name: "Experience", count: rawData.experience ? rawData.experience.length : 0 },
            { name: "Education", count: rawData.education ? rawData.education.length : 0 },
            { name: "Achievements", count: rawData.achievements ? rawData.achievements.length : 0 },
        ];
    };

    const skillsPieData = getSkillsPieData();
    const barData = getBarData();

    const bgStyle = {
        minHeight: "100vh",
        width: "100vw",
        background: "#020810",
        backgroundImage: [
            "radial-gradient(ellipse 80% 60% at 50% -5%, rgba(16,96,240,.18), transparent)",
            "linear-gradient(rgba(16,96,240,.03) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(16,96,240,.03) 1px, transparent 1px)",
        ].join(", "),
        backgroundSize: "auto, 64px 64px, 64px 64px",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'SF Pro Display','SF Pro Text','Segoe UI',system-ui,'Inter',sans-serif",
        overflowY: "auto",
        position: "relative",
    };

    return (
        <div style={bgStyle}>

            {/* ── Fixed top nav bar ──────────────── */}
            <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: "58px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", background: "rgba(2,8,16,.88)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(16,96,240,.1)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "linear-gradient(135deg, #1060f0, #00cfff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>⚡</div>
                    <span style={{ color: "#edf4ff", fontWeight: "700", fontSize: "15px", letterSpacing: "-0.2px" }}>ScholarSync</span>
                    <span style={{ color: "#426080", fontSize: "13px" }}>/ Interview Module</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                        <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#00e5a0", boxShadow: "0 0 6px #00e5a0", animation: "ss-agent-dot-pulse 2s ease-in-out infinite" }} />
                        <span style={{ color: "#8aaed4", fontSize: "13px" }}>System Ready</span>
                    </div>
                    {hasActiveSession && (
                        <button onClick={() => navigate(`/interview/1?session=${session.sessionId}`)} style={{ padding: "7px 14px", background: "linear-gradient(135deg, #1060f0, #0040b8)", color: "#edf4ff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "700", boxShadow: "0 0 12px rgba(16,96,240,.35)" }}>Resume Session ›</button>
                    )}
                </div>
            </nav>

            {/* ── Hero section ─────────────────────────────────────── */}
            {!parsedData && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", textAlign: "center", paddingTop: "90px", paddingBottom: "48px", paddingLeft: "24px", paddingRight: "24px", animation: "ss-fade-in 0.6s ease" }}>

                    {/* AI Orb */}
                    <div style={{ position: "relative", width: "160px", height: "160px", margin: "0 auto 32px auto", flexShrink: 0 }}>
                        <div style={{ position: "absolute", inset: "0", borderRadius: "50%", border: "1px solid rgba(16,96,240,.22)", animation: "ss-orbit-slow 14s linear infinite" }}>
                            <div style={{ position: "absolute", top: "50%", left: "50%", width: "9px", height: "9px", borderRadius: "50%", background: "#00cfff", boxShadow: "0 0 10px #00cfff, 0 0 20px rgba(0,207,255,.5)", animation: "ss-node-orbit 14s linear infinite", marginTop: "-4.5px", marginLeft: "-4.5px" }} />
                        </div>
                        <div style={{ position: "absolute", inset: "20px", borderRadius: "50%", border: "1px solid rgba(0,207,255,.15)", animation: "ss-orbit-fast 9s linear infinite" }}>
                            <div style={{ position: "absolute", top: "50%", left: "50%", width: "7px", height: "7px", borderRadius: "50%", background: "#6aa0ff", boxShadow: "0 0 8px #6aa0ff", animation: "ss-node-orbit-2 9s linear infinite", marginTop: "-3.5px", marginLeft: "-3.5px" }} />
                        </div>
                        <div style={{ position: "absolute", inset: "36px", borderRadius: "50%", border: "1px solid rgba(16,96,240,.3)", animation: "ss-orbit-slow 6s linear infinite" }}>
                            <div style={{ position: "absolute", top: "50%", left: "50%", width: "5px", height: "5px", borderRadius: "50%", background: "#00e5a0", boxShadow: "0 0 6px #00e5a0", animation: "ss-node-orbit-3 6s linear infinite", marginTop: "-2.5px", marginLeft: "-2.5px" }} />
                        </div>
                        <div style={{ position: "absolute", inset: "50px", borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, #4d8fff, #1060f0 55%, #020d20)", animation: "ss-orb-breathe 3s ease-in-out infinite", boxShadow: "0 0 40px rgba(16,96,240,.4), 0 0 80px rgba(16,96,240,.15)" }} />
                    </div>

                    {/* Badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase" }}>
                        <span style={{ color: "#426080" }}>Intelligent Evaluation</span>
                        <span style={{ color: "#2a3e5a" }}>·</span>
                        <span style={{ color: "#6aa0ff" }}>ScholarSync Module</span>
                    </div>

                    {/* Title */}
                    <h1 style={{ fontSize: "clamp(2.4rem, 5.5vw, 4.2rem)", fontWeight: "800", margin: "0 0 12px 0", lineHeight: "1.08", letterSpacing: "-0.5px" }}>
                        <span style={{ background: "linear-gradient(110deg, #fff 30%, #6aa0ff 65%, #00cfff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>ScholarSync</span>
                        <span style={{ color: "#edf4ff" }}> AI-Powered</span><br />
                        <span style={{ color: "#edf4ff" }}>Interview</span>
                        <span style={{ background: "linear-gradient(110deg, #00cfff, #6aa0ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}> Module</span>
                    </h1>

                    <p style={{ fontSize: "1.15rem", color: "#426080", fontWeight: "600", margin: "0 0 14px 0" }}>for students who mean business</p>

                    <p style={{ color: "#8aaed4", fontSize: "15px", maxWidth: "560px", lineHeight: "1.8", margin: "0 0 32px 0" }}>
                        Practice technical interviews with an AI system that evaluates your coding logic,
                        analyzes your responses in real time, and generates a personalized feedback report.
                        The complete technical interview environment built for students.
                    </p>

                    {/* CTA buttons */}
                    <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", justifyContent: "center", marginBottom: showUpload ? "24px" : "0" }}>
                        <button
                            onClick={handleStartInterview}
                            style={{ padding: "14px 32px", background: "linear-gradient(135deg, #1060f0, #0040b8)", color: "#edf4ff", border: "1px solid rgba(16,96,240,.4)", borderRadius: "10px", fontWeight: "700", cursor: "pointer", fontSize: "15px", boxShadow: "0 0 24px rgba(16,96,240,.35)", transition: "all 0.25s", display: "flex", alignItems: "center", gap: "8px", letterSpacing: "0.2px" }}
                            onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(16,96,240,.55)"; }}
                            onMouseOut={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 0 24px rgba(16,96,240,.35)"; }}
                        >
                            ⚡ Start AI Interview →
                        </button>
                        <button
                            onClick={() => setShowUpload(v => !v)}
                            style={{ padding: "14px 28px", background: "transparent", color: showUpload ? "#00cfff" : "#8aaed4", border: `1px solid ${showUpload ? "rgba(0,207,255,.35)" : "rgba(16,96,240,.22)"}`, borderRadius: "10px", fontWeight: "600", cursor: "pointer", fontSize: "15px", transition: "all 0.2s", letterSpacing: "0.2px" }}
                            onMouseOver={e => { e.currentTarget.style.background = "rgba(16,96,240,.1)"; e.currentTarget.style.color = "#edf4ff"; }}
                            onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = showUpload ? "#00cfff" : "#8aaed4"; }}
                        >
                            📎 Upload Resume
                        </button>
                    </div>

                    {/* Upload panel */}
                    {showUpload && (
                        <div style={{ width: "100%", maxWidth: "440px", background: "linear-gradient(145deg, #0c1d3a, #08152a)", border: "1px solid rgba(0,207,255,.22)", borderRadius: "14px", padding: "20px 22px", textAlign: "left", animation: "ss-slide-up 0.3s ease", marginBottom: "0" }}>
                            <div style={{ fontSize: "10px", color: "#00cfff", fontWeight: "700", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: "12px" }}>▸ Context Upload — Optional</div>
                            <label
                                style={{ display: "block", cursor: "pointer", background: "rgba(16,96,240,.05)", border: "1px dashed rgba(0,207,255,.3)", borderRadius: "10px", padding: "14px", transition: "all 0.2s", marginBottom: resumeFile ? "12px" : "0" }}
                                onMouseOver={e => { e.currentTarget.style.borderColor = "#00cfff"; e.currentTarget.style.boxShadow = "0 0 14px rgba(0,207,255,.18)"; }}
                                onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(0,207,255,.3)"; e.currentTarget.style.boxShadow = "none"; }}
                            >
                                <input type="file" accept=".pdf,.docx,.txt" onChange={e => setResumeFile(e.target.files[0])} style={{ display: "none" }} />
                                {resumeFile ? (
                                    <span style={{ color: "#00cfff", fontSize: "13px" }}>📎 {resumeFile.name}</span>
                                ) : (
                                    <div>
                                        <div style={{ color: "#426080", fontSize: "13px", marginBottom: "3px" }}>Upload your resume (PDF, DOCX, or TXT)</div>
                                        <div style={{ color: "#2a3e5a", fontSize: "11px" }}>Providing your CV lets the AI personalize interview questions to your background</div>
                                    </div>
                                )}
                            </label>
                            {resumeFile && (
                                <button onClick={handleUpload} disabled={isParsing} style={{ width: "100%", padding: "11px", background: isParsing ? "rgba(16,96,240,.1)" : "linear-gradient(135deg, #1060f0, #0040b8)", color: "#edf4ff", border: "1px solid rgba(16,96,240,.4)", borderRadius: "10px", fontWeight: "600", cursor: isParsing ? "not-allowed" : "pointer", fontSize: "13px", letterSpacing: "0.3px", boxShadow: isParsing ? "none" : "0 0 20px rgba(16,96,240,.3)", transition: "all 0.2s", opacity: isParsing ? 0.6 : 1 }}>
                                    {isParsing ? "⟳ Analyzing Context..." : "🔍 Analyze Resume"}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Stats row */}
                    <div style={{ display: "flex", gap: "52px", marginTop: "48px", flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
                        {[
                            { val: "3",    label: "AI Systems Active" },
                            { val: "∞",    label: "Question Bank" },
                            { val: "Real‑time",  label: "Code Feedback" },
                        ].map((s, i) => (
                            <div key={i} style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "2rem", fontWeight: "800", color: "#edf4ff", lineHeight: "1", letterSpacing: "-0.5px" }}>{s.val}</div>
                                <div style={{ fontSize: "11px", color: "#426080", marginTop: "6px", letterSpacing: "0.6px", textTransform: "uppercase" }}>{s.label}</div>
                            </div>
                        ))}
                    </div>

                </div>
            )}





            {/* --- PERSONALIZED DASHBOARD AFTER PARSING --- */}
            {parsedData && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", paddingTop: "90px", paddingBottom: "48px", paddingLeft: "24px", paddingRight: "24px", animation: "ss-fade-in 0.6s ease" }}>
                    <div style={{ zIndex: 1, width: "100%", maxWidth: "980px", color: "#edf4ff" }}>
                    {/* Header Card */}
                    <div style={{ background: "linear-gradient(145deg, #0c1d3a, #08152a)", borderRadius: "18px", border: "1px solid rgba(16,96,240,.18)", padding: "28px 36px", marginBottom: "22px", backdropFilter: "blur(14px)", boxShadow: "0 20px 60px rgba(16,96,240,.15)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
                                <span style={{ fontSize: "28px" }}>✅</span>
                                <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: "700", background: "linear-gradient(110deg, #ffffff, #6aa0ff, #00cfff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Profile Analyzed</h1>
                            </div>
                            {rawData && (
                                <p style={{ margin: 0, color: "#8aaed4", fontSize: "15px" }}>
                                    Welcome, <strong style={{ color: "#00cfff" }}>{rawData.name || "Candidate"}</strong>! Your profile has been personalized.
                                </p>
                            )}
                            {rawData?.contact?.email && (
                                <p style={{ margin: "6px 0 0 0", color: "#426080", fontSize: "13px" }}>📧 {rawData.contact.email}</p>
                            )}
                            {rawData?.contact?.github && (
                                <p style={{ margin: "4px 0 0 0", color: "#426080", fontSize: "13px" }}>🔗 {rawData.contact.github}</p>
                            )}
                            {rawData?.contact?.linkedin && (
                                <p style={{ margin: "4px 0 0 0", color: "#426080", fontSize: "13px" }}>💼 {rawData.contact.linkedin}</p>
                            )}
                        </div>
                        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                            <button
                                onClick={() => navigate(rawData?.name ? `/dashboard?name=${encodeURIComponent(rawData.name)}` : "/dashboard")}
                                style={{
                                    padding: "13px 22px", background: "rgba(16,96,240,.1)",
                                    color: "#8aaed4", border: "1px solid rgba(16,96,240,.25)", borderRadius: "12px", fontWeight: "600",
                                    cursor: "pointer", fontSize: "14px",
                                    transition: "all 0.2s", whiteSpace: "nowrap",
                                    display:'none'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.background = "rgba(16,96,240,.2)"; e.currentTarget.style.color = "#edf4ff"; }}
                                onMouseOut={(e) => { e.currentTarget.style.background = "rgba(16,96,240,.1)"; e.currentTarget.style.color = "#8aaed4"; }}
                            >
                                📊 Analytics
                            </button>
                            <button
                                onClick={handleStartInterview}
                                style={{
                                    padding: "13px 28px", background: "linear-gradient(135deg, #1060f0, #0040b8)",
                                    color: "#edf4ff", border: "1px solid rgba(16,96,240,.4)", borderRadius: "12px", fontWeight: "700",
                                    cursor: "pointer", fontSize: "15px", boxShadow: "0 0 24px rgba(16,96,240,.35)",
                                    transition: "all 0.25s", letterSpacing: "0.3px", whiteSpace: "nowrap"
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 32px rgba(16,96,240,.55)"; }}
                                onMouseOut={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 0 24px rgba(16,96,240,.35)"; }}
                            >
                                🚀 Enter Interview Room
                            </button>
                        </div>
                    </div>

                    {/* Charts Row */}
                    {rawData && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px", marginBottom: "22px" }}>
                            {/* Pie Chart - Skills Breakdown */}
                            <div style={{ background: "linear-gradient(145deg, #0c1d3a, #08152a)", borderRadius: "18px", border: "1px solid rgba(16,96,240,.18)", padding: "24px", backdropFilter: "blur(14px)", boxShadow: "0 8px 32px rgba(16,96,240,.12)" }}>
                                <h3 style={{ margin: "0 0 20px 0", color: "#8aaed4", fontSize: "12px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>
                                    🧠 Skills Breakdown
                                </h3>
                                {skillsPieData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                                            <Pie
                                                data={skillsPieData}
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={70}
                                                innerRadius={35}
                                                dataKey="value"
                                                label={({ name, value }) => `${name} (${value})`}
                                                labelLine={{ stroke: "rgba(16,96,240,.3)" }}
                                            >
                                                {skillsPieData.map((entry, idx) => (
                                                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <p style={{ color: "#426080", textAlign: "center", paddingTop: "60px" }}>No skill categories found</p>
                                )}
                                {rawData.skills && (
                                    <div style={{ marginTop: "14px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                        {Object.entries(rawData.skills).flatMap(([cat, items]) =>
                                            (items || []).slice(0, 5).map((s, i) => (
                                                <span key={cat + i} style={{ background: "rgba(0,207,255,.1)", border: "1px solid rgba(0,207,255,.25)", color: "#00cfff", padding: "3px 10px", borderRadius: "20px", fontSize: "12px" }}>{s}</span>
                                            ))
                                        )}
                                        {Object.values(rawData.skills || {}).flat().length > 15 && (
                                            <span style={{ color: "#426080", fontSize: "12px", alignSelf: "center" }}>+{Object.values(rawData.skills || {}).flat().length - 15} more</span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Bar Chart - Profile Overview */}
                            <div style={{ background: "linear-gradient(145deg, #0c1d3a, #08152a)", borderRadius: "18px", border: "1px solid rgba(16,96,240,.18)", padding: "24px", backdropFilter: "blur(14px)", boxShadow: "0 8px 32px rgba(16,96,240,.12)" }}>
                                <h3 style={{ margin: "0 0 20px 0", color: "#8aaed4", fontSize: "12px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>
                                    📊 Profile Overview
                                </h3>
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={barData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                                        <XAxis dataKey="name" tick={{ fill: "#8aaed4", fontSize: 11 }} axisLine={{ stroke: "rgba(16,96,240,.2)" }} tickLine={false} />
                                        <YAxis tick={{ fill: "#8aaed4", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={55}>
                                            {barData.map((entry, idx) => (
                                                <Cell key={idx} fill={CHART_COLORS[(idx + 2) % CHART_COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Projects + Experience Row */}
                    {rawData && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px", marginBottom: "22px" }}>
                            {/* Projects */}
                            <div style={{ background: "linear-gradient(145deg, #0c1d3a, #08152a)", borderRadius: "18px", border: "1px solid rgba(16,96,240,.18)", padding: "24px", backdropFilter: "blur(14px)", boxShadow: "0 8px 32px rgba(16,96,240,.12)" }}>
                                <h3 style={{ margin: "0 0 16px 0", color: "#8aaed4", fontSize: "12px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>🛠 Projects ({rawData.projects?.length || 0})</h3>
                                {rawData.projects && rawData.projects.length > 0 ? (
                                    rawData.projects.slice(0, 4).map((proj, i) => (
                                        <div key={i} style={{ background: "rgba(245,158,11,.07)", border: "1px solid rgba(245,158,11,.2)", borderRadius: "10px", padding: "12px 15px", marginBottom: "10px" }}>
                                            <p style={{ margin: 0, color: "#f59e0b", fontWeight: "700", fontSize: "14px" }}>
                                                {typeof proj === "string" ? proj : (proj.name || proj.title || `Project ${i + 1}`)}
                                            </p>
                                            {typeof proj === "object" && (proj.description || proj.tech) && (
                                                <p style={{ margin: "4px 0 0 0", color: "#426080", fontSize: "12px", lineHeight: "1.4" }}>
                                                    {proj.description || proj.tech}
                                                </p>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <p style={{ color: "#426080", fontSize: "13px" }}>No projects extracted</p>
                                )}
                            </div>

                            {/* Experience */}
                            <div style={{ background: "linear-gradient(145deg, #0c1d3a, #08152a)", borderRadius: "18px", border: "1px solid rgba(16,96,240,.18)", padding: "24px", backdropFilter: "blur(14px)", boxShadow: "0 8px 32px rgba(16,96,240,.12)" }}>
                                <h3 style={{ margin: "0 0 16px 0", color: "#8aaed4", fontSize: "12px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>💼 Experience ({rawData.experience?.length || 0})</h3>
                                {rawData.experience && rawData.experience.length > 0 ? (
                                    rawData.experience.slice(0, 4).map((exp, i) => (
                                        <div key={i} style={{ background: "rgba(0,229,160,.06)", border: "1px solid rgba(0,229,160,.2)", borderRadius: "10px", padding: "12px 15px", marginBottom: "10px" }}>
                                            <p style={{ margin: 0, color: "#00e5a0", fontWeight: "700", fontSize: "14px" }}>
                                                {typeof exp === "string" ? exp : (exp.role || exp.title || exp.company || `Role ${i + 1}`)}
                                            </p>
                                            {typeof exp === "object" && (exp.company || exp.duration) && (
                                                <p style={{ margin: "4px 0 0 0", color: "#426080", fontSize: "12px" }}>
                                                    {[exp.company, exp.duration].filter(Boolean).join(" · ")}
                                                </p>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <p style={{ color: "#426080", fontSize: "13px" }}>No experience extracted</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Fallback text-only card */}
                    {!rawData && (
                        <div style={{ background: "linear-gradient(145deg, #0c1d3a, #08152a)", borderRadius: "18px", border: "1px solid rgba(16,96,240,.18)", padding: "24px", marginBottom: "22px", backdropFilter: "blur(14px)", color: "#8aaed4", fontSize: "14px", lineHeight: "1.7", whiteSpace: "pre-wrap", boxShadow: "0 8px 32px rgba(16,96,240,.12)" }}>
                            {parsedData}
                        </div>
                    )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Landing;
