/**
 * components/interview/ChatSidebar.js
 * The AI-help panel: transcript, composer, and hint meter.
 *
 * The panel used to hold its 340px column open with nothing but a header in it
 * whenever it was collapsed, so a third of the workspace stayed spent on an
 * empty box. It is now mounted only while it is open, and closed from its own
 * header or from the top bar.
 */

import React, { useEffect, useRef } from 'react';

import HintMeter from './HintMeter';
import { IconButton } from '../ui/Button';
import { MicIcon, SendIcon, SparkIcon } from '../ui/Icons';
import { useTheme } from '../../theme/ThemeContext';

const ROLE_LABELS = { AI: 'Interviewer', USER: 'You', SYSTEM: 'System' };

const ChatMessage = ({ message }) => {
  const { IT: T } = useTheme();
  const fromUser = message.role === 'USER';
  const isSystem = message.role === 'SYSTEM';

  if (isSystem) {
    return (
      <div
        style={{
          alignSelf: 'center',
          fontSize: '10.5px',
          fontWeight: 700,
          letterSpacing: '1px',
          textTransform: 'uppercase',
          color: T.dim,
          border: `1px solid ${T.border}`,
          borderRadius: '3px',
          padding: '3px 10px',
          background: T.subtleBg,
        }}
      >
        {message.text}
      </div>
    );
  }

  return (
    <div
      style={{
        alignSelf: fromUser ? 'flex-end' : 'flex-start',
        maxWidth: '92%',
        padding: '9px 12px',
        borderRadius: fromUser ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
        background: fromUser ? T.userMsg : T.aiMsg,
        border: `1px solid ${fromUser ? T.userMsg : T.aiBorder}`,
        animation: 'ss-fade-in 0.2s ease',
      }}
    >
      <small
        style={{
          color: fromUser ? 'rgba(255,255,255,0.75)' : T.muted,
          fontSize: '10px',
          textTransform: 'uppercase',
          fontWeight: 700,
          letterSpacing: '0.7px',
        }}
      >
        {ROLE_LABELS[message.role] || message.role}
      </small>
      <p
        style={{
          margin: '4px 0 0 0',
          fontSize: '13px',
          lineHeight: 1.6,
          color: fromUser ? '#ffffff' : T.text,
          whiteSpace: 'pre-wrap',
        }}
      >
        {message.text}
      </p>
    </div>
  );
};

const ChatSidebar = ({
  onClose,
  messages,
  isThinking,
  draft,
  onDraftChange,
  onSend,
  isRecording,
  onToggleRecording,
  micSupported,
  hintLevel,
  onRequestHint,
}) => {
  const { IT: T } = useTheme();
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  return (
    <aside
      style={{
        width: '330px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: T.panel,
        borderLeft: `1px solid ${T.border}`,
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px 0 14px',
          height: '38px',
          flexShrink: 0,
          background: T.toolbarBg,
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SparkIcon size={14} color={T.green} />
          <span
            style={{
              color: T.text,
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            AI Tutor
          </span>
        </span>
        <button
          type="button"
          onClick={onClose}
          title="Close the AI panel"
          style={{
            background: 'transparent',
            border: 'none',
            color: T.muted,
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: 1,
            padding: '6px 8px',
            fontFamily: 'inherit',
          }}
        >
          ×
        </button>
      </header>

      {/* Transcript */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '14px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {messages.map((message, i) => <ChatMessage key={i} message={message} />)}

        {isThinking && (
          <div
            style={{
              alignSelf: 'flex-start',
              background: T.aiMsg,
              border: `1px solid ${T.aiBorder}`,
              padding: '8px 14px',
              borderRadius: '8px 8px 8px 2px',
              fontSize: '12px',
              color: T.muted,
              fontStyle: 'italic',
              animation: 'ss-pulse 1.4s ease-in-out infinite',
            }}
          >
            Thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div
        style={{
          padding: '10px 12px',
          background: T.toolbarBg,
          borderTop: `1px solid ${T.border}`,
          display: 'flex',
          gap: '6px',
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
          placeholder="Ask for guidance…"
          style={{
            flex: 1,
            minWidth: 0,
            background: T.input,
            color: T.inputText,
            border: `1px solid ${T.border2}`,
            borderRadius: '4px',
            padding: '8px 11px',
            fontSize: '13px',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <IconButton onClick={onSend} title="Send">
          <SendIcon />
        </IconButton>
        {micSupported && (
          <IconButton
            onClick={onToggleRecording}
            active={isRecording}
            title={isRecording ? 'Stop voice input' : 'Voice input'}
          >
            <MicIcon />
          </IconButton>
        )}
      </div>

      <HintMeter
        hintLevel={hintLevel}
        isThinking={isThinking}
        onRequestHint={onRequestHint}
      />
    </aside>
  );
};

export default ChatSidebar;
