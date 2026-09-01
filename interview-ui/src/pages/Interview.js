/**
 * pages/Interview.js
 * ---------------------------------------------------------------------------
 * The live interview workspace: problem, editor, console, and AI sidebar.
 *
 * This page holds interview state and orchestrates the backend calls. All
 * presentation lives in components/interview/*, all HTTP in api/interviewApi.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';

import ChatSidebar from '../components/interview/ChatSidebar';
import ConsolePanel from '../components/interview/ConsolePanel';
import EditorToolbar from '../components/interview/EditorToolbar';
import InterviewTopBar from '../components/interview/InterviewTopBar';
import ProblemPanel from '../components/interview/ProblemPanel';
import StartScreen from '../components/interview/StartScreen';
import VerticalSplitter from '../components/interview/VerticalSplitter';
import { playBase64Audio, stopAudio, unlockAudio } from '../audio/player';
import { useSession } from '../context/SessionContext';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { FONT_STACK } from '../theme/palette';
import { useTheme } from '../theme/ThemeContext';
import * as api from '../api/interviewApi';

/** Total interview length, in seconds. */
const INTERVIEW_SECONDS = 600;

/** How often the interviewer volunteers an unprompted nudge, in seconds. */
const NUDGE_INTERVAL_SECONDS = 180;

/** Statement column width, in pixels. */
const DEFAULT_PANEL_WIDTH = 420;
const MIN_PANEL_WIDTH = 280;

const STARTER_CODE = `#include <iostream>
using namespace std;

int main() {
    // Write your code here
    return 0;
}`;

