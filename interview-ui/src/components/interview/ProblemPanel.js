/**
 * components/interview/ProblemPanel.js
 * The left-hand problem statement column.
 */

import React, { useMemo, useState } from 'react';

import { parseStatement } from './statement';
import { DIFFICULTY_COLORS, MONO_STACK } from '../../theme/palette';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Inline formatting for a run of prose.
 *
 * Exponents are the only markup these statements actually use, and `10^9`
 * rendered literally is the single biggest readability loss in a constraint
 * list, so it gets a real <sup>. Backticked spans become inline code.
 */
const RichText = ({ text, color }) => {
  const parts = useMemo(() => {
    const out = [];
    const pattern = /`([^`]+)`|(\d+|\))\^\{?(-?\d+)\}?/g;
    let last = 0;
    let match = pattern.exec(text);

    while (match) {
      if (match.index > last) out.push(text.slice(last, match.index));
      out.push(match[1] !== undefined
        ? { code: match[1] }
        : { base: match[2], exp: match[3] });
      last = match.index + match[0].length;
      match = pattern.exec(text);
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }, [text]);

  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === 'string') return <React.Fragment key={i}>{part}</React.Fragment>;
        if (part.code) {
          return (
            <code
              key={i}
              style={{ fontFamily: MONO_STACK, fontSize: '0.92em', color }}
            >
              {part.code}
            </code>
          );
        }
        return (
          <React.Fragment key={i}>
            {part.base}
            <sup style={{ fontSize: '0.72em', lineHeight: 0 }}>{part.exp}</sup>
          </React.Fragment>
        );
      })}
    </>
  );
};

/** A copyable, monospaced sample-data box. */
const SampleBlock = ({ label, text }) => {
  const { IT: T } = useTheme();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      })
      .catch(() => { /* clipboard blocked — the text is selectable anyway */ });
  };

  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: '6px',
        overflow: 'hidden',
        margin: '10px 0 16px 0',
        background: T.code,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: T.panel3,
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.6px',
            textTransform: 'uppercase',
            color: T.muted,
          }}
        >
          {label || 'Sample'}
        </span>
        <button
          type="button"
          onClick={copy}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600,
            color: copied ? T.green : T.muted,
            padding: '2px 4px',
            fontFamily: 'inherit',
          }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '10px 12px',
          fontFamily: MONO_STACK,
          fontSize: '12.5px',
          lineHeight: 1.65,
          color: T.codeText,
          overflowX: 'auto',
          whiteSpace: 'pre',
        }}
      >
        {text}
      </pre>
    </div>
  );
};

/** The `Constraints:` list — monospaced so the inequalities line up. */
const Constraints = ({ items }) => {
  const { IT: T } = useTheme();

  return (
    <ul style={{ listStyle: 'none', margin: '8px 0 16px 0', padding: 0 }}>
      {items.map((item, i) => (
        <li
          key={i}
          style={{
            fontFamily: MONO_STACK,
            fontSize: '12.5px',
            lineHeight: 1.9,
            color: T.text,
            paddingLeft: '14px',
            position: 'relative',
          }}
        >
          <span style={{ position: 'absolute', left: 0, color: T.dim }}>·</span>
          <RichText text={item} color={T.text} />
        </li>
      ))}
    </ul>
  );
};

const Block = ({ block }) => {
  const { IT: T } = useTheme();

  switch (block.type) {
    case 'heading':
      return (
        <h3
          style={{
            margin: '22px 0 4px 0',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.7px',
            textTransform: 'uppercase',
            color: T.text,
          }}
        >
          {block.text}
        </h3>
      );

    case 'list':
      return React.createElement(
        block.ordered ? 'ol' : 'ul',
        {
          style: {
            margin: '8px 0 14px 0',
            paddingLeft: '20px',
            fontSize: '13.5px',
            lineHeight: 1.75,
            color: T.text,
          },
        },
        block.items.map((item, i) => (
          <li key={i} style={{ marginBottom: '6px' }}>
            <RichText text={item} color={T.text} />
          </li>
        )),
      );

    case 'constraints':
      return <Constraints items={block.items} />;

    case 'sample':
      return <SampleBlock label={block.label} text={block.text} />;

    case 'para':
    default:
      return (
        <p style={{ margin: '0 0 13px 0', fontSize: '13.5px', lineHeight: 1.75, color: T.text }}>
          <RichText text={block.text} color={T.text} />
        </p>
      );
  }
};

const ProblemPanel = ({ problem }) => {
  const { IT: T } = useTheme();

  const blocks = useMemo(() => parseStatement(problem.description), [problem.description]);

  const difficulty = problem.tags?.difficulty || problem.difficulty || '';
  const pill = DIFFICULTY_COLORS[difficulty.toLowerCase()] || DIFFICULTY_COLORS.medium;
  const topics = problem.tags?.topics || [];

  return (
    <aside
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: T.panel,
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          padding: '18px 22px 14px 22px',
          borderBottom: `1px solid ${T.border}`,
          flexShrink: 0,
          background: T.panel,
        }}
      >
        <h2
          style={{
            margin: '0 0 10px 0',
            fontSize: '19px',
            fontWeight: 700,
            lineHeight: 1.3,
            color: T.text,
            letterSpacing: '-0.2px',
          }}
        >
          {problem.title}
        </h2>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          {difficulty && (
            <span
              style={{
                background: pill.bg,
                color: pill.fg,
                border: `1px solid ${pill.border}`,
                padding: '2px 10px',
                borderRadius: '3px',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.4px',
              }}
            >
              {difficulty}
            </span>
          )}
          {topics.map((topic) => (
            <span
              key={topic}
              style={{
                background: T.subtleBg,
                color: T.muted,
                border: `1px solid ${T.border}`,
                padding: '2px 10px',
                borderRadius: '3px',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              {topic}
            </span>
          ))}
        </div>
      </header>

      <div
        className="ss-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: '18px 22px 40px 22px' }}
      >
        {blocks.map((block, i) => <Block key={i} block={block} />)}
      </div>
    </aside>
  );
};

export default ProblemPanel;
