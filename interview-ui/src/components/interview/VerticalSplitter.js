/**
 * components/interview/VerticalSplitter.js
 * ---------------------------------------------------------------------------
 * Draggable divider between the statement column and the editor.
 *
 * The statement column was a fixed 300px, which is too narrow for a problem
 * with sample data in it and too wide once the candidate is heads-down in the
 * editor. Letting the divider move is the cheapest way to serve both.
 *
 * Listeners live on `window` for the duration of a drag so the pointer can
 * outrun the 6px handle without the drag dropping.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useTheme } from '../../theme/ThemeContext';

/**
 * @param min      narrowest the statement column may get, in pixels
 * @param reserve  pixels to leave for the editor and the AI panel to its right
 */
const VerticalSplitter = ({ onResize, min = 280, reserve = 520 }) => {
  const { IT: T } = useTheme();
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);

  // Held in a ref so the window listeners never need re-binding mid-drag.
  const boundsRef = useRef({ min, reserve });
  boundsRef.current = { min, reserve };

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return undefined;

    const onMove = (e) => {
      const { min: lo, reserve: keep } = boundsRef.current;
      // Read the width per move so the clamp survives a window resize.
      const hi = Math.max(lo, window.innerWidth - keep);
      onResize(Math.min(hi, Math.max(lo, e.clientX)));
    };
    const onUp = () => setDragging(false);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    // Without this the drag selects text across both panes.
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [dragging, onResize]);

  const active = dragging || hover;

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '5px',
        flexShrink: 0,
        cursor: 'col-resize',
        background: active ? T.green : T.border,
        transition: dragging ? 'none' : 'background 0.15s ease',
      }}
    />
  );
};

export default VerticalSplitter;
