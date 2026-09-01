/**
 * components/interview/InterviewTopBar.js
 * ---------------------------------------------------------------------------
 * The full-width workspace header: identity on the left, the countdown in the
 * middle, session actions on the right.
 *
 * The countdown and the Finish action used to sit in the editor's own toolbar,
 * which scoped them to the middle column and left them competing with the
 * language tab for attention. Session-level controls belong above the split.
 */

import React from 'react';

import { Button, IconButton } from '../ui/Button';
import { MoonIcon, SparkIcon, SunIcon } from '../ui/Icons';
import { MONO_STACK } from '../../theme/palette';
import { useTheme } from '../../theme/ThemeContext';

/** Seconds -> m:ss */
export const formatTime = (totalSeconds) => {
  const safe = Math.max(0, totalSeconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

/** Fraction of the interview still remaining, clamped to 0..1. */
const remaining = (timeLeft, total) => Math.min(1, Math.max(0, timeLeft / total));

const InterviewTopBar = ({
  title,
  timeLeft,
  totalSeconds,
  isSubmitting,
  showChat,
  onToggleChat,
  onFinish,
}) => {
  const { isDark, IT: T, toggleTheme } = useTheme();

  const left = remaining(timeLeft, totalSeconds);
  const urgent = timeLeft <= 60;
  const warning = !urgent && timeLeft <= 180;
  const timerColor = urgent ? T.danger : (warning ? T.warn : T.text);

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        height: '52px',
        flexShrink: 0,
        padding: '0 16px',
        background: T.topbar,
        borderBottom: `1px solid ${T.border}`,
        position: 'relative',
      }}
    >
      {/* Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <div
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '4px',
            background: T.green,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '14px',
            flexShrink: 0,
          }}
        >
          S
        </div>
        <span
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: T.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: '12px',
            color: T.dim,
            borderLeft: `1px solid ${T.border2}`,
            paddingLeft: '10px',
            whiteSpace: 'nowrap',
          }}
        >
          Coding Interview
        </span>
      </div>

      {/* Countdown */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '5px 12px',
          borderRadius: '4px',
          background: T.subtleBg,
          border: `1px solid ${urgent ? T.danger : T.border}`,
          flexShrink: 0,
          animation: urgent ? 'ss-pulse 1.4s ease-in-out infinite' : 'none',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
            color: T.muted,
          }}
        >
          Time Left
        </span>
        <span
          style={{
            fontFamily: MONO_STACK,
            fontSize: '15px',
            fontWeight: 700,
            color: timerColor,
            minWidth: '48px',
            textAlign: 'right',
          }}
        >
          {formatTime(timeLeft)}
        </span>
      </div>

      {/* Session actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <IconButton
          onClick={toggleTheme}
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </IconButton>

        <Button
          variant={showChat ? 'primary' : 'ghost'}
          onClick={onToggleChat}
          title="Toggle the AI tutor panel"
        >
          <SparkIcon /> AI Help
        </Button>

        <Button variant="danger" onClick={onFinish} disabled={isSubmitting}>
          {isSubmitting ? 'Submitting…' : 'Finish Interview'}
        </Button>
      </div>

      {/* Time remaining, as a hairline across the bottom of the bar. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: '-1px',
          height: '2px',
          width: `${left * 100}%`,
          background: urgent ? T.danger : (warning ? T.warn : T.green),
          transition: 'width 1s linear, background 0.3s ease',
        }}
      />
    </header>
  );
};

export default InterviewTopBar;
