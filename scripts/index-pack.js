/**
 * Ship representation of document index.json.
 *
 * Classic shape `{ indice, indice_por_punto }` stays valid. The ship pack
 * (`v: 2`) stores posting lists as comma-separated deltas and, when the
 * point map is a dense 0..n-1 array, a parallel CSV. Unpack restores the
 * classic shape. Document text is not an input.
 *
 * Terms that contain a tab or a newline stay classic: the line format
 * cannot carry them. Every pack is checked with a roundtrip before use.
 */

'use strict';

/**
 * @param {unknown} data
 * @returns {boolean}
 */
function isClassicIndex(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const obj = /** @type {{ v?: unknown, indice?: unknown }} */ (data);
  if (obj.v === 2) return false;
  return (
    obj.indice != null &&
    typeof obj.indice === 'object' &&
    !Array.isArray(obj.indice)
  );
}

/**
 * @param {unknown} data classic index
 * @returns {null | { v: 2, t: string, p: string | Record<string, number | null> }}
 */
function packIndex(data) {
  if (!isClassicIndex(data)) return null;
  const src = /** @type {{ indice: Record<string, unknown>, indice_por_punto?: unknown }} */ (
    data
  );
  /** @type {string[]} */
  const lines = [];
  for (const term of Object.keys(src.indice)) {
    if (
      term.includes('\t') ||
      term.includes('\n') ||
      term.includes('\r')
    ) {
      return null;
    }
    const arr = src.indice[term];
    if (!Array.isArray(arr)) return null;
    if (arr.length === 0) {
      lines.push(term);
      continue;
    }
    /** @type {string[]} */
    const deltas = [];
    let prev = 0;
    for (const n of arr) {
      if (!Number.isInteger(n)) return null;
      deltas.push(String(n - prev));
      prev = n;
    }
    lines.push(term + '\t' + deltas.join(','));
  }

  const ippRaw = src.indice_por_punto;
  const ipp =
    ippRaw && typeof ippRaw === 'object' && !Array.isArray(ippRaw)
      ? /** @type {Record<string, unknown>} */ (ippRaw)
      : {};
  const keys = Object.keys(ipp);
  let dense = true;
  /** @type {string[]} */
  const points = [];
  for (let i = 0; i < keys.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(ipp, String(i))) {
      dense = false;
      break;
    }
    const v = ipp[String(i)];
    if (v != null && !Number.isInteger(v)) return null;
    points.push(v == null ? '' : String(v));
  }

  /** @type {{ v: 2, t: string, p: string | Record<string, number | null> }} */
  const packed = { v: 2, t: lines.join('\n'), p: '' };
  if (dense) {
    packed.p = points.join(',');
  } else {
    /** @type {Record<string, number | null>} */
    const copy = {};
    for (const k of keys) {
      const v = ipp[k];
      if (v != null && !Number.isInteger(v)) return null;
      copy[k] = v == null ? null : v;
    }
    packed.p = copy;
  }
  return packed;
}

/**
 * @param {unknown} raw
 * @returns {null | { indice: Record<string, number[]>, indice_por_punto: Record<string, number | null> }}
 */
function unpackIndex(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = /** @type {{ v?: unknown, t?: unknown, p?: unknown }} */ (raw);
  if (obj.v !== 2 || typeof obj.t !== 'string') return null;

  /** @type {Record<string, number[]>} */
  const indice = {};
  if (obj.t.length) {
    for (const line of obj.t.split('\n')) {
      const tab = line.indexOf('\t');
      if (tab < 0) {
        if (line.length) indice[line] = [];
        continue;
      }
      const term = line.slice(0, tab);
      const rest = line.slice(tab + 1);
      if (!rest) {
        indice[term] = [];
        continue;
      }
      const parts = rest.split(',');
      /** @type {number[]} */
      const arr = new Array(parts.length);
      let prev = 0;
      for (let i = 0; i < parts.length; i++) {
        const d = Number(parts[i]);
        if (!Number.isFinite(d)) return null;
        prev += d;
        arr[i] = prev;
      }
      indice[term] = arr;
    }
  }

  /** @type {Record<string, number | null>} */
  const indice_por_punto = {};
  if (typeof obj.p === 'string') {
    if (obj.p.length) {
      if (obj.p.charAt(0) === '{') {
        let parsed;
        try {
          parsed = JSON.parse(obj.p);
        } catch {
          return null;
        }
        if (!copyPoints(parsed, indice_por_punto)) return null;
      } else {
        const parts = obj.p.split(',');
        for (let i = 0; i < parts.length; i++) {
          if (parts[i] === '') {
            indice_por_punto[String(i)] = null;
          } else {
            const n = Number(parts[i]);
            if (!Number.isFinite(n)) return null;
            indice_por_punto[String(i)] = n;
          }
        }
      }
    }
  } else if (obj.p && typeof obj.p === 'object' && !Array.isArray(obj.p)) {
    if (!copyPoints(obj.p, indice_por_punto)) return null;
  } else if (obj.p != null) {
    return null;
  }

  return { indice, indice_por_punto };
}

/**
 * @param {unknown} src
 * @param {Record<string, number | null>} dest
 * @returns {boolean}
 */
function copyPoints(src, dest) {
  if (!src || typeof src !== 'object' || Array.isArray(src)) return false;
  for (const k of Object.keys(src)) {
    const v = /** @type {Record<string, unknown>} */ (src)[k];
    if (v == null) {
      dest[k] = null;
      continue;
    }
    const n = Number(v);
    if (!Number.isFinite(n)) return false;
    dest[k] = n;
  }
  return true;
}

/**
 * @param {{ indice?: Record<string, number[]>, indice_por_punto?: Record<string, number | null> }} a
 * @param {{ indice: Record<string, number[]>, indice_por_punto: Record<string, number | null> }} b
 * @returns {boolean}
 */
function sameIndex(a, b) {
  const ia = a && a.indice ? a.indice : {};
  const ib = b && b.indice ? b.indice : {};
  const ta = Object.keys(ia);
  const tb = Object.keys(ib);
  if (ta.length !== tb.length) return false;
  for (let i = 0; i < ta.length; i++) {
    if (ta[i] !== tb[i]) return false;
    const pa = ia[ta[i]] || [];
    const pb = ib[tb[i]] || [];
    if (pa.length !== pb.length) return false;
    for (let j = 0; j < pa.length; j++) {
      if (pa[j] !== pb[j]) return false;
    }
  }
  const pa = a && a.indice_por_punto ? a.indice_por_punto : {};
  const pb = b && b.indice_por_punto ? b.indice_por_punto : {};
  const ka = Object.keys(pa);
  const kb = Object.keys(pb);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    const va = pa[k] == null ? null : pa[k];
    const vb = pb[k] == null ? null : pb[k];
    if (va !== vb) return false;
  }
  return true;
}

/**
 * Packed JSON bytes, or null when the classic file should stay.
 * @param {unknown} data
 * @returns {Buffer | null}
 */
function packIndexBuffer(data) {
  const packed = packIndex(data);
  if (!packed) return null;
  const buf = Buffer.from(JSON.stringify(packed), 'utf8');
  let back;
  try {
    back = unpackIndex(JSON.parse(buf.toString('utf8')));
  } catch {
    return null;
  }
  if (!back || !sameIndex(/** @type {{ indice: Record<string, number[]> }} */ (data), back)) {
    return null;
  }
  return buf;
}

module.exports = {
  isClassicIndex,
  packIndex,
  unpackIndex,
  sameIndex,
  packIndexBuffer,
};
