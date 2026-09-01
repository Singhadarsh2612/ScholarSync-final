/**
 * components/interview/statement.js
 * ---------------------------------------------------------------------------
 * Turns a problem's plain-text `description` into structured blocks.
 *
 * Statements arrive as one string with conventional section labels on their
 * own line ("Constraints:", "Input:", "Examples:", ...). Rendering that with
 * `white-space: pre-wrap` collapses the whole thing into an undifferentiated
 * wall of grey text — sample data reflows mid-number, constraints lose their
 * alignment, and nothing is copyable. Parsing it here lets ProblemPanel give
 * each kind of content the treatment it needs.
 */

/** A line that is nothing but a short label and a colon starts a section. */
const HEADING_RE = /^\s*([A-Za-z][A-Za-z0-9 /()'#-]{0,38}?)\s*:\s*$/;

/** Headings that switch the parser into "the blocks below are sample data". */
const EXAMPLE_HEADING_RE = /^(examples?|sample|samples|test cases?|sample tests?)$/i;

/** Headings that are sample data outright, wherever they appear. */
const SAMPLE_HEADING_RE = /^sample (input|output)(\s*\d+)?$/i;

/** Input/Output — sample data inside an examples section, prose outside one. */
const IO_HEADING_RE = /^(input|output)(\s*(format|\d+))?$/i;

/** Constraints are a list however numeric they look. */
const CONSTRAINTS_HEADING_RE = /^constraints?$/i;

/**
 * A label with its content on the same line ("Explanation: the square root...").
 * Only these few labels qualify: anything looser starts splitting ordinary
 * sentences that happen to contain a colon.
 */
const INLINE_HEADING_RE =
  /^(Explanation|Notes?|Constraints?|Inputs?|Outputs?|Examples?)\s*:\s+(\S.*)$/;

const BULLET_RE = /^\s*[-*•]\s+(.*)$/;
const ORDERED_RE = /^\s*(\d+)[.)]\s+(.*)$/;

/**
 * Does this run of lines read as machine input rather than English?
 *
 * Sample blocks are short lines of numbers and tokens; prose has real words in
 * it. Testing for the absence of long words separates the two more reliably
 * than testing for the presence of digits, since constraint prose ("at most
 * 10^5 elements") is full of digits too.
 */
const looksLikeData = (lines) => {
  const body = lines.filter((l) => l.trim());
  if (!body.length) return false;

  const dataish = body.filter((line) => {
    const t = line.trim();
    if (t.length > 60) return false;
    // A word of four or more letters means it is a sentence, not a test case.
    return !/[A-Za-z]{4,}/.test(t);
  });

  return dataish.length / body.length >= 0.7;
};

/** Split a section body into paragraphs and bullet/numbered lists. */
const parseProse = (lines) => {
  const blocks = [];
  let para = [];
  let list = null;

  const flushPara = () => {
    if (para.length) blocks.push({ type: 'para', text: para.join(' ') });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  lines.forEach((line) => {
    if (!line.trim()) {
      flushPara();
      flushList();
      return;
    }

    const bullet = line.match(BULLET_RE);
    const ordered = !bullet && line.match(ORDERED_RE);

    if (bullet || ordered) {
      flushPara();
      const ordinal = Boolean(ordered);
      if (!list || list.ordered !== ordinal) {
        flushList();
        list = { type: 'list', ordered: ordinal, items: [] };
      }
      list.items.push(bullet ? bullet[1] : ordered[2]);
      return;
    }

    flushList();
    para.push(line.trim());
  });

  flushPara();
  flushList();
  return blocks;
};

/** Trim leading and trailing blank lines without touching indentation. */
const trimBlankEdges = (lines) => {
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start].trim()) start += 1;
  while (end > start && !lines[end - 1].trim()) end -= 1;
  return lines.slice(start, end);
};

/**
 * Number the sample boxes when a statement carries more than one test case.
 *
 * This has to run once the whole statement is parsed: while walking it, the
 * first "Input" box has no way of knowing whether a second one follows, so
 * numbering as we go yields the lopsided "Input, Input 2, Input 3".
 */
const numberRepeatedSamples = (blocks) => {
  const totals = {};
  blocks.forEach((b) => {
    if (b.type !== 'sample' || !b.label) return;
    const key = b.label.toLowerCase();
    totals[key] = (totals[key] || 0) + 1;
  });

  const seen = {};
  return blocks.map((b) => {
    if (b.type !== 'sample' || !b.label || totals[b.label.toLowerCase()] < 2) return b;
    const key = b.label.toLowerCase();
    seen[key] = (seen[key] || 0) + 1;
    return { ...b, label: `${b.label} ${seen[key]}` };
  });
};

/**
 * Parse a statement into renderable blocks.
 *
 * Returns a flat array of:
 *   { type: 'heading',     text }
 *   { type: 'para',        text }
 *   { type: 'list',        ordered, items[] }
 *   { type: 'constraints', items[] }
 *   { type: 'sample',      label, text }
 */
export const parseStatement = (raw) => {
  if (!raw) return [];

  const lines = String(raw).replace(/\r\n?/g, '\n').split('\n');

  // Pass 1 — cut the text into (heading, body) sections.
  const sections = [];
  let current = { heading: null, lines: [] };

  lines.forEach((line) => {
    const match = line.match(HEADING_RE);
    if (match) {
      sections.push(current);
      current = { heading: match[1].trim(), lines: [] };
      return;
    }

    const inline = line.match(INLINE_HEADING_RE);
    if (inline) {
      sections.push(current);
      current = { heading: inline[1].trim(), lines: [inline[2]] };
      return;
    }

    current.lines.push(line);
  });
  sections.push(current);

  // Pass 2 — render each section according to what it holds.
  const blocks = [];
  let inExamples = false;

  sections.forEach(({ heading, lines: body }) => {
    const content = trimBlankEdges(body);

    if (heading) {
      if (EXAMPLE_HEADING_RE.test(heading)) {
        inExamples = true;
      } else if (!IO_HEADING_RE.test(heading) && !SAMPLE_HEADING_RE.test(heading)) {
        inExamples = false;
      }
    }

    // A constraint list is nothing but digits and inequalities, so it trips
    // every "this is sample data" heuristic below. Claim it before they run.
    if (heading && CONSTRAINTS_HEADING_RE.test(heading)) {
      blocks.push({ type: 'heading', text: heading });
      const items = content
        .map((l) => (l.match(BULLET_RE)?.[1] ?? l).trim())
        .filter(Boolean);
      if (items.length) blocks.push({ type: 'constraints', items });
      return;
    }

    // A heading with an empty body is a group label ("Examples:"); one with a
    // sample body is the caption of the box, so it is not emitted separately.
    const isSample = content.length > 0 && heading && (
      SAMPLE_HEADING_RE.test(heading)
      || (inExamples && IO_HEADING_RE.test(heading))
      || looksLikeData(content)
    );

    if (heading && !isSample) blocks.push({ type: 'heading', text: heading });
    if (!content.length) return;

    if (isSample) {
      blocks.push({ type: 'sample', label: heading, text: content.join('\n') });
      return;
    }

    blocks.push(...parseProse(content));
  });

  return numberRepeatedSamples(blocks);
};

export default parseStatement;
