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
} from 'src/app/services/cargar-documentos-json.service';
import { TermsProcessed } from '../../buscador/buscador.service';
import { UtilidadesService } from 'src/app/services/utilidades.service';
import { NavigationService } from 'src/app/services/navigation.service';
import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/core/auth/auth.service';
import { ReferencesService } from 'src/app/core/account/references.service';
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
    };

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
  @Output() citationPreview = new EventEmitter<{ seg: any; documentId?: string }>();

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
    private utilidadesService: UtilidadesService,
    private navigationService: NavigationService,
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
    const raw = this.stripConsecutivoPrefix(
      article.contenido ?? '',
      article.consecutivo
    );
    const refs = article.referencias ?? [];
    const userHl = this.userHighlightsFor(article);
    const segments: ContentSegment[] = [];

    let lastIndex = 0;
    REF_PLACEHOLDER.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = REF_PLACEHOLDER.exec(raw)) !== null) {
      const textBefore = raw.slice(lastIndex, match.index);
      if (textBefore) {
        segments.push({
          type: 'text',
          html: this.formatTextSegment(textBefore, terms, userHl),
        });
      }

      const refIndex = Number(match[1]);
      const ref: Referencia | undefined = refs[refIndex];
      segments.push(this.refSegmentFrom(ref, refIndex));

      lastIndex = match.index + match[0].length;
    }

    const tail = raw.slice(lastIndex);
    if (tail || segments.length === 0) {
      segments.push({
        type: 'text',
        html: this.formatTextSegment(tail, terms, userHl),
      });
    }

    return segments;
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
    const folded = this.utilidadesService.texto
      .eliminar_diacriticos(escaped)
      .toLowerCase();

    type Range = { start: number; end: number; cls: string };
    const ranges: Range[] = [];

    for (const src of sources) {
      for (const term of src.terms) {
        const t = this.utilidadesService.texto
          .eliminar_diacriticos(term)
          .toLowerCase();
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

  private stripConsecutivoPrefix(
    contenido: string,
    consecutivo: string | undefined
  ): string {
    if (!consecutivo) return contenido;
    const valor = consecutivo.trim();
    if (!valor || valor === 'no-encontrado') return contenido;
    if (contenido.startsWith(valor + ' ')) {
      return contenido.slice(valor.length + 1);
    }
    return contenido.replace(valor + ' ', '');
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

  /**
   * Follow a resolved local reference.
   * Emits citationPreview so parent can show a preview sheet.
   * Still navigates for backward compatibility.
   */
  openRef(seg: ContentSegment, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (seg.type !== 'ref' || !seg.local) {
      return;
    }

    const { idDocumento, idPunto } = seg.local;
    const asIndex = Number(idPunto);
    if (!Number.isFinite(asIndex)) {
      return;
    }

    // Emit for preview sheet (Lector will handle dv-sheet)
    this.citationPreview.emit({ seg, documentId: this.documentId });

    // Keep current navigation behavior (with fromRef stack)
    this.navigationService.navigateToUnit(idDocumento, asIndex, {
      fromRef: true,
      label: seg.label,
    });
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

    // Siempre en localStorage; se evita duplicar el marcador de una unidad.
    const yaExiste = this.anotaciones
      .forUnit(documentId, unitIndex)
      .some((x) => x.kind === 'marcador');
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
