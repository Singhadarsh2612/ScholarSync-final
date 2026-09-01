/**
 * components/interview/ConsolePanel.js
 * ---------------------------------------------------------------------------
 * The bottom drawer: custom stdin, console output, and the Run action.
 *
 * The two boxes used to sit side by side and permanently consume a third of
 * the workspace, which squeezed the editor for space that is only wanted
 * around a run. Tabbing them and making the drawer collapsible gives the
 * editor that height back between runs.
 */

import React, { useEffect, useState } from 'react';

import { Button } from '../ui/Button';
import { MONO_STACK } from '../../theme/palette';
import { useTheme } from '../../theme/ThemeContext';

const INPUT_TAB = 'input';
const OUTPUT_TAB = 'output';

const Tab = ({ id, active, onSelect, children, badge }) => {
  const { IT: T } = useTheme();
  const selected = id === active;

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      style={{
        background: 'transparent',
        border: 'none',
        borderBottom: `2px solid ${selected ? T.green : 'transparent'}`,
        color: selected ? T.text : T.muted,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '0.4px',
        textTransform: 'uppercase',
        padding: '0 14px',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      {children}
      {badge}
    </button>
  );
};

const ConsolePanel = ({
  input,
  onInputChange,
  output,
  onRun,
  isRunning = false,
  collapsed,
  onToggleCollapsed,
}) => {
  const { IT: T } = useTheme();
  const [tab, setTab] = useState(INPUT_TAB);

  // A run is only interesting for what it printed, so surface that tab as soon
  // as there is something to show.
  useEffect(() => {
    if (output) setTab(OUTPUT_TAB);
  }, [output]);

  const isError = /error|exception|abort|timed out/i.test(output || '');

  const select = (id) => {
    setTab(id);
    if (collapsed) onToggleCollapsed();
  };

  return (
    <section
      style={{
        flexShrink: 0,
        background: T.panel,
        borderTop: `1px solid ${T.border}`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Tab strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '36px',
          flexShrink: 0,
          background: T.toolbarBg,
          borderBottom: collapsed ? 'none' : `1px solid ${T.border}`,
        }}
      >
        <div style={{ display: 'flex', height: '100%' }}>
          <Tab id={INPUT_TAB} active={collapsed ? null : tab} onSelect={select}>
            Custom Input
          </Tab>
          <Tab
            id={OUTPUT_TAB}
            active={collapsed ? null : tab}
            onSelect={select}
            badge={output ? (
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isError ? T.danger : T.green,
                }}
              />
            ) : null}
          >
            Output
          </Tab>
        </div>

        <button
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? 'Show the console' : 'Hide the console'}
          style={{
            background: 'transparent',
            border: 'none',
            color: T.muted,
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            fontFamily: 'inherit',
            padding: '0 14px',
            height: '100%',
          }}
        >
          {collapsed ? '▲ SHOW CONSOLE' : '▼ HIDE'}
        </button>
      </div>

      {/* Panel body */}
      {!collapsed && (
        <div style={{ height: '150px', padding: '10px 14px', background: T.panel }}>
          {tab === INPUT_TAB ? (
            <textarea
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Paste the sample input here, then Run Code."
              spellCheck={false}
              style={{
                width: '100%',
                height: '100%',
                background: T.code,
                color: T.codeText,
                border: `1px solid ${T.border}`,
                borderRadius: '4px',
                padding: '9px 11px',
                fontFamily: MONO_STACK,
                fontSize: '12.5px',
                lineHeight: 1.6,
                resize: 'none',
                outline: 'none',
              }}
            />
          ) : (
            <pre
              style={{
                width: '100%',
                height: '100%',
                margin: 0,
                overflow: 'auto',
                background: T.code,
                color: output ? (isError ? T.danger : T.codeText) : T.dim,
                border: `1px solid ${T.border}`,
                borderRadius: '4px',
                padding: '9px 11px',
                fontFamily: MONO_STACK,
                fontSize: '12.5px',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {output || 'Run your code to see the output here.'}
            </pre>
          )}
        </div>
      )}

      {/* Action bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '9px 14px',
          borderTop: `1px solid ${T.border}`,
          background: T.toolbarBg,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '11.5px', color: T.dim }}>
          Compiled and run against your custom input.
        </span>
        <Button variant="success" onClick={onRun} disabled={isRunning}>
          {isRunning ? 'Running…' : <><span style={{ fontSize: '10px' }}>▶</span> Run Code</>}
        </Button>
      </div>
    </section>
  );
};

export default ConsolePanel;
