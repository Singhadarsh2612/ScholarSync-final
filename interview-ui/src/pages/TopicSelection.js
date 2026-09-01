import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { unlockAudio } from "../audio/player";
import * as api from "../api/interviewApi";

const TOPIC_ICONS = {
  "two-pointers": "👆",
  "greedy": "🧠",
  "graph": "🕸️",
  "implementation": "⚙️",
  "binary-search": "🔍",
};

const DIFFICULTY_COLORS = {
  Easy: { bg: "rgba(0,229,160,0.1)", border: "rgba(0,229,160,0.3)", text: "#00e5a0" },
  Medium: { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", text: "#f59e0b" },
  Hard: { bg: "rgba(255,60,60,0.1)", border: "rgba(255,60,60,0.3)", text: "#ff6b6b" },
};

const TopicSelection = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session") || "default";

  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [hovering, setHovering] = useState(null);

  useEffect(() => {
    api.fetchTopics()
      .then(data => {
        setTopics(data.topics || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch topics:", err);
        setLoading(false);
      });
  }, []);

  const handleSelectTopic = async (topic) => {
    setSelected(topic.slug);

    // Selecting a topic is a user gesture, so it is our chance to unlock
    // audio playback before the interview page needs it.
    await unlockAudio();

    try {
      const data = await api.fetchQuestionsByTopic(topic.slug);
      const questions = data.questions || [];
      if (questions.length > 0) {
        const problemId = questions[0].id;

        // Pre-fetch the greeting so the interview page can play it instantly.
        try {
          const welcome = await api.requestWelcome({ problemId });
          if (welcome.audio) {
            sessionStorage.setItem(`welcomeAudio_${sessionId}`, welcome.audio);
          }
        } catch (e) {
          console.warn("[TopicSelection] Welcome audio prefetch failed:", e.message);
        }

        navigate(`/interview/${problemId}?session=${sessionId}&topic=${topic.slug}`);
      }
    } catch (err) {
      console.error("Failed to load questions:", err);
      setSelected(null);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#020810",
      backgroundImage: [
        "radial-gradient(ellipse 80% 60% at 50% -5%, rgba(16,96,240,.18), transparent)",
        "linear-gradient(rgba(16,96,240,.03) 1px, transparent 1px)",
        "linear-gradient(90deg, rgba(16,96,240,.03) 1px, transparent 1px)",
      ].join(", "),
      backgroundSize: "auto, 64px 64px, 64px 64px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      fontFamily: "'SF Pro Display','SF Pro Text','Segoe UI',system-ui,'Inter',sans-serif",
      color: "#edf4ff",
      padding: "0 24px 60px",
    }}>

      {/* Nav */}
      <nav style={{ width: "100%", maxWidth: "1100px", height: "58px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(16,96,240,.1)", marginBottom: "60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "linear-gradient(135deg, #1060f0, #00cfff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>⚡</div>
          <span style={{ fontWeight: "700", fontSize: "15px", letterSpacing: "-0.2px" }}>ScholarSync</span>
          <span style={{ color: "#426080", fontSize: "13px" }}>/ Topic Selection</span>
        </div>
        <button onClick={() => navigate("/")} style={{ background: "transparent", border: "1px solid rgba(16,96,240,.2)", color: "#8aaed4", padding: "6px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
          ← Back
        </button>
      </nav>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "48px", animation: "ss-fade-in 0.5s ease" }}>
        <div style={{ fontSize: "11px", color: "#426080", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "14px" }}>
          STEP 2 OF 2 — CHOOSE YOUR ARENA
        </div>
        <h1 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: "800", margin: "0 0 16px", letterSpacing: "-0.5px", background: "linear-gradient(110deg, #fff 30%, #6aa0ff 65%, #00cfff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
          Select Your Topic
        </h1>
        <p style={{ color: "#8aaed4", fontSize: "16px", margin: 0, maxWidth: "500px" }}>
          Choose a topic to begin your AI-powered interview. Each topic has curated problems tailored to your skill level.
        </p>
      </div>

      {/* Topic Cards Grid */}
      {loading ? (
        <div style={{ display: "flex", gap: "12px", color: "#00cfff", animation: "ss-pulse 1.4s ease-in-out infinite" }}>
          <span>◉</span> Loading topics...
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "22px", width: "100%", maxWidth: "1100px" }}>
          {topics.map((topic) => {
            const diff = DIFFICULTY_COLORS[topic.difficulty] || DIFFICULTY_COLORS.Medium;
            const isHovering = hovering === topic.slug;
            const isSelected = selected === topic.slug;
            return (
              <div
                key={topic.slug}
                onClick={() => handleSelectTopic(topic)}
                onMouseEnter={() => setHovering(topic.slug)}
                onMouseLeave={() => setHovering(null)}
                style={{
                  background: isHovering ? "linear-gradient(145deg, #0f1e3a, #08152a)" : "linear-gradient(145deg, #0c1d3a, #08152a)",
                  border: `1px solid ${isHovering ? "rgba(16,96,240,0.4)" : "rgba(16,96,240,0.15)"}`,
                  borderRadius: "20px",
                  padding: "28px 26px",
                  cursor: "pointer",
                  transform: isHovering ? "translateY(-4px)" : "none",
                  boxShadow: isHovering ? "0 20px 50px rgba(16,96,240,0.2)" : "0 4px 20px rgba(0,0,0,0.2)",
                  transition: "all 0.25s ease",
                  opacity: isSelected ? 0.7 : 1,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Decorative glow */}
                {isHovering && (
                  <div style={{ position: "absolute", top: 0, right: 0, width: "120px", height: "120px", background: "radial-gradient(circle at center, rgba(16,96,240,0.15), transparent)", borderRadius: "50%", pointerEvents: "none" }} />
                )}

                {/* Icon + title */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "18px" }}>
                  <div style={{ fontSize: "36px", lineHeight: 1, flexShrink: 0, filter: "drop-shadow(0 0 12px rgba(16,96,240,0.4))" }}>
                    {TOPIC_ICONS[topic.slug] || "💡"}
                  </div>
                  <div>
                    <h2 style={{ margin: "0 0 6px", fontSize: "17px", fontWeight: "700", color: "#edf4ff", letterSpacing: "-0.2px" }}>
                      {topic.name}
                    </h2>
                    <span style={{ display: "inline-block", background: diff.bg, border: `1px solid ${diff.border}`, color: diff.text, padding: "2px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {topic.difficulty}
                    </span>
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: "flex", gap: "16px", marginBottom: "16px", fontSize: "12px", color: "#8aaed4" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <span style={{ color: "#00cfff" }}>📋</span>
                    <span>Single Problem</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <span style={{ color: "#6aa0ff" }}>⏱</span>
                    <span>{topic.time_complexity}</span>
                  </div>
                </div>

                {/* Skills tags */}
                {topic.skills && topic.skills.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
                    {topic.skills.slice(0, 4).map((skill, i) => (
                      <span key={i} style={{ background: "rgba(0,207,255,0.07)", border: "1px solid rgba(0,207,255,0.18)", color: "#8aaed4", padding: "3px 9px", borderRadius: "8px", fontSize: "11px", fontWeight: "500" }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {/* Companies */}
                {topic.companies && topic.companies.length > 0 && (
                  <div style={{ fontSize: "11px", color: "#426080", marginBottom: "18px" }}>
                    <span style={{ color: "#6aa0ff", fontWeight: "600" }}>Asked at: </span>
                    {topic.companies.slice(0, 3).join(", ")}
                    {topic.companies.length > 3 && ` +${topic.companies.length - 3} more`}
                  </div>
                )}

                {/* CTA */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "14px", borderTop: "1px solid rgba(16,96,240,0.12)" }}>
                  <span style={{ fontSize: "12px", color: "#8aaed4" }}>{isSelected ? "Loading..." : "Click to start"}</span>
                  <div style={{ background: isHovering ? "linear-gradient(135deg, #1060f0, #00cfff)" : "rgba(16,96,240,0.1)", border: `1px solid ${isHovering ? "rgba(0,207,255,0.5)" : "rgba(16,96,240,0.2)"}`, color: isHovering ? "#fff" : "#6aa0ff", padding: "6px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: "700", transition: "all 0.25s ease" }}>
                    {isSelected ? "⟳" : "Start →"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TopicSelection;
