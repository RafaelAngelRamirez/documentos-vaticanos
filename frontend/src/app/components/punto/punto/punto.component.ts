import { Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
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
export class PuntoComponent implements OnInit {
  private _infoPunto!: ArticleInfo;
  mostrar_opciones = false;

  /** Rendered content pieces (escaped text + ref links). */
  segments: ContentSegment[] = [];

  /** Optional corpus document id for ★ save (set by lector). */
  @Input() documentId: string | undefined;

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

  constructor(
    private utilidadesService: UtilidadesService,
    private navigationService: NavigationService,
    public auth: AuthService,
    private references: ReferencesService
  ) {}

  ngOnInit(): void {}

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

    this.segments = this.buildSegments(procesado.article, terms);

    return procesado;
  }

  /**
   * Split article content on ref placeholders and produce safe segments.
   * Text is HTML-escaped; search-term highlights are injected only into text.
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
    const segments: ContentSegment[] = [];

    let lastIndex = 0;
    REF_PLACEHOLDER.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = REF_PLACEHOLDER.exec(raw)) !== null) {
      const textBefore = raw.slice(lastIndex, match.index);
      if (textBefore) {
        segments.push({
          type: 'text',
          html: this.formatTextSegment(textBefore, terms),
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
        html: this.formatTextSegment(tail, terms),
      });
    }

    return segments;
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

  private formatTextSegment(text: string, terms?: string[]): string {
    const escaped = this.escapeHtml(text);
    if (!terms?.length) {
      return escaped;
    }
    return this.highlightTerms(escaped, terms);
  }

  /**
   * Highlight search terms on already-escaped HTML text.
   * Matching uses diacritic folding; ranges that would cut HTML entities are skipped.
   */
  private highlightTerms(escaped: string, terms: string[]): string {
    if (!terms.length) return escaped;

    const folded = this.utilidadesService.texto
      .eliminar_diacriticos(escaped)
      .toLowerCase();

    type Range = { start: number; end: number };
    const ranges: Range[] = [];

    for (const term of terms) {
      const t = this.utilidadesService.texto
        .eliminar_diacriticos(term)
        .toLowerCase();
      if (!t) continue;

      let from = 0;
      while (from < folded.length) {
        const idx = folded.indexOf(t, from);
        if (idx < 0) break;
        ranges.push({ start: idx, end: idx + t.length });
        from = idx + t.length;
      }
    }

    if (!ranges.length) return escaped;

    ranges.sort((a, b) => a.start - b.start || b.end - a.end);
    const merged: Range[] = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r.start < last.end) {
        last.end = Math.max(last.end, r.end);
      } else {
        merged.push({ ...r });
      }
    }

    const safe = merged.filter((r) => !this.rangeTouchesEntity(escaped, r));

    let out = '';
    let cursor = 0;
    for (const r of safe) {
      out += escaped.slice(cursor, r.start);
      out += '<span class="resaltar">';
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
   * Follow a resolved local reference: push current unit and navigate.
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

    // idPunto is the array index in the target document (from resolve_refs).
    // Prefer the index in the route so bible verse numbers like "13" never collide.
    this.navigationService.navigateToUnit(idDocumento, asIndex, {
      fromRef: true,
      label: seg.label,
    });
  }

  get canSave(): boolean {
    return (
      this.auth.isLoggedIn &&
      Boolean(environment.apiBaseUrl) &&
      Boolean(this.documentId) &&
      this.infoPunto?.article != null
    );
  }

  saveReference(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.saveMsg = null;
    this.saveError = null;
    if (!this.canSave || !this.documentId) {
      this.saveError = this.auth.isLoggedIn
        ? 'No se puede guardar (falta documentId o API)'
        : 'Inicia sesión en Cuenta para guardar';
      return;
    }
    const a = this.infoPunto.article;
    const label =
      a.biblia?.consecutivo_versiculo ||
      (a.consecutivo && a.consecutivo !== 'no-encontrado'
        ? String(a.consecutivo)
        : undefined);
    this.references
      .save({
        documentId: this.documentId,
        unitIndex: a.index_array ?? 0,
        unitLabel: label,
      })
      .subscribe({
        next: () => {
          this.saveMsg = 'Guardada';
          setTimeout(() => (this.saveMsg = null), 2000);
        },
        error: (err) => {
          this.saveError =
            err?.error?.error || err?.message || 'Error al guardar';
        },
      });
  }
}

export interface ArticleInfo {
  article: Article;
  termns?: TermsProcessed;
  terms_pure: string[];
}
