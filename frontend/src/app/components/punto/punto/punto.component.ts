import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { Subscription } from 'rxjs';
import {
  Article,
  Referencia,
} from 'src/app/core/corpus/corpus.models';
import { TermsProcessed } from '../../buscador/buscador.service';
import { displayBody } from 'src/app/core/text/strip-shown-number.logic';
import { stripDiacritics } from 'src/app/core/text/strip-diacritics.js';
import {
  documentIdKey,
  parseDocumentId,
  parseUnitIndex,
} from 'src/app/core/reading/cite';
import { parseBibleCites } from 'src/app/core/liturgia/bible-cite.logic';
import { findPatristicSpans } from 'src/app/core/reading/patristic-cite.logic';
import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/core/auth/auth.service';
import { ReferencesService } from 'src/app/core/account/references.service';
import { unitHasBookmark } from 'src/app/core/reading/reading-place.logic';
import { AnotacionesService } from 'src/app/services/anotaciones.service';
import {
  headingLevel,
  headingLevelClass,
  type HeadingLevel,
} from 'src/app/services/speech-prep.logic';

/** Placeholder pattern produced by the scraper: `[+[0]+]`, `[+[1]+]`, … */
const REF_PLACEHOLDER = /\[\+\[(\d+)\]\+\]/g;

export type ContentSegment =
  | { type: 'text'; html: string }
  | {
      type: 'ref';
      label: string;
      index: number;
      local?: { idDocumento: string; idPunto: string };
      url?: string;
      /** Opens the shared passage sheet. The label is the cite, not a route. */
      patristic?: boolean;
      /**
       * Bible label with no stored `local` (English `Mt 5:12`, `Gen 17:1`).
       * The sheet uses the Spanish cite-map and the reader's bible pack.
       */
      bible?: boolean;
    };

export type RefSegment = Extract<ContentSegment, { type: 'ref' }>;

/**
 * Citation click. Parent opens the shared cited-passage sheet
 * (`resolveCitedPassageFromLocalRef`); openRef does not navigate.
 */
export interface CitationPreview {
  seg: RefSegment;
  documentId?: string;
}

