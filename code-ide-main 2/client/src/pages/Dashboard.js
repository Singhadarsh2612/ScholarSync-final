import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from "recharts";

// ScholarSync Design Tokens
const SS = {
    bg:      "#020810",
    panel:   "linear-gradient(145deg, #0c1d3a, #08152a)",
    border:  "rgba(16,96,240,.18)",
    border2: "rgba(0,207,255,.22)",
    text:    "#edf4ff",
    muted:   "#8aaed4",
    dim:     "#426080",
    accent:  "#1060f0",
    cyan:    "#00cfff",
    mint:    "#00e5a0",
};

const ChartTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ background: "rgba(5,13,28,.97)", border: `1px solid ${SS.border2}`, borderRadius: "8px", padding: "8px 14px", fontSize: "13px", color: SS.text }}>
                {payload.map((p, i) => (
                    <div key={i} style={{ color: p.color }}><strong>{p.name}</strong>: {p.value}</div>
                ))}
            </div>
        );
    }
    return null;
};

const Dashboard = () => {
    const API_URL = process.env.REACT_APP_API_URL || "https://codeide-backend.mangopebble-d7a787f1.centralindia.azurecontainerapps.io";
    const [searchParams, setSearchParams] = useSearchParams();
    const candidateNameQuery = searchParams.get("name") || "";
    const [searchName, setSearchName] = useState(candidateNameQuery);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [attempts, setAttempts] = useState([]);
    const [insights, setInsights] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const fetchHistory = async (name) => {
            if (!name.trim()) return;
            setLoading(true); setError(""); setAttempts([]); setInsights("");
            try {
                const res = await axios.get(`${API_URL}/candidate/history`, { params: { name } });
                if (res.data.success) {
                    const formattedData = res.data.attempts.map((att, index) => ({
                        attemptNo: `Attempt ${index + 1}`,
                        CodeScore: att.overall_score || 0,
                        CSScore: att.cs_score || 0,
                        TimeTaken: att.time_taken || 600,
                        HintsUsed: att.hint_level || 0,
                    }));
                    setAttempts(formattedData);
                    setInsights(res.data.insights || "No insights available.");
                } else {
                    setError(res.data.message || "Candidate not found or no historical data available.");
                }
            } catch (err) {
                console.error("Failed to fetch history:", err);
                setError("Failed to fetch candidate data. Ensure the backend is running.");
            } finally { setLoading(false); }
        };
        if (candidateNameQuery) fetchHistory(candidateNameQuery);
    }, [candidateNameQuery, API_URL]);

    const handleSearch = (e) => { e.preventDefault(); setSearchParams({ name: searchName }); };

    const panel = {
        background: SS.panel,
        border: `1px solid ${SS.border}`,
        borderRadius: "16px",
        padding: "24px",
        boxShadow: "0 8px 32px rgba(16,96,240,.1)",
    };

    return (
        <div style={{
            minHeight: "100vh",
            background: SS.bg,
            backgroundImage: [
                "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(16,96,240,.12), transparent)",
                "linear-gradient(rgba(16,96,240,.025) 1px, transparent 1px)",
                "linear-gradient(90deg, rgba(16,96,240,.025) 1px, transparent 1px)",
            ].join(", "),
            backgroundSize: "auto, 64px 64px, 64px 64px",
            color: SS.text,
            fontFamily: "'SF Pro Display','SF Pro Text','Segoe UI',system-ui,sans-serif",
            fontSize: "16px",
            padding: "28px 32px",
        }}>

            {/* ── Header ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div style={{ width: "46px", height: "46px", borderRadius: "12px", background: "linear-gradient(135deg, rgba(16,96,240,.3), rgba(0,207,255,.15))", border: `1px solid ${SS.border2}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>📈</div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: "700", background: "linear-gradient(110deg, #fff 30%, #6aa0ff 65%, #00cfff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                            Candidate Analytics
                        </h1>
                        <p style={{ margin: 0, color: SS.muted, fontSize: "14px" }}>Track candidate progress across multiple interview attempts</p>
                    </div>
                </div>
                <button onClick={() => navigate("/")} style={{ padding: "10px 20px", background: "rgba(16,96,240,.08)", color: SS.muted, border: `1px solid ${SS.border}`, borderRadius: "10px", cursor: "pointer", fontSize: "14px", fontWeight: "600", transition: "all 0.2s" }}
                    onMouseOver={e => { e.currentTarget.style.background = "rgba(16,96,240,.18)"; e.currentTarget.style.color = SS.text; }}
                    onMouseOut={e => { e.currentTarget.style.background = "rgba(16,96,240,.08)"; e.currentTarget.style.color = SS.muted; }}>
                    ← Home
                </button>
            </div>

            {/* ── Search bar ── */}
            <form onSubmit={handleSearch} style={{ display: "flex", gap: "12px", marginBottom: "28px", maxWidth: "560px" }}>
                <input
                    type="text"
                    placeholder="Enter candidate full name..."
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    style={{ flex: 1, padding: "13px 18px", borderRadius: "10px", border: `1px solid ${SS.border}`, background: "rgba(12,29,58,.7)", color: SS.text, outline: "none", fontSize: "15px", fontFamily: "inherit" }}
                />
                <button type="submit" style={{ padding: "0 24px", background: "linear-gradient(135deg, #1060f0, #0040b8)", color: SS.text, border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: "700", fontSize: "15px", boxShadow: "0 0 16px rgba(16,96,240,.3)" }}>
                    Analyze
                </button>
            </form>

            {/* ── States ── */}
            {loading && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: SS.cyan, fontSize: "15px", padding: "20px 0" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: SS.cyan, animation: "ss-agent-dot-pulse 1.5s ease infinite" }} />
                    Analyzing candidate history...
                </div>
            )}
            {error && !loading && (
                <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", padding: "16px 20px", borderRadius: "12px", color: "#f87171", fontSize: "14px" }}>
                    {error}
                </div>
            )}

            {/* ── Data view ── */}
            {attempts.length > 0 && !loading && (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

                    {/* AI Insights panel — full width */}
                    <div style={{ ...panel, borderLeft: `3px solid ${SS.cyan}` }}>
                        <div style={{ fontSize: "11px", color: SS.cyan, fontWeight: "700", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: "10px" }}>▸ AI Progress Insights</div>
                        <p style={{ margin: 0, color: SS.muted, fontSize: "15px", lineHeight: "1.75" }}>{insights}</p>
                    </div>

                    {/* Two-column chart grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))", gap: "20px" }}>

                        {/* Performance trend */}
                        <div style={panel}>
                            <div style={{ fontSize: "11px", color: SS.mint, fontWeight: "700", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: "16px" }}>▸ Performance Trend</div>
                            <div style={{ height: "280px" }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={attempts} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(16,96,240,.12)" />
                                        <XAxis dataKey="attemptNo" stroke={SS.dim} tick={{ fill: SS.muted, fontSize: 12 }} />
                                        <YAxis domain={[0, 100]} stroke={SS.dim} tick={{ fill: SS.muted, fontSize: 12 }} />
                                        <RechartsTooltip content={<ChartTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: "13px", color: SS.muted }} />
                                        <Line type="monotone" dataKey="CodeScore" name="Code Score" stroke={SS.mint} strokeWidth={2.5} activeDot={{ r: 7 }} />
                                        <Line type="monotone" dataKey="CSScore" name="CS Clarity" stroke="#f59e0b" strokeWidth={2.5} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Efficiency chart */}
                        <div style={panel}>
                            <div style={{ fontSize: "11px", color: "#f59e0b", fontWeight: "700", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: "16px" }}>▸ Efficiency: Speed & Hints</div>
                            <div style={{ height: "280px" }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={attempts} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(16,96,240,.12)" vertical={false} />
                                        <XAxis dataKey="attemptNo" stroke={SS.dim} tick={{ fill: SS.muted, fontSize: 12 }} />
                                        <YAxis yAxisId="left" orientation="left" stroke={SS.cyan} tick={{ fill: SS.cyan, fontSize: 11 }} label={{ value: "Seconds", angle: -90, position: "insideLeft", fill: SS.cyan, fontSize: 11 }} />
                                        <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" tick={{ fill: "#f59e0b", fontSize: 11 }} label={{ value: "Hints", angle: 90, position: "insideRight", fill: "#f59e0b", fontSize: 11 }} />
                                        <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: "rgba(16,96,240,.06)" }} />
                                        <Legend wrapperStyle={{ fontSize: "13px", color: SS.muted }} />
                                        <Bar yAxisId="left" dataKey="TimeTaken" name="Time Used (s)" fill={SS.accent} radius={[4, 4, 0, 0]} maxBarSize={48} />
                                        <Bar yAxisId="right" dataKey="HintsUsed" name="Hints Used" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={48} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
