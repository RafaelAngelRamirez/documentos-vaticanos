/**
 * Parser for CSS and Angular templates. The custom rule reads the raw
 * source; this AST only has to be a Program ESLint can walk.
 */
export function parseForESLint(code) {
  const text = typeof code === 'string' ? code : '';
  const lines = text.split('\n');
  const last = lines.length === 0 ? '' : lines[lines.length - 1];
  return {
    ast: {
      type: 'Program',
      body: [],
      sourceType: 'script',
      loc: {
        start: { line: 1, column: 0 },
        end: { line: Math.max(lines.length, 1), column: last.length },
      },
      range: [0, text.length],
      tokens: [],
      comments: [],
    },
    visitorKeys: {
      Program: [],
    },
    services: {},
  };
}

export default { parseForESLint };
