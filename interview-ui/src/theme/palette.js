/**
 * theme/palette.js
 * ---------------------------------------------------------------------------
 * The ScholarSync colour palette, in one place.
 *
 * This 21-key object was previously rebuilt inline inside Interview.js on
 * every render, with the other pages hardcoding the same hex values. Both
 * variants are declared here so the two themes stay in step.
 */

export const FONT_STACK =
  "'SF Pro Display','SF Pro Text','Segoe UI',system-ui,'Inter',sans-serif";

export const MONO_STACK =
  "'SF Mono','Fira Code','Cascadia Code','Consolas',monospace";

/** Colours that are the same in both themes. */
const SHARED = {
  accent: '#1060f0',
  accent2: '#3d7fff',
  cyan: '#00cfff',
  danger: '#ff6b6b',
};

const DARK = {
  ...SHARED,
  bg: '#020810',
  panel: '#050d1c',
  panel2: '#08152a',
  border: 'rgba(16,96,240,.14)',
  border2: 'rgba(0,207,255,.18)',
  text: '#edf4ff',
  muted: '#8aaed4',
  mint: '#00e5a0',
  aiMsg: 'rgba(16,96,240,0.06)',
  aiBorder: 'rgba(0,207,255,.18)',
  userMsg: 'rgba(16,96,240,0.18)',
  input: '#0c1d3a',
  inputText: '#edf4ff',
  glow: 'rgba(16,96,240,.2)',
  glow2: 'rgba(0,207,255,.15)',
  tabActive: '#0c1d3a',
  toolbarBg: '#050d1c',
  consoleText: '#00e5a0',
  subtleBg: 'rgba(16,96,240,0.08)',
  subtleBgHover: 'rgba(16,96,240,0.15)',
};

const LIGHT = {
  ...SHARED,
  bg: '#f0f4fa',
  panel: '#ffffff',
  panel2: '#eaf0fb',
  border: '#c5d5f0',
  border2: '#90bce8',
  text: '#0c1d3a',
  muted: '#426080',
  mint: '#00b37a',
  aiMsg: '#e3eeff',
  aiBorder: '#b3cfff',
  userMsg: '#1060f0',
  input: '#ffffff',
  inputText: '#0c1d3a',
  glow: 'transparent',
  glow2: 'transparent',
  tabActive: '#ffffff',
  toolbarBg: '#f0f4fa',
  consoleText: '#007700',
  subtleBg: '#e8f0fe',
  subtleBgHover: '#d8e8fe',
};

export const PALETTES = { dark: DARK, light: LIGHT };

/** Chart series colours, shared by the Landing and Analysis dashboards. */
export const CHART_COLORS = [
  '#00cfff', '#6aa0ff', '#00e5a0', '#3d7fff', '#f59e0b', '#a855f7', '#84cc16',
];

export default PALETTES;

/* ---------------------------------------------------------------------------
 * Interview workspace palette
 * ---------------------------------------------------------------------------
 * The coding workspace is a tool, not a landing page: the neon-on-navy scheme
 * above fights the syntax highlighting and buries the problem statement. These
 * keys mirror HackerRank's editor chrome — near-neutral greys, a white
 * statement column, one green action colour — and are exposed as `IT` from the
 * theme context so the marketing pages keep the palettes above untouched.
 *
 * Key names are deliberately identical to PALETTES so a component can swap one
 * for the other with a single destructuring change.
 */

/** Difficulty pill colours, shared by both themes. */
export const DIFFICULTY_COLORS = {
  easy: { fg: '#1ba94c', bg: 'rgba(46,200,102,0.12)', border: 'rgba(46,200,102,0.35)' },
  medium: { fg: '#c98a00', bg: 'rgba(255,184,0,0.14)', border: 'rgba(255,184,0,0.4)' },
  hard: { fg: '#e94b3c', bg: 'rgba(233,75,60,0.12)', border: 'rgba(233,75,60,0.35)' },
};

const IT_SHARED = {
  accent: '#39424e',
  accent2: '#4a5563',
  green: '#2ec866',
  greenDark: '#25a353',
  cyan: '#0f8fdb',
  danger: '#e94b3c',
  warn: '#ffb800',
};

const IT_LIGHT = {
  ...IT_SHARED,
  bg: '#f0f0f0',
  panel: '#ffffff',
  panel2: '#f7f8fa',
  panel3: '#ebedf0',
  border: '#e0e0e0',
  border2: '#d2d5da',
  text: '#39424e',
  muted: '#6b7280',
  dim: '#9aa4b0',
  mint: '#1ba94c',
  code: '#f4f5f7',
  codeText: '#39424e',
  input: '#ffffff',
  inputText: '#39424e',
  topbar: '#ffffff',
  toolbarBg: '#f7f8fa',
  tabActive: '#ffffff',
  consoleText: '#39424e',
  aiMsg: '#f4f6f8',
  aiBorder: '#e0e0e0',
  userMsg: '#39424e',
  subtleBg: '#f0f1f3',
  subtleBgHover: '#e4e6ea',
  shadow: '0 1px 3px rgba(57,66,78,0.10)',
  shadowLg: '0 4px 16px rgba(57,66,78,0.12)',
  monaco: 'vs',
};

const IT_DARK = {
  ...IT_SHARED,
  accent: '#e8eaed',
  accent2: '#c3c9d1',
  bg: '#15181c',
  panel: '#1e2228',
  panel2: '#24282f',
  panel3: '#2b3038',
  border: '#333941',
  border2: '#424a54',
  text: '#e8eaed',
  muted: '#a4adb8',
  dim: '#78828e',
  mint: '#2ec866',
  code: '#171a1f',
  codeText: '#d7dbe0',
  input: '#171a1f',
  inputText: '#e8eaed',
  topbar: '#1e2228',
  toolbarBg: '#24282f',
  tabActive: '#1e2228',
  consoleText: '#d7dbe0',
  aiMsg: '#24282f',
  aiBorder: '#333941',
  userMsg: '#2f6fb5',
  subtleBg: '#2b3038',
  subtleBgHover: '#343b44',
  shadow: '0 1px 3px rgba(0,0,0,0.4)',
  shadowLg: '0 4px 16px rgba(0,0,0,0.45)',
  monaco: 'vs-dark',
};

export const INTERVIEW_PALETTES = { dark: IT_DARK, light: IT_LIGHT };
