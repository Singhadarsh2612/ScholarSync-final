/**
 * components/interview/HintMeter.js
 * The five-segment hint-level meter and the request-a-hint action.
 */

import React from 'react';

import { Button } from '../ui/Button';
import { InfoIcon } from '../ui/Icons';
import { useTheme } from '../../theme/ThemeContext';

const MAX_HINT_LEVEL = 5;

const HintMeter = ({ hintLevel, isThinking, onRequestHint }) => {
  const { IT: T } = useTheme();

  return (
    <div style={{ padding: '14px 16px', background: T.toolbarBg, borderTop: `1px solid ${T.border}` }}>
      <div
        style={{
          marginBottom: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <small
          style={{
            color: T.muted,
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            fontWeight: 600,
          }}
        >
          Hint Level
        </small>

        <div style={{ display: 'flex', gap: '5px' }}>
          {Array.from({ length: MAX_HINT_LEVEL }, (_, i) => i + 1).map((level) => {
            const reached = level <= hintLevel;
            return (
              <div
                key={level}
                style={{
                  width: '20px',
                  height: '4px',
                  borderRadius: '3px',
                  background: reached ? T.green : T.border2,
                  transition: 'background 0.3s',
                }}
              />
            );
          })}
        </div>
      </div>

      <Button variant="subtle" fullWidth disabled={isThinking} onClick={onRequestHint}>
        {isThinking ? 'Consulting…' : <><InfoIcon color={T.muted} /> Request a Hint</>}
      </Button>
    </div>
  );
};

export default HintMeter;
