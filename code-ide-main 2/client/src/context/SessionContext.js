import React, { createContext, useContext, useState, useEffect, useCallback } from "react";


const SESSION_KEY = "ss_interview_session";

const defaultSession = {
    sessionId: null,
    resumeFileName: null,   // name string only (File objects can't be serialised)
    resumeData: null,       // parsed resume object from backend
    interviewComplete: false,
};

const SessionContext = createContext(null);

const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
const USER_ID_KEY = "ss_user_id";

export const SessionProvider = ({ children }) => {
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

    const [session, setSession] = useState(() => {
        try {
            const stored = sessionStorage.getItem(SESSION_KEY);
            return stored ? JSON.parse(stored) : { ...defaultSession };
        } catch {
            return { ...defaultSession };
        }
    });

    useEffect(() => {
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        } catch { /* quota or private browsing — silent fail */ }
    }, [session]);


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