const Interview = () => {
  const { problemId: problemIdParam } = useParams();
  const problemId = problemIdParam || 1;

  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session') || 'default';

  const navigate = useNavigate();
  const { userId } = useSession();
  const { IT: T } = useTheme();

  // ── Interview lifecycle ──
  const [hasStarted, setHasStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(INTERVIEW_SECONDS);

  // ── Workspace ──
  const [problem, setProblem] = useState(null);
  const [code, setCode] = useState(STARTER_CODE);
  const [stdin, setStdin] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  // ── Workspace layout ──
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  const [editorFontSize, setEditorFontSize] = useState(14);

  // ── AI conversation ──
  const [showChat, setShowChat] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [chatDraft, setChatDraft] = useState('');
  const [chatLog, setChatLog] = useState([
    {
      role: 'AI',
      text: "Welcome! I'm your tutor for today. Start by reading the problem on the left.",
      level: 0,
    },
  ]);
  const [chatHistory, setChatHistory] = useState([]);

  const welcomePlayed = useRef(false);
  const lastSyncedMsgCount = useRef(0);

  const { isRecording, toggle: toggleRecording, stop: stopRecording, supported: micSupported } =
    useSpeechRecognition(setChatDraft);

  // ── Load the problem ──
  useEffect(() => {
    let cancelled = false;

    api.fetchProblem(problemId)
      .then((data) => { if (!cancelled) setProblem(data); })
      .catch((err) => console.error('Error fetching problem:', err));

    return () => { cancelled = true; };
  }, [problemId]);

  // ── Greet the candidate once the problem is on screen ──
  useEffect(() => {
    if (!problem || welcomePlayed.current) return;
    welcomePlayed.current = true;

    // TopicSelection may have pre-fetched the greeting to mask latency.
    const cachedKey = `welcomeAudio_${sessionId}`;
    const cached = sessionStorage.getItem(cachedKey);
    if (cached) {
      playBase64Audio(cached);
      sessionStorage.removeItem(cachedKey);
      return;
    }

    api.requestWelcome({ problemId })
      .then((data) => playBase64Audio(data.audio))
      .catch((err) => console.error('Welcome audio failed:', err));
  }, [problem, problemId, sessionId]);

  /** Ask the interviewer for a nudge ('periodic') or a hint ('hint'). */
  const requestAnalysis = useCallback(async (kind) => {
    setIsThinking(true);
    try {
      const data = await api.requestAnalysis(kind, {
        code,
        problemId,
        session_id: sessionId,
        user_id: userId,
      });

      setChatLog((prev) => [...prev, { role: 'AI', text: data.feedback }]);
      if (data.level !== undefined && data.level !== null) setHintLevel(data.level);
      playBase64Audio(data.audio);
    } catch (err) {
      console.error(`AI ${kind} failed:`, err.response?.data || err.message);
    } finally {
      setIsThinking(false);
    }
  }, [code, problemId, sessionId, userId]);

  const finishInterview = useCallback(async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setIsFinished(true);
    stopAudio();
    stopRecording();

    const goToAnalysis = (state) =>
      navigate(`/analysis?session=${sessionId}`, state ? { state } : undefined);

    try {
      const data = await api.requestAnalysis('evaluation', {
        code,
        problemId,
        session_id: sessionId,
        user_id: userId,
        time_taken: INTERVIEW_SECONDS - timeLeft,
      });

      setChatLog((prev) => [
        ...prev,
        { role: 'SYSTEM', text: 'SUBMITTED' },
        { role: 'AI', text: data.feedback },
      ]);

      // Let the closing remark play on the analysis page.
      setTimeout(() => goToAnalysis(data.audio ? { finalAudio: data.audio } : null), 1000);
    } catch (err) {
      console.error('Evaluation failed:', err);
      goToAnalysis(null);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, code, problemId, sessionId, userId, timeLeft, navigate, stopRecording]);

  const sendChatMessage = useCallback(async () => {
    const text = chatDraft.trim();
    if (!text) return;

    setChatLog((prev) => [...prev, { role: 'USER', text }]);
    setChatDraft('');
    setIsThinking(true);

    try {
      const data = await api.sendChatMessage({
        message: text,
        session_id: sessionId,
        user_id: userId,
        code,
        problemId,
        history: chatHistory,
      });

      setChatLog((prev) => [...prev, { role: 'AI', text: data.feedback }]);
      setChatHistory((prev) => [
        ...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: data.feedback },
      ]);
      playBase64Audio(data.audio);
    } catch (err) {
      console.error('Chat failed:', err);
    } finally {
      setIsThinking(false);
    }
  }, [chatDraft, chatHistory, code, problemId, sessionId, userId]);

  /** Push the latest code to the backend graph, which may volunteer feedback. */
  const syncWithBackend = useCallback(async (currentOutput) => {
    if (!problem) return;

    try {
      const data = await api.syncCode({
        session_id: sessionId,
        user_id: userId,
        problem_statement: problem.description,
        current_code: code,
        compiler_output: currentOutput ?? output,
      });

      const aiMessages = (data.messages || []).filter((m) => m.role === 'AI');
      if (aiMessages.length > lastSyncedMsgCount.current) {
        setChatLog((prev) => [...prev, ...aiMessages.slice(lastSyncedMsgCount.current)]);
        lastSyncedMsgCount.current = aiMessages.length;
      }
      playBase64Audio(data.audio);
    } catch (err) {
      console.error('Sync failed:', err);
    }
  }, [code, output, problem, sessionId, userId]);

  const runCode = useCallback(async () => {
    setIsRunning(true);
    setConsoleCollapsed(false);
    try {
      const data = await api.runCode({ code, input: stdin });
      setOutput(data.output);
      await syncWithBackend(data.output);
    } catch (err) {
      setOutput(`Execution Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  }, [code, stdin, syncWithBackend]);

  // ── Countdown ──
  useEffect(() => {
    if (!hasStarted || isFinished) return undefined;

    if (timeLeft <= 0) {
      finishInterview();
      return undefined;
    }

    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, hasStarted, isFinished, finishInterview]);

  // ── Unprompted nudge every few minutes ──
  useEffect(() => {
    const elapsed = INTERVIEW_SECONDS - timeLeft;
    if (timeLeft > 0 && elapsed > 0 && elapsed % NUDGE_INTERVAL_SECONDS === 0) {
      requestAnalysis('periodic');
    }
  }, [timeLeft, requestAnalysis]);

  // Never leave audio playing behind us.
  useEffect(() => stopAudio, []);

  if (!problem) {
    return (
      <div
        style={{
          height: '100vh',
          background: T.bg,
          color: T.muted,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: '15px',
          fontFamily: FONT_STACK,
          gap: '12px',
        }}
      >
        <span style={{ color: T.green, animation: 'ss-pulse 1.4s ease-in-out infinite' }}>◉</span>
        Loading workspace…
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <StartScreen
        title={problem.title || 'Interview Session'}
        onStart={() => {
          // Must happen inside the click for autoplay policy to allow audio.
          unlockAudio();
          setHasStarted(true);
        }}
      />
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: T.bg,
        color: T.text,
        fontFamily: FONT_STACK,
        overflow: 'hidden',
      }}
    >
      <InterviewTopBar
        title={problem.title}
        timeLeft={timeLeft}
        totalSeconds={INTERVIEW_SECONDS}
        isSubmitting={isSubmitting}
        showChat={showChat}
        onToggleChat={() => setShowChat((prev) => !prev)}
        onFinish={finishInterview}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Full screen hides the statement so the editor owns the width. */}
        {!isFullscreen && (
          <>
            {/* maxWidth is a floor for the editor: however wide the statement
                is dragged, or however narrow the window gets, the code column
                keeps a usable share of the row. */}
            <div
              style={{
                width: `${panelWidth}px`,
                maxWidth: '60%',
                flexShrink: 0,
                minWidth: 0,
              }}
            >
              <ProblemPanel problem={problem} />
            </div>
            <VerticalSplitter onResize={setPanelWidth} min={MIN_PANEL_WIDTH} />
          </>
        )}

        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            background: T.panel,
          }}
        >
          <EditorToolbar
            fontSize={editorFontSize}
            onFontSize={setEditorFontSize}
            onResetCode={() => setCode(STARTER_CODE)}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
          />

          <div style={{ flex: 1, minHeight: 0 }}>
            <Editor
              height="100%"
              theme={T.monaco}
              defaultLanguage="cpp"
              value={code}
              onChange={(value) => setCode(value ?? '')}
              options={{
                fontSize: editorFontSize,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                padding: { top: 12, bottom: 12 },
                renderLineHighlight: 'all',
                automaticLayout: true,
              }}
            />
          </div>

          <ConsolePanel
            input={stdin}
            onInputChange={setStdin}
            output={output}
            onRun={runCode}
            isRunning={isRunning}
            collapsed={consoleCollapsed}
            onToggleCollapsed={() => setConsoleCollapsed((prev) => !prev)}
          />
        </main>

        {showChat && (
          <ChatSidebar
            onClose={() => setShowChat(false)}
            messages={chatLog}
            isThinking={isThinking}
            draft={chatDraft}
            onDraftChange={setChatDraft}
            onSend={sendChatMessage}
            isRecording={isRecording}
            onToggleRecording={toggleRecording}
            micSupported={micSupported}
            hintLevel={hintLevel}
            onRequestHint={() => requestAnalysis('hint')}
          />
        )}
      </div>
    </div>
  );
};

export default Interview;
