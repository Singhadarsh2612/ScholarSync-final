/**
 * components/interview/StartScreen.js
 * Pre-interview confirmation gate. Playing audio requires a user gesture, so
 * the Start click is also where the shared audio element gets unlocked.
 */

import React from 'react';

import { Button } from '../ui/Button';
import { FONT_STACK } from '../../theme/palette';
import { useTheme } from '../../theme/ThemeContext';

const StartScreen = ({ title, onStart }) => {
  const { IT: T } = useTheme();

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: T.bg,
        color: T.text,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '24px',
        fontFamily: FONT_STACK,
      }}
    >
      <h1 style={{ fontSize: '36px', margin: 0, fontWeight: 800, letterSpacing: '-0.5px' }}>
        {title}
      </h1>

      <div
        style={{
          background: T.panel,
          border: `1px solid ${T.border}`,
          padding: '28px',
          borderRadius: '8px',
          maxWidth: '480px',
          textAlign: 'center',
          boxShadow: T.shadowLg,
        }}
      >
        <p style={{ color: T.muted, fontSize: '16px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
          Ready to begin? Your interviewer speaks aloud and you can reply by voice,
          so <strong>microphone</strong> access is requested when you start.
          You get 10 minutes.
        </p>

        <Button
          variant="success"
          fullWidth
          onClick={onStart}
          style={{ padding: '13px 32px', fontSize: '15px', fontWeight: 700 }}
        >
          Start Interview
        </Button>
      </div>
    </div>
  );
};

export default StartScreen;
