import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

// ── ScholarSync Session Context ──────────────────────────────────────────────
// Persists interview session state across React Router navigation and
// browser refreshes using sessionStorage as backing store.
//
// Stored shape (all fields optional):
//   { sessionId, resumeFile (name only), resumeData, interviewComplete }
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_KEY = "ss_interview_session";

const defaultSession = {
    sessionId: null,
    resumeFileName: null,   // name string only (File objects can't be serialised)
    resumeData: null,       // parsed resume object from backend
    interviewComplete: false,
};

const SessionContext = createContext(null);

// Generate a random ID for the browser if one doesn't exist
const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
const USER_ID_KEY = "ss_user_id";

export const SessionProvider = ({ children }) => {
    // ── Persistent User Identity ──
    const [userId] = useState(() => {
        try {
            let id = localStorage.getItem(USER_ID_KEY);
            if (!id) {
                id = `user_${generateId()}`;
                localStorage.setItem(USER_ID_KEY, id);
            }
            return id;
        } catch {
            return `user_${generateId()}`;
        }
    });

    // ── Session State ──
    const [session, setSession] = useState(() => {
        // Initialise from sessionStorage on mount so page refreshes restore state
        try {
            const stored = sessionStorage.getItem(SESSION_KEY);
            return stored ? JSON.parse(stored) : { ...defaultSession };
        } catch {
            return { ...defaultSession };
        }
    });

    // Sync to sessionStorage whenever session changes
    useEffect(() => {
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        } catch { /* quota or private browsing — silent fail */ }
    }, [session]);

    // Helpers ------------------------------------------------------------------

    const startSession = useCallback((sessionId) => {
        setSession(prev => ({ ...prev, sessionId, interviewComplete: false }));
    }, []);

    const setResumeData = useCallback((resumeFileName, resumeData) => {
        setSession(prev => ({ ...prev, resumeFileName, resumeData }));
    }, []);

    const markComplete = useCallback(() => {
        setSession(prev => ({ ...prev, interviewComplete: true }));
    }, []);

    const clearSession = useCallback(() => {
        setSession({ ...defaultSession });
        try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    }, []);

    const value = {
        session,
        userId,
        startSession,
        setResumeData,
        markComplete,
        clearSession,
        hasActiveSession: Boolean(session.sessionId),
    };

    return (
        <SessionContext.Provider value={value}>
            {children}
        </SessionContext.Provider>
    );
};

export const useSession = () => {
    const ctx = useContext(SessionContext);
    if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
    return ctx;
};

export default SessionContext;
