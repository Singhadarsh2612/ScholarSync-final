import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useSession } from "../context/SessionContext";
import { globalAudioContext } from "./Landing";
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    BarChart, Bar 
} from "recharts";

const SS = {
    bg:      "#020810",
    panel:   "linear-gradient(145deg, #0c1d3a, #08152a)",
    panelDark: "rgba(5, 13, 28, 0.4)",
    border:  "rgba(16,96,240,.18)",
    border2: "rgba(0,207,255,.22)",
    text:    "#edf4ff",
    muted:   "#8aaed4",
    dim:     "#426080",
    accent:  "#1060f0",
    cyan:    "#00cfff",
    mint:    "#00e5a0",
    warning: "#f59e0b",
    purple:  "#a855f7"
};

const ChartTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ background: "rgba(5,13,28,.97)", border: `1px solid ${SS.border2}`, borderRadius: "8px", padding: "12px 16px", fontSize: "13px", color: SS.text, boxShadow: "0 8px 32px rgba(0,0,0,.5)" }}>
                <div style={{ marginBottom: "8px", fontWeight: "bold", color: SS.muted }}>{label}</div>
                {payload.map((p, i) => (
                    <div key={i} style={{ color: p.color, display: "flex", justifyContent: "space-between", gap: "16px", marginBottom: "4px" }}>
                        <span>{p.name}:</span>
                        <span style={{ fontWeight: "700" }}>{p.value}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const Analysis = () => {
    const API_URL = process.env.REACT_APP_API_URL || "https://codeide-backend.mangopebble-d7a787f1.centralindia.azurecontainerapps.io";
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get("session");
    const navigate = useNavigate();
    const location = useLocation();
    const { userId } = useSession();
    
    const [report, setReport] = useState("Loading final analysis...");
    
    const [historyAttempts, setHistoryAttempts] = useState([]);
    const [historyInsights, setHistoryInsights] = useState(null);
    const [topicData, setTopicData] = useState([]);

    useEffect(() => {
        if (location.state && location.state.finalAudio) {
            const playBase64Audio = (base64String) => {
                if (!base64String || !globalAudioContext) return;
                try {
                    try { globalAudioContext.pause(); globalAudioContext.currentTime = 0; } catch (e) {}
                    globalAudioContext.src = "data:audio/wav;base64," + base64String;
                    globalAudioContext.load();
                    globalAudioContext.play().catch(e => console.error("Proctor audio error:", e));
                } catch (e) { console.error(e); }
            };
            setTimeout(() => playBase64Audio(location.state.finalAudio), 1000);
        }
    }, [location.state]);

    useEffect(() => {
        if (!sessionId) { navigate("/"); return; }

        const fetchCandidateHistory = async () => {
            if (!userId) return;
            try {
                const res = await axios.get(`${API_URL}/candidate/history`, { params: { user_id: userId } });
                if (res.data.success) {
                    const attempts = res.data.attempts;
                    const chartData = attempts.map((att, index) => ({
                        name: `A${index + 1}`,
                        topic: att.topic || "General",
                        Coding: att.coding_score || 0,
                        Communication: att.communication_score || 0,
                        ProblemSolving: att.problem_solving_score || 0,
                        Efficiency: att.efficiency_score || 0,
                        Overall: att.overall_score || 0
                    }));
                    
                    const tMap = {};
                    attempts.forEach(att => {
                        const t = att.topic || "General";
                        if(!tMap[t]) tMap[t] = { topic: t, Coding: 0, ProblemSolving: 0, Overall: 0, count: 0 };
                        tMap[t].Coding += (att.coding_score || 0);
                        tMap[t].ProblemSolving += (att.problem_solving_score || 0);
                        tMap[t].Overall += (att.overall_score || 0);
                        tMap[t].count += 1;
                    });
                    const tData = Object.values(tMap).map(d => ({
                        topic: d.topic,
                        Coding: Math.round(d.Coding / d.count),
                        ProblemSolving: Math.round(d.ProblemSolving / d.count),
                        Overall: Math.round(d.Overall / d.count)
                    }));
                    
                    setHistoryAttempts(chartData);
                    setTopicData(tData);
                    setHistoryInsights(res.data.insights);
                }
            } catch (err) { console.error("History fetch error:", err); }
        };

        const fetchAnalysis = async () => {
            try {
                const res = await axios.get(`${API_URL}/session/${sessionId}/analysis`);
                setReport(res.data.analysis || "No analysis found for this session.");
                fetchCandidateHistory();
            } catch (err) {
                console.error("Analysis error:", err);
                setReport("Failed to load interview analysis.");
            }
        };
        fetchAnalysis();
    }, [sessionId, navigate, userId, API_URL]);

    const panel = { background: SS.panel, border: `1px solid ${SS.border}`, borderRadius: "16px", padding: "24px", boxShadow: "0 8px 32px rgba(16,96,240,.1)", display: "flex", flexDirection: "column" };
    
    // Derived radar data from the most recent attempt
    const recentAttempt = historyAttempts.length > 0 ? historyAttempts[historyAttempts.length - 1] : null;
    const radarData = recentAttempt ? [
        { subject: 'Coding', A: recentAttempt.Coding, fullMark: 100 },
        { subject: 'Comm.', A: recentAttempt.Communication, fullMark: 100 },
        { subject: 'Logic', A: recentAttempt.ProblemSolving, fullMark: 100 },
        { subject: 'Speed', A: recentAttempt.Efficiency, fullMark: 100 },
    ] : [];

    return (
        <div style={{ minHeight: "100vh", background: SS.bg, color: SS.text, fontFamily: "'SF Pro Display','Inter',sans-serif", padding: "32px 40px", boxSizing: "border-box" }}>
            
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: "700", background: "linear-gradient(110deg, #fff 30%, #6aa0ff 65%, #00cfff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                        Intelligent AI Diagnostics
                    </h1>
                    <p style={{ margin: "8px 0 0 0", color: SS.muted, fontSize: "15px" }}>Comprehensive skill trajectory for candidate tracking</p>
                </div>
                <button onClick={() => navigate("/")} style={{ padding: "12px 24px", background: "linear-gradient(135deg, #1060f0, #0040b8)", color: SS.text, border: "none", borderRadius: "10px", cursor: "pointer", fontSize: "14px", fontWeight: "600", boxShadow: "0 0 20px rgba(16,96,240,.3)" }}>
                    Initialize New Session ›
                </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px" }}>
                
                {/* Visualizations Column */}
                <div style={{ display: "flex", flexDirection: "column", gap: "24px", gridColumn: "1 / 3" }}>
                    
                    {/* Top Row: Core Metrics & Radar UI */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                        
                        {/* Overall Score Card */}
                        <div style={{ ...panel, justifyContent: "center", alignItems: "center", textAlign: "center", position: "relative", overflow: "hidden" }}>
                            <div style={{ position: "absolute", top: "-50%", left: "-50%", right: "-50%", bottom: "-50%", background: "radial-gradient(circle at center, rgba(16,96,240,0.15) 0%, transparent 60%)", pointerEvents: "none" }} />
                            <h3 style={{ margin: 0, fontSize: "14px", color: SS.muted, textTransform: "uppercase", letterSpacing: "1px" }}>Aggregate Match Score</h3>
                            <div style={{ margin: "16px 0", fontSize: "72px", fontWeight: "800", color: SS.cyan, textShadow: "0 0 40px rgba(0,207,255,0.4)", lineHeight: 1 }}>
                                {recentAttempt ? recentAttempt.Overall : "--"}
                            </div>
                            <p style={{ margin: 0, fontSize: "14px", color: SS.dim }}>Out of 100</p>
                            {historyInsights && typeof historyInsights === "object" && (
                                <div style={{ marginTop: "24px", padding: "12px 16px", background: "rgba(16,96,240,.1)", borderRadius: "8px", border: `1px solid ${SS.border}`, fontSize: "14px", color: SS.muted, textAlign: "left", width: "100%", boxSizing: "border-box" }}>
                                    <span style={{ color: SS.cyan }}>💡 Insight:</span> {historyInsights.summary}
                                </div>
                            )}
                        </div>

                        {/* Radar Chart Component */}
                        <div style={panel}>
                            <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", color: SS.mint, textTransform: "uppercase", letterSpacing: "1px" }}>Skill Profile Radar</h3>
                            <div style={{ flex: 1, minHeight: "220px" }}>
                                {radarData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                            <PolarGrid stroke="rgba(16,96,240,.2)" />
                                            <PolarAngleAxis dataKey="subject" tick={{ fill: SS.muted, fontSize: 12 }} />
                                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                            <Radar name="Metrics" dataKey="A" stroke={SS.cyan} fill={SS.cyan} fillOpacity={0.25} strokeWidth={2} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: SS.dim }}>Awaiting data...</div>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Full Width Line Chart: Trajectory */}
                    <div style={panel}>
                        <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", color: SS.purple, textTransform: "uppercase", letterSpacing: "1px" }}>Trajectory Analysis (Last 5 Sessions)</h3>
                        <div style={{ height: "260px" }}>
                            {historyAttempts.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={historyAttempts} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(16,96,240,.1)" vertical={false} />
                                        <XAxis dataKey="name" stroke={SS.dim} tick={{ fill: SS.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <YAxis domain={[0, 100]} stroke={SS.dim} tick={{ fill: SS.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <RechartsTooltip content={<ChartTooltip />} />
                                        <Line type="monotone" dataKey="Overall" stroke={SS.purple} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                        <Line type="monotone" dataKey="Coding" stroke={SS.mint} strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                        <Line type="monotone" dataKey="ProblemSolving" stroke={SS.warning} strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: SS.dim }}>Awaiting history...</div>
                            )}
                        </div>
                    </div>
                    
                    {/* Full Width Bar Chart: Topic Analysis */}
                    <div style={panel}>
                        <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", color: SS.cyan, textTransform: "uppercase", letterSpacing: "1px" }}>Topic-Centered Performance Analysis</h3>
                        <div style={{ height: "260px" }}>
                            {topicData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={topicData} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(16,96,240,.1)" vertical={false} />
                                        <XAxis dataKey="topic" stroke={SS.dim} tick={{ fill: SS.text, fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <YAxis domain={[0, 100]} stroke={SS.dim} tick={{ fill: SS.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: "rgba(16,96,240,0.1)" }} />
                                        <Bar dataKey="Overall" fill={SS.cyan} radius={[4, 4, 0, 0]} name="Overall Avg" />
                                        <Bar dataKey="Coding" fill={SS.mint} radius={[4, 4, 0, 0]} name="Coding Avg" />
                                        <Bar dataKey="ProblemSolving" fill={SS.purple} radius={[4, 4, 0, 0]} name="Logic Avg" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: SS.dim }}>Awaiting topic data...</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Text Insights & Feedback */}
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    
                    {/* Strengths / Weaknesses */}
                    <div style={{ ...panel, flex: 0 }}>
                        <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", color: SS.mint, textTransform: "uppercase", letterSpacing: "1px" }}>Observed Strengths</h3>
                        {historyInsights && historyInsights.strengths && Array.isArray(historyInsights.strengths) ? (
                            <ul style={{ margin: 0, paddingLeft: "20px", color: SS.text, fontSize: "14px", lineHeight: "1.6", display: "flex", flexDirection: "column", gap: "8px" }}>
                                {historyInsights.strengths.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                        ) : <div style={{ color: SS.dim, fontSize: "14px" }}>Analyzing patterns...</div>}
                    </div>

                    <div style={{ ...panel, flex: 0 }}>
                        <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", color: SS.warning, textTransform: "uppercase", letterSpacing: "1px" }}>Critical Weaknesses</h3>
                        {historyInsights && historyInsights.weaknesses && Array.isArray(historyInsights.weaknesses) ? (
                            <ul style={{ margin: 0, paddingLeft: "20px", color: SS.text, fontSize: "14px", lineHeight: "1.6", display: "flex", flexDirection: "column", gap: "8px" }}>
                                {historyInsights.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                        ) : <div style={{ color: SS.dim, fontSize: "14px" }}>Analyzing patterns...</div>}
                    </div>

                    {/* Raw Agent Evaluation Transcript */}
                    <div style={{ ...panel, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                        <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", color: SS.accent, textTransform: "uppercase", letterSpacing: "1px", flexShrink: 0 }}>Final Call Transcript</h3>
                        <div style={{ overflowY: "auto", flex: 1, paddingRight: "8px" }}>
                            <p style={{ margin: 0, whiteSpace: "pre-wrap", color: SS.muted, fontSize: "14px", lineHeight: "1.6" }}>
                                {report}
                            </p>
                        </div>
                        <div style={{ marginTop: "24px", padding: "16px", background: SS.bg, borderRadius: "8px", border: `1px solid ${SS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                            <span style={{ fontSize: "13px", color: SS.dim }}>Session ID <br/><strong style={{ color: SS.muted }}>{sessionId}</strong></span>
                            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(16,96,240,.1)", color: SS.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</div>
                        </div>
                    </div>

                </div>
            </div>
            
        </div>
    );
};

export default Analysis;
