/**
 * components/interview/EditorToolbar.js
 * ---------------------------------------------------------------------------
 * The strip directly above the editor: language tab and editor preferences.
 *
 * The countdown and the Finish action moved up to InterviewTopBar, where they
 * belong — they govern the session, not the editor. What is left here is only
 * what changes the editing surface itself.
 */

import React from 'react';

import { useTheme } from '../../theme/ThemeContext';

const StripButton = ({ title, onClick, children, disabled = false }) => {
  const { IT: T } = useTheme();

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'transparent',
        border: 'none',
        color: disabled ? T.dim : T.muted,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '12px',
        fontWeight: 600,
        fontFamily: 'inherit',
        padding: '4px 8px',
        borderRadius: '3px',
        lineHeight: 1.4,
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = T.subtleBgHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
};

const EditorToolbar = ({
  language = 'C++',
  fontSize,
  onFontSize,
  onResetCode,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const { IT: T } = useTheme();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        background: T.toolbarBg,
        borderBottom: `1px solid ${T.border}`,
        height: '38px',
        flexShrink: 0,
      }}
    >
      {/* Language tab — C++ is the only supported target */}
      <div style={{ display: 'flex' }}>
        <div
          style={{
            padding: '0 18px',
            display: 'flex',
            alignItems: 'center',
            background: T.tabActive,
            borderRight: `1px solid ${T.border}`,
            borderBottom: `2px solid ${T.green}`,
            marginBottom: '-1px',
            fontSize: '12.5px',
            color: T.text,
            fontWeight: 700,
            letterSpacing: '0.2px',
          }}
        >
          {language}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', paddingRight: '10px' }}>
        <span style={{ fontSize: '11px', color: T.dim, marginRight: '2px' }}>Aa</span>
        <StripButton
          title="Decrease font size"
          onClick={() => onFontSize(fontSize - 1)}
          disabled={fontSize <= 11}
        >
          −
        </StripButton>
        <span
          style={{
            fontSize: '11px',
            color: T.muted,
            minWidth: '18px',
            textAlign: 'center',
            fontWeight: 600,
          }}
        >
          {fontSize}
        </span>
        <StripButton
          title="Increase font size"
          onClick={() => onFontSize(fontSize + 1)}
          disabled={fontSize >= 22}
        >
          +
        </StripButton>

        <span style={{ width: '1px', height: '16px', background: T.border2, margin: '0 8px' }} />

        <StripButton title="Restore the starter code" onClick={onResetCode}>
          Reset
        </StripButton>
        <StripButton
          title={isFullscreen ? 'Exit full screen' : 'Full screen editor'}
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? '⤡ Exit' : '⤢ Full screen'}
        </StripButton>
      </div>
    </div>
  );
};

export default EditorToolbar;
