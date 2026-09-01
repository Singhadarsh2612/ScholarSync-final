/**
 * components/ui/Button.js
 * ---------------------------------------------------------------------------
 * The button treatments the interview workspace uses, so the radii, paddings
 * and hover states are defined once instead of being retyped inline at every
 * call site.
 *
 * These are flat, HackerRank-style controls: a small radius, a single solid
 * fill, and a border that carries the meaning. The gradients and neon glows
 * they used to have came from the marketing palette and made the toolbar read
 * as decoration rather than as a set of actions.
 *
 * variant: 'primary' | 'success' | 'subtle' | 'ghost' | 'danger'
 */

import React, { useState } from 'react';

import { useTheme } from '../../theme/ThemeContext';

const BASE = {
  borderRadius: '4px',
  fontWeight: 600,
  fontSize: '13px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '7px',
  letterSpacing: '0.2px',
  transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
  fontFamily: 'inherit',
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
};

export const Button = ({
  variant = 'primary',
  disabled = false,
  fullWidth = false,
  style: styleOverride,
  children,
  ...rest
}) => {
  const { IT: T } = useTheme();
  const [hover, setHover] = useState(false);

  const variants = {
    primary: {
      background: hover ? T.subtleBgHover : T.subtleBg,
      border: `1px solid ${T.border2}`,
      color: T.text,
      padding: '7px 16px',
    },
    success: {
      background: hover ? T.greenDark : T.green,
      border: `1px solid ${hover ? T.greenDark : T.green}`,
      color: '#ffffff',
      padding: '7px 18px',
    },
    subtle: {
      background: hover ? T.subtleBgHover : T.subtleBg,
      border: `1px solid ${T.border}`,
      color: T.text,
      padding: '9px 14px',
    },
    ghost: {
      background: hover ? T.subtleBg : 'transparent',
      border: `1px solid ${T.border2}`,
      color: T.text,
      padding: '7px 16px',
    },
    danger: {
      background: hover ? 'rgba(233,75,60,0.10)' : 'transparent',
      border: `1px solid ${T.danger}`,
      color: T.danger,
      padding: '7px 16px',
    },
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...BASE,
        ...variants[variant],
        width: fullWidth ? '100%' : undefined,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        ...styleOverride,
      }}
      {...rest}
    >
      {children}
    </button>
  );
};

/** Small square button for icons in dense toolbars. */
export const IconButton = ({ active = false, style: styleOverride, children, ...rest }) => {
  const { IT: T } = useTheme();
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...BASE,
        background: active
          ? 'rgba(233,75,60,0.12)'
          : (hover ? T.subtleBgHover : 'transparent'),
        border: `1px solid ${active ? T.danger : T.border2}`,
        color: active ? T.danger : T.muted,
        padding: '7px 9px',
        fontSize: '14px',
        ...styleOverride,
      }}
      {...rest}
    >
      {children}
    </button>
  );
};

export default Button;