@Component({
  selector: 'app-punto',
  templateUrl: './punto.component.html',
  styleUrls: ['./punto.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class PuntoComponent implements OnInit, OnDestroy {
  private _infoPunto!: ArticleInfo;
  mostrar_opciones = false;

  /** Rendered content pieces (escaped text + ref links). */
  segments: ContentSegment[] = [];

  /** Optional corpus document id for ★ save (set by lector). */
  @Input() documentId: string | undefined;

  /**
   * Emitted when user clicks a citation.
   * Parent (Lector) can show a preview dv-sheet instead of direct navigation.
   */
  @Output() citationPreview = new EventEmitter<CitationPreview>();

  saveMsg: string | null = null;
  saveError: string | null = null;

  public get infoPunto(): ArticleInfo {
    return this._infoPunto;
  }
  @Input()
  public set infoPunto(value: ArticleInfo) {
    this._infoPunto = this.procesar(value);
  }

  terminos_de_busqueda: string[] = [];

  private lastTerms: string[] | undefined;
  private hlSub?: Subscription;

  constructor(
    public auth: AuthService,
    private references: ReferencesService,
    private anotaciones: AnotacionesService
  ) {}

  ngOnInit(): void {
    // Re-render highlights when local annotations change (BehaviorSubject
    // emits immediately, covering the case where documentId arrived after
    // the first infoPunto set).
    this.hlSub = this.anotaciones.anotaciones$.subscribe(() => {
      if (this._infoPunto?.article) {
        this.segments = this.buildSegments(
          this._infoPunto.article,
          this.lastTerms
        );
      }
    });
  }

  ngOnDestroy(): void {
    this.hlSub?.unsubscribe();
  }

  /** Número inline al inicio del párrafo (diseño 2B: «17.»). */
  get numLabel(): string {
    const a = this._infoPunto?.article;
    if (!a) return '';
    // Títulos/secciones estructurales: sin numeral de párrafo (no aporta sentido).
    if (this.isHeading) return '';
    const bib = a.biblia?.consecutivo_versiculo;
    if (bib) return bib;
    return this.obtener_consecutivo(a.consecutivo) || '';
  }

  /**
   * Nivel de título estructural (0 = cuerpo; 1 = PARTE…; 3 = ARTÍCULO…).
   * Misma lógica pura que speech-prep / narración.
   */
  get headingLevel(): HeadingLevel {
    const a = this._infoPunto?.article;
    if (!a) return 0;
    return headingLevel(a.contenido ?? '', {
      consecutivo: a.consecutivo,
    });
  }

  /** Unidad de título/sección (cualquier nivel > 0). */
  get isHeading(): boolean {
    return this.headingLevel > 0;
  }

  /** Modificador CSS `punto-heading--N` (vacío en cuerpo). */
  get headingClass(): string {
    return headingLevelClass(this.headingLevel);
  }

  procesar(value: ArticleInfo): ArticleInfo {
    if (!value) {
      this.segments = [];
      return value;
    }

    // Shallow copy so shared corpus articles are not mutated in place.
    const procesado: ArticleInfo = {
      ...value,
      article: { ...value.article },
      terms_pure: value.terms_pure ?? [],
    };

    const terms =
      procesado.terms_pure?.length > 0 ? procesado.terms_pure : undefined;
    this.lastTerms = terms;

    this.segments = this.buildSegments(procesado.article, terms);

    return procesado;
  }

  /**
   * Split article content on ref placeholders and produce safe segments.
   * Text is HTML-escaped; search-term and user-highlight spans are injected
   * only into text segments.
   */
  private buildSegments(
    article: Article,
    terms?: string[]
  ): ContentSegment[] {
    const raw = displayBody(article);
    const refs = article.referencias ?? [];
    const userHl = this.userHighlightsFor(article);
    const segments: ContentSegment[] = [];

    let lastIndex = 0;
    REF_PLACEHOLDER.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = REF_PLACEHOLDER.exec(raw)) !== null) {
      const textBefore = raw.slice(lastIndex, match.index);
      this.appendPlain(segments, textBefore, terms, userHl);

      const refIndex = Number(match[1]);
      const ref: Referencia | undefined = refs[refIndex];
      segments.push(this.refSegmentFrom(ref, refIndex));

      lastIndex = match.index + match[0].length;
    }

    const tail = raw.slice(lastIndex);
    if (tail) {
      this.appendPlain(segments, tail, terms, userHl);
    } else if (segments.length === 0) {
      segments.push({
        type: 'text',
        html: this.formatTextSegment('', terms, userHl),
      });
    }

    return segments;
  }

  /**
   * Plain prose, plus a patristic cite whose section or chapter is already
   * in the offline corpus. The cite becomes a link; the rest stays text.
   */
  private appendPlain(
    segments: ContentSegment[],
    text: string,
    terms: string[] | undefined,
    userHl: string[]
  ): void {
    if (!text) return;
    const spans = findPatristicSpans(text);
    if (!spans.length) {
      segments.push({
        type: 'text',
        html: this.formatTextSegment(text, terms, userHl),
      });
      return;
    }
    let cursor = 0;
    for (const span of spans) {
      if (span.start > cursor) {
        segments.push({
          type: 'text',
          html: this.formatTextSegment(
            text.slice(cursor, span.start),
            terms,
            userHl
          ),
        });
      }
      segments.push({
        type: 'ref',
        label: span.label,
        index: -1,
        patristic: true,
      });
      cursor = span.end;
    }
    if (cursor < text.length) {
      segments.push({
        type: 'text',
        html: this.formatTextSegment(text.slice(cursor), terms, userHl),
      });
    }
  }

  /** Subrayados del usuario para esta unidad (diseño 4A). */
  private userHighlightsFor(article: Article): string[] {
    const idx = article.index_array;
    if (!this.documentId || idx == null || idx < 0) return [];
    return this.anotaciones.highlightsFor(this.documentId, idx);
  }

  private refSegmentFrom(
    ref: Referencia | undefined,
    index: number
  ): ContentSegment {
    const label = ref?.descripcion?.trim() || `[ref ${index}]`;
    const local =
      ref?.local?.idDocumento && ref?.local?.idPunto
        ? {
            idDocumento: ref.local.idDocumento,
            idPunto: ref.local.idPunto,
          }
        : undefined;

    return {
      type: 'ref',
      label,
      index,
      local,
      url: ref?.url,
      bible: !local && parseBibleCites(label) != null,
    };
  }

  private formatTextSegment(
    text: string,
    terms: string[] | undefined,
    userHl: string[]
  ): string {
    const escaped = this.escapeHtml(text);
    const sources: { terms: string[]; cls: string }[] = [];
    if (userHl.length) {
      // Escape the stored excerpts the same way the text was escaped so the
      // folded indexOf matching stays aligned.
      sources.push({ terms: userHl.map((h) => this.escapeHtml(h)), cls: 'hl' });
    }
    if (terms?.length) {
      sources.push({ terms, cls: 'resaltar' });
    }
    if (!sources.length) {
      return escaped;
    }
    return this.injectHighlights(escaped, sources);
  }

  /**
   * Inject highlight spans on already-escaped HTML text.
   * Matching uses diacritic folding; ranges that would cut HTML entities are
   * skipped; overlapping ranges keep the first source (user highlights win).
   */
  private injectHighlights(
    escaped: string,
    sources: { terms: string[]; cls: string }[]
  ): string {
    const folded = stripDiacritics(escaped).toLowerCase();

    type Range = { start: number; end: number; cls: string };
    const ranges: Range[] = [];

    for (const src of sources) {
      for (const term of src.terms) {
        const t = stripDiacritics(term).toLowerCase();
        if (!t) continue;

        let from = 0;
        while (from < folded.length) {
          const idx = folded.indexOf(t, from);
          if (idx < 0) break;
          ranges.push({ start: idx, end: idx + t.length, cls: src.cls });
          from = idx + t.length;
        }
      }
    }

    if (!ranges.length) return escaped;

    ranges.sort((a, b) => a.start - b.start || b.end - a.end);
    const kept: Range[] = [];
    for (const r of ranges) {
      const last = kept[kept.length - 1];
      if (last && r.start < last.end) {
        if (last.cls === r.cls) {
          last.end = Math.max(last.end, r.end);
        }
        continue;
      }
      kept.push({ ...r });
    }

    const safe = kept.filter((r) => !this.rangeTouchesEntity(escaped, r));

    let out = '';
    let cursor = 0;
    for (const r of safe) {
      out += escaped.slice(cursor, r.start);
      out += `<span class="${r.cls}">`;
      out += escaped.slice(r.start, r.end);
      out += '</span>';
      cursor = r.end;
    }
    out += escaped.slice(cursor);
    return out;
  }

  private rangeTouchesEntity(
    text: string,
    r: { start: number; end: number }
  ): boolean {
    const amp = text.lastIndexOf('&', r.start);
    if (amp < 0) return false;
    const semi = text.indexOf(';', amp);
    return semi >= r.start && amp < r.end;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Obtenemos el consecutivo cuando existe. El consecutivo
   * se refiere al valor que se asigna como un control
   * numérico para referencia del documento.
   */
  obtener_consecutivo(consecutivo: string | undefined) {
    if (!consecutivo) return consecutivo;

    let valor = consecutivo.trim();

    if (valor === 'no-encontrado') valor = '';
    return valor;
  }

  /** Resolved local refs for the unit footnote list. */
  get localRefs(): Referencia[] {
    const refs = this._infoPunto?.article?.referencias ?? [];
    return refs.filter(
      (r) => r?.local?.idDocumento && r?.local?.idPunto,
    );
  }

  openLocalRef(ref: Referencia, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const idDocumento = ref.local?.idDocumento;
    const idPunto = ref.local?.idPunto;
    if (!idDocumento || idPunto == null) return;
    const id = parseDocumentId(idDocumento);
    const unitIndex = parseUnitIndex(idPunto);
    if (!id || unitIndex == null) return;
    const label =
      (typeof ref.descripcion === 'string' && ref.descripcion.trim()) ||
      documentIdKey(id);
    this.citationPreview.emit({
      seg: {
        type: 'ref',
        label,
        index: -1,
        local: { idDocumento, idPunto: String(idPunto) },
      },
      documentId: this.documentId,
    });
  }

  /** Patristic cites that are not already a link inside the paragraph. */
  get patristicFootnotes(): string[] {
    const inline = new Set<string>();
    for (const seg of this.segments) {
      if (seg.type === 'ref' && seg.patristic) inline.add(seg.label);
    }
    const out: string[] = [];
    const seen = new Set<string>();
    for (const ref of this._infoPunto?.article?.referencias ?? []) {
      const raw = ref?.descripcion?.trim();
      if (!raw || ref.local?.idDocumento) continue;
      const spans = findPatristicSpans(raw);
      if (spans.length !== 1) continue;
      const label = spans[0].label;
      if (inline.has(label) || seen.has(label)) continue;
      seen.add(label);
      out.push(label);
    }
    return out;
  }

  openPatristicLabel(label: string, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const text = (label || '').trim();
    if (!text) return;
    this.citationPreview.emit({
      seg: { type: 'ref', label: text, index: -1, patristic: true },
      documentId: this.documentId,
    });
  }

  openRef(seg: ContentSegment, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (seg.type !== 'ref' || (!seg.local && !seg.patristic && !seg.bible)) {
      return;
    }

    if (seg.local) {
      const { idDocumento, idPunto } = seg.local;
      const id = parseDocumentId(idDocumento);
      const unitIndex = parseUnitIndex(idPunto);
      if (!id || unitIndex == null) return;
    }

    // Bible, doc-to-doc, and a located patristic passage: one sheet.
    this.citationPreview.emit({ seg, documentId: this.documentId });
  }

  get canSave(): boolean {
    // Offline-first (F8a): guardar no requiere sesión ni API.
    return Boolean(this.documentId) && this._infoPunto?.article != null;
  }

  saveReference(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.saveMsg = null;
    this.saveError = null;

    // Narrow locals — TS does not treat getter `canSave` as a type guard.
    const documentId = this.documentId;
    const article = this._infoPunto?.article;
    if (!documentId || !article) {
      this.saveError = 'No se puede guardar (falta documentId)';
      return;
    }

    const unitIndex = article.index_array ?? 0;
    const label =
      article.biblia?.consecutivo_versiculo ||
      (article.consecutivo && article.consecutivo !== 'no-encontrado'
        ? String(article.consecutivo)
        : undefined);

    // Misma cita (pack + unidad). Un subrayado o una nota no ocupan el marcador.
    const yaExiste = unitHasBookmark(
      this.anotaciones.snapshot,
      documentId,
      unitIndex,
    );
    if (!yaExiste) {
      this.anotaciones.add({
        documentId,
        unitIndex,
        unitLabel: label,
        excerpt: '',
        kind: 'marcador',
      });
    }
    this.saveMsg = 'Guardada';
    setTimeout(() => {
      this.saveMsg = null;
    }, 2000);

    // Nube opcional: solo con sesión y API, best-effort con catch silencioso.
    if (this.auth.isLoggedIn && environment.apiBaseUrl) {
      this.references
        .save({
          documentId,
          unitIndex,
          unitLabel: label,
        })
        .subscribe({ error: () => {} });
    }
  }
}

export interface ArticleInfo {
  article: Article;
  termns?: TermsProcessed;
  terms_pure: string[];
}
