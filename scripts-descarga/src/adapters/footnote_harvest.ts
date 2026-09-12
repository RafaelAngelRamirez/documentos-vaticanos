/**
 * Harvest vatican.va footnote apparatus into unit.referencias.
 *
 * Families:
 *   A. Word `_ftn` / `_ftnref`  (PG, VC, LG, TMA, VD, …)
 *   B. Word `_edn` / `_ednref`  (Donum Veritatis, Pastoralis actio)
 *   C. Legacy `#fn` / `fnref`   (EE)
 *
 * Notes are NEVER turned into numbered units. Targets are skipped; the
 * note text is attached to the body unit that pointed at it.
 */
import type { Reference } from "../../models/transport_data.model";

const TARGET_NAME_RE = /^(_ftn|_edn|fn)(\d+)$/i;
const REF_NAME_RE = /^(_ftnref|_ednref|fnref)(\d+)$/i;
const HREF_TARGET_RE = /#(?:_ftn|_edn|fn)(\d+)$/i;
const MARKER_RE = /^\s*[\[(]?\s*\d+\s*[\])]?\s*/;
const NOTES_HEADING_RE = /^(notas|notes)\s*$/i;

export interface FootnoteHarvest {
  /** Note number → cleaned apparatus text. */
  map: Map<string, string>;
  /** Paragraphs that belong to the apparatus (do not parse as units). */
  skipParagraphs: Set<Element>;
}

export function footnoteTargetNumber(name: string): string | null {
  const m = String(name || "").trim().match(TARGET_NAME_RE);
  return m ? m[2] : null;
}

export function footnoteRefNumber(name: string): string | null {
  const m = String(name || "").trim().match(REF_NAME_RE);
  return m ? m[2] : null;
}

export function footnoteHrefNumber(href: string): string | null {
  const m = String(href || "").trim().match(HREF_TARGET_RE);
  return m ? m[1] : null;
}

export function isFootnoteNotesHeading(text: string): boolean {
  return NOTES_HEADING_RE.test(String(text || "").trim());
}

function cleanNoteText(raw: string): string {
  return raw
    .replace(/\[\s*\]/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(MARKER_RE, "")
    .trim();
}

function foldDesc(s: string): string {
  return s
    .toLowerCase()
    .replace(/^(?:cf\.?|véase|vease)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** CSS covering all three vatican.va footnote families. */
export const FOOTNOTE_ANCHOR_SELECTOR = [
  'a[href*="_ftn"]',
  'a[name*="_ftn"]',
  'a[id*="_ftn"]',
  'a[href*="_edn"]',
  'a[name*="_edn"]',
  'a[id*="_edn"]',
  'a[href^="#fn"]',
  'a[name^="fn"]',
  'a[id^="fn"]',
].join(", ");

export function stripAllFootnoteAnchors(el: Element): void {
  el.querySelectorAll(FOOTNOTE_ANCHOR_SELECTOR).forEach((a) => a.remove());
}

/**
 * Body-side markers: `_ftnrefN`, href `#_ftnN` / `#fnN`, EE split `(N)`.
 * Order of appearance, unique.
 */
export function collectFootnoteRefIds(el: Element): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const push = (n: string | null) => {
    if (!n || seen.has(n)) return;
    seen.add(n);
    ids.push(n);
  };
  el.querySelectorAll("a").forEach((a) => {
    const name = a.getAttribute("name") || a.getAttribute("id") || "";
    const href = a.getAttribute("href") || "";
    push(footnoteRefNumber(name));
    push(footnoteHrefNumber(href));
  });
  return ids;
}

function paragraphOf(a: Element): Element | null {
  let el: Element | null = a;
  while (el) {
    if (el.tagName === "P") return el;
    el = el.parentElement;
  }
  return a.parentElement;
}

/**
 * Map apparatus targets → text and mark those <p> as skip-unit.
 */
export function collectFootnoteMap(root: Element | Document): FootnoteHarvest {
  const map = new Map<string, string>();
  const skipParagraphs = new Set<Element>();

  const anchors = Array.from(
    (root as Element).querySelectorAll
      ? (root as Element).querySelectorAll("a")
      : [],
  );

  for (const a of anchors) {
    const name = a.getAttribute("name") || a.getAttribute("id") || "";
    const n = footnoteTargetNumber(name);
    if (!n) continue;
    if (REF_NAME_RE.test(name)) continue;

    const p = paragraphOf(a);
    if (p) skipParagraphs.add(p);

    if (map.has(n)) continue;
    const raw = p ? p.textContent || "" : a.parentElement?.textContent || "";
    const text = cleanNoteText(raw);
    if (!text || isFootnoteNotesHeading(text)) continue;
    map.set(n, text);
  }

  // Headings like <p><b>Notas</b></p> immediately before apparatus
  for (const p of skipParagraphs) {
    let prev = p.previousElementSibling;
    while (prev && prev.tagName !== "P") prev = prev.previousElementSibling;
    if (prev && isFootnoteNotesHeading((prev.textContent || "").trim())) {
      skipParagraphs.add(prev);
    }
  }

  return { map, skipParagraphs };
}

export function refsFromNoteIds(
  ids: string[],
  map: Map<string, string>,
): Reference[] {
  const out: Reference[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const descripcion = map.get(id);
    if (!descripcion) continue;
    const k = foldDesc(descripcion);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ descripcion });
  }
  return out;
}

export function mergeReferences(
  a: Reference[] | undefined,
  b: Reference[] | undefined,
): Reference[] {
  const out: Reference[] = [];
  const seen = new Set<string>();
  for (const r of [...(a || []), ...(b || [])]) {
    const desc = String(r?.descripcion || "").trim();
    if (!desc) continue;
    const k = foldDesc(desc);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}
