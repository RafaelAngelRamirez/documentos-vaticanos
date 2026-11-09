/**
 * Flex push with a physical left margin. Centering (margin-left and
 * margin-right both auto in the same block) is a different pattern.
 *
 * Canonical push already used by `.wsearch` in styles.css and by
 * `.paso-actions`: margin-inline-start: auto.
 */

export const FEATURE_MAP =
  '.cursor/skills/verify-documentos-vaticanos/features/buscar.md';

export const MESSAGE =
  'No uses margin-left: auto. Usa margin-inline-start: auto. Ver feature map ' +
  FEATURE_MAP;

const PUSH = /margin-left\s*:\s*auto\b/g;
const RIGHT_AUTO = /margin-right\s*:\s*auto\b/;
const COMMENT = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
const STYLE_ATTR = /style\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function commentSpans(text) {
  const spans = [];
  COMMENT.lastIndex = 0;
  let match;
  while ((match = COMMENT.exec(text))) {
    spans.push([match.index, match.index + match[0].length]);
  }
  return spans;
}

function inside(spans, index) {
  return spans.some(([start, end]) => index >= start && index < end);
}

function styleAttributeValue(text, index) {
  STYLE_ATTR.lastIndex = 0;
  let match;
  while ((match = STYLE_ATTR.exec(text))) {
    const value = match[1] != null ? match[1] : match[2];
    const offset = match[0].indexOf(value);
    const start = match.index + offset;
    const end = start + value.length;
    if (index >= start && index < end) return value;
  }
  return null;
}

function innermostBlock(text, index) {
  let depth = 0;
  for (let i = index; i >= 0; i -= 1) {
    const ch = text[i];
    if (ch === '}') depth += 1;
    else if (ch === '{') {
      if (depth === 0) {
        let inner = 0;
        for (let j = i + 1; j < text.length; j += 1) {
          if (text[j] === '{') inner += 1;
          else if (text[j] === '}') {
            if (inner === 0) return text.slice(i + 1, j);
            inner -= 1;
          }
        }
        return text.slice(i + 1);
      }
      depth -= 1;
    }
  }
  return text;
}

export function findMarginLeftAuto(text) {
  const spans = commentSpans(text);
  const hits = [];
  PUSH.lastIndex = 0;
  let match;
  while ((match = PUSH.exec(text))) {
    if (inside(spans, match.index)) continue;
    const styled = styleAttributeValue(text, match.index);
    const block = styled != null ? styled : innermostBlock(text, match.index);
    if (RIGHT_AUTO.test(block)) continue;
    hits.push({ index: match.index, length: match[0].length });
  }
  return hits;
}

function locFrom(sourceCode, index, length) {
  return {
    start: sourceCode.getLocFromIndex(index),
    end: sourceCode.getLocFromIndex(index + length),
  };
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Reject margin-left: auto used to push a flex item. Use margin-inline-start: auto.',
    },
    schema: [],
    messages: {
      useInlineStart: MESSAGE,
    },
  },
  create(context) {
    return {
      Program() {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        const text = sourceCode.getText();
        for (const hit of findMarginLeftAuto(text)) {
          context.report({
            loc: locFrom(sourceCode, hit.index, hit.length),
            messageId: 'useInlineStart',
          });
        }
      },
    };
  },
};

export default rule;
