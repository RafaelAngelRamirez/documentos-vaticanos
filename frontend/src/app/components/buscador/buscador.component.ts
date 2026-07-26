import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, of } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';
import { BuscadorService, TermsProcessed } from './buscador.service';
import {
  CargarDocumentosJsonService,
  IndiceDocumentos as DocumentoDatos,
} from 'src/app/services/cargar-documentos-json.service';
import { CommonModule } from '@angular/common';
import { ArticleInfo } from '../punto/punto/punto.component';
import { UtilidadesService } from 'src/app/services/utilidades.service';
import { NavigationService } from 'src/app/services/navigation.service';
import { CorpusService } from 'src/app/core/corpus/corpus.service';
import { ReaderPreferencesService } from 'src/app/services/reader-preferences.service';
import {
  parseSearchInput,
  rankUnitsForDocument,
  type RankedUnitHit,
} from 'src/app/core/search/semantic-search.logic';
import {
  DEFAULT_BODY_LOAD_CONCURRENCY,
  DEFAULT_INDEX_LOAD_CONCURRENCY,
} from 'src/app/core/search/search-load.logic';
import { TopicIndexService } from 'src/app/core/search/topic-index.service';
import type { TopicPack } from 'src/app/core/search/topic-pack.models';
import {
  applyTopicBoostIfAny,
  findTopicInPack,
  hitsFromTopicPostings,
  parseTopicQuery,
  type TopicPackQueryLike,
} from 'src/app/core/search/topic-query.logic';

const PAGE = 50;
/** Unique documents to hydrate for snippets after index-only ranking. */
const SNIPPET_DOC_CAP = 24;
/** Cap ranked hits considered for body hydration. */
const RANK_HYDRATE_HIT_CAP = 80;

/** Fila plana de resultado (diseño 3E: doc · Nº + fragmento). */
export interface SearchRow {
  title: string;
  snippetHtml: string;
  punto: ArticleInfo;
  resultado: ResultadoDeBusqueda;
}

@Component({
  standalone: true,
  selector: 'app-buscador',
  templateUrl: './buscador.component.html',
  styleUrls: ['./buscador.component.css'],
  imports: [CommonModule],
})
export class BuscadorComponent implements OnInit, OnDestroy {
  terminos: TermsProcessed = {};

  docs_resultados: ResultadoDeBusqueda[] = [];

  /** Diseño 3E: lista plana de filas. */
  rows: SearchRow[] = [];
  visibleCount = PAGE;

  loading_docs = false;
  load_error: string | null = null;
  /**
   * Opt-in: search all manifest locales (heavier). Default false = contentLocale only.
   */
  allLocales = false;
  private sub = new Subscription();
  /** Bumps on each search so in-flight progressive loads can be dropped. */
  private searchGen = 0;
  /** Locale for which topic pack was last requested (avoid duplicate loads). */
  private topicPackLocale: string | null = null;

  constructor(
    public busadorService: BuscadorService,
    private documentosService: CargarDocumentosJsonService,
    private utilidadesService: UtilidadesService,
    private navigationService: NavigationService,
    private corpus: CorpusService,
    private readerPrefs: ReaderPreferencesService,
    private topics: TopicIndexService,
  ) {}

  ngOnInit(): void {
    // Manifest only on open — progressive locale load on query (PR2a).
    this.loading_docs = true;
    this.sub.add(
      this.documentosService.loadManifest().subscribe({
        next: () => {
          this.loading_docs = false;
          this.load_error = null;
        },
        error: (err) => {
          this.loading_docs = false;
          this.load_error =
            err?.message ?? 'No se pudo cargar el catálogo del corpus.';
          console.error(err);
        },
      }),
    );

    // Warm topic pack for content locale once (soft-empty if missing / flag off).
    const locale = this.readerPrefs.resolveContentLocale();
    this.ensureTopicPack(locale);

    this.sub.add(
      this.busadorService.terminos_emit.subscribe((terminos) => {
        this.terminos = terminos;
        this.procesar_busqueda(terminos);
      }),
    );
  }

  /** Subscribe loadPack once per locale (shareReplay inside service). */
  private ensureTopicPack(locale: string): void {
    if (!this.topics.featureEnabled) return;
    const loc = (locale || 'es').trim().toLowerCase().split(/[-_]/)[0] || 'es';
    if (this.topicPackLocale === loc && this.topics.isReady(loc)) return;
    this.topicPackLocale = loc;
    this.sub.add(
      this.topics.loadPack(loc).pipe(catchError(() => of(null))).subscribe(),
    );
  }

  ngOnDestroy(): void {
    this.searchGen++;
    this.sub.unsubscribe();
  }

  get hasQuery(): boolean {
    return Boolean(
      (this.terminos.terminos && this.terminos.terminos.length) ||
        (this.terminos.puntos && this.terminos.puntos.length)
    );
  }

  get visibleRows(): SearchRow[] {
    return this.rows.slice(0, this.visibleCount);
  }

  get remaining(): number {
    return Math.max(0, this.rows.length - this.visibleCount);
  }

  /** «14 resultados en 5 documentos». */
  get countLabel(): string {
    const total = this.rows.length;
    const docs = this.docs_resultados.filter((r) => r.puntos.length > 0).length;
    const res = total === 1 ? 'resultado' : 'resultados';
    const dcs = docs === 1 ? 'documento' : 'documentos';
    return `${total} ${res} en ${docs} ${dcs}`;
  }

  showMore(): void {
    this.visibleCount += PAGE;
  }

  openRow(row: SearchRow): void {
    this.navigationService.go_to_read_article(row.punto, row.resultado);
  }

  displayTitle(r: ResultadoDeBusqueda): string {
    return (
      r.doc.title ||
      r.doc.nombre ||
      this.corpus.getMeta(r.doc.id || '')?.title ||
      r.doc.id ||
      'Documento'
    );
  }

  shortLabel(r: ResultadoDeBusqueda): string {
    const base =
      r.doc.shortTitle ||
      this.corpus.getMeta(r.doc.id || '')?.shortTitle ||
      this.displayTitle(r);
    const loc =
      r.doc.locale || this.corpus.getMeta(r.doc.id || '')?.locale || '';
    if (!loc) return base;
    return `${base} · ${CorpusService.localeLabel(loc)}`;
  }

  procesar_busqueda(terminos: TermsProcessed) {
    const raw =
      terminos.rawQuery ??
      [
        ...(terminos.terminos ?? []),
        ...(terminos.puntos ?? []).map((p) => `.${p}`),
      ].join(', ');
    const topicQ = parseTopicQuery(raw, {
      mode: terminos.mode,
      slug: terminos.topicSlug,
    });
    const isTopicMode = topicQ.mode === 'topic' && !!topicQ.slug;

    const lexicalSource =
      isTopicMode && topicQ.lexicalRaw
        ? topicQ.lexicalRaw
        : isTopicMode
          ? topicQ.slug!
          : raw;

    const parsed =
      !isTopicMode && (terminos.contentTerms != null || terminos.puntos != null)
        ? {
            empty: !(
              (terminos.contentTerms?.length ?? 0) > 0 ||
              (terminos.puntos?.length ?? 0) > 0 ||
              (terminos.terminos?.length ?? 0) > 0
            ),
            phrases: terminos.terminos ?? [],
            contentTerms:
              terminos.contentTerms ??
              parseSearchInput(raw).contentTerms,
            points: terminos.puntos ?? [],
          }
        : parseSearchInput(lexicalSource);

    this.docs_resultados = [];
    if (parsed.empty && !isTopicMode) {
      this.searchGen++;
      this.loading_docs = false;
      this.buildRows();
      return;
    }

    const myGen = ++this.searchGen;
    this.loading_docs = true;
    this.load_error = null;
    const locale = this.readerPrefs.resolveContentLocale();
    this.ensureTopicPack(locale);

    // Topic pack (optional) + index load; soft-empty pack never blocks search.
    const pack$ = this.topics.featureEnabled
      ? this.topics.loadPack(locale).pipe(
          take(1),
          catchError(() => of(null as TopicPack | null)),
        )
      : of(null as TopicPack | null);

    this.sub.add(
      pack$
        .pipe(
          switchMap((pack) =>
            this.documentosService
              .ensureIndexForLocale(locale, {
                allLocales: this.allLocales,
                concurrency: DEFAULT_INDEX_LOAD_CONCURRENCY,
                isCancelled: () => myGen !== this.searchGen,
              })
              .pipe(map((indexDocs) => ({ pack, indexDocs }))),
          ),
        )
        .subscribe({
          next: ({ pack, indexDocs }) => {
            if (myGen !== this.searchGen) return;
            if (isTopicMode && topicQ.slug) {
              this.rankTopicThenHydrate(
                indexDocs,
                pack,
                topicQ.slug,
                parsed,
                myGen,
              );
              return;
            }
            this.rankThenHydrate(indexDocs, parsed, pack, myGen);
          },
          error: (err) => {
            if (myGen !== this.searchGen) return;
            this.loading_docs = false;
            this.load_error =
              err?.message ?? 'No se pudieron cargar índices para buscar.';
            this.docs_resultados = [];
            this.rows = [];
            console.error(err);
          },
        }),
    );
  }

  /**
   * Thematic mode: rank by topic postings; soft-fall back to lexical if empty.
   */
  private rankTopicThenHydrate(
    indexDocs: DocumentoDatos[],
    pack: TopicPack | null,
    slug: string,
    parsed: {
      empty: boolean;
      phrases: string[];
      contentTerms: string[];
      points: number[];
    },
    myGen: number,
  ): void {
    const byId = new Map<string, DocumentoDatos>();
    for (const doc of indexDocs) {
      const id = doc.id || doc.nombre || '';
      if (id) byId.set(id, doc);
    }

    const packLike = pack as TopicPackQueryLike | null;
    const topicHits = hitsFromTopicPostings(
      packLike,
      slug,
      RANK_HYDRATE_HIT_CAP,
    );

    if (!topicHits.length) {
      // Soft-degrade: lexical on topic label / slug when postings empty.
      const topic = findTopicInPack(packLike, slug);
      const fallbackQ = topic?.label || slug;
      const fallbackParsed = parseSearchInput(fallbackQ);
      if (!fallbackParsed.empty) {
        this.rankThenHydrate(indexDocs, fallbackParsed, pack, myGen);
        return;
      }
      if (myGen !== this.searchGen) return;
      this.loading_docs = false;
      this.docs_resultados = [];
      this.rows = [];
      return;
    }

    const rankedAll: { hit: RankedUnitHit; doc: DocumentoDatos }[] = [];
    for (const th of topicHits) {
      const doc = byId.get(th.documentId);
      if (!doc) continue;
      rankedAll.push({
        hit: {
          documentId: th.documentId,
          unitIndex: th.unitIndex,
          consecutivo: th.consecutivo,
          score: th.score,
          matchedTerms: th.matchedTerms ?? [slug],
          highlightTerms: th.highlightTerms ?? [slug],
        },
        doc,
      });
    }

    if (!rankedAll.length) {
      // Postings point at docs outside locale index scope — fall back lexical.
      const topic = findTopicInPack(packLike, slug);
      const fallbackParsed = parseSearchInput(topic?.label || slug);
      if (!fallbackParsed.empty) {
        this.rankThenHydrate(indexDocs, fallbackParsed, pack, myGen);
        return;
      }
      if (myGen !== this.searchGen) return;
      this.loading_docs = false;
      this.docs_resultados = [];
      this.rows = [];
      return;
    }

    this.hydrateRankedHits(
      rankedAll,
      byId,
      parsed,
      pack,
      myGen,
      /* skipLexicalRerank */ true,
    );
  }

  /**
   * Index-only rank → optional topic boost → ensureLoaded top-N docs (snippets).
   */
  private rankThenHydrate(
    indexDocs: DocumentoDatos[],
    parsed: {
      empty: boolean;
      phrases: string[];
      contentTerms: string[];
      points: number[];
    },
    pack: TopicPack | null,
    myGen: number,
  ): void {
    const rankedAll: { hit: RankedUnitHit; doc: DocumentoDatos }[] = [];
    const byId = new Map<string, DocumentoDatos>();

    for (const doc of indexDocs) {
      const documentId = doc.id || doc.nombre || '';
      if (documentId) byId.set(documentId, doc);
      const hits = rankUnitsForDocument(
        {
          documentId,
          index: doc.indice,
          units: [], // body lazy — phrase bonus deferred until hydrate
        },
        parsed,
      );
      for (const hit of hits) {
        rankedAll.push({ hit, doc });
      }
    }

    rankedAll.sort(
      (a, b) =>
        b.hit.score - a.hit.score ||
        a.hit.documentId.localeCompare(b.hit.documentId) ||
        a.hit.unitIndex - b.hit.unitIndex,
    );

    // PR5: soft topic boost after lexical rank (no-op when pack empty).
    const boostIn = rankedAll.map((r) => r.hit);
    const { hits: boostedHits, boosted } = applyTopicBoostIfAny(
      boostIn,
      pack as TopicPackQueryLike | null,
      parsed.contentTerms,
    );
    if (boosted) {
      const docByKey = new Map(
        rankedAll.map((r) => [`${r.hit.documentId}:${r.hit.unitIndex}`, r.doc]),
      );
      rankedAll.length = 0;
      for (const hit of boostedHits) {
        const doc = docByKey.get(`${hit.documentId}:${hit.unitIndex}`);
        if (doc) rankedAll.push({ hit: hit as RankedUnitHit, doc });
      }
    }

    this.hydrateRankedHits(rankedAll, byId, parsed, pack, myGen, false);
  }

  /**
   * Body-hydrate unique docs among top hits; optional phrase re-rank on hydrated packs.
   */
  private hydrateRankedHits(
    rankedAll: { hit: RankedUnitHit; doc: DocumentoDatos }[],
    byId: Map<string, DocumentoDatos>,
    parsed: {
      empty: boolean;
      phrases: string[];
      contentTerms: string[];
      points: number[];
    },
    pack: TopicPack | null,
    myGen: number,
    skipLexicalRerank: boolean,
  ): void {
    const topSlice = rankedAll.slice(0, RANK_HYDRATE_HIT_CAP);
    const hydrateIds: string[] = [];
    const seen = new Set<string>();
    for (const { hit } of topSlice) {
      if (seen.has(hit.documentId)) continue;
      seen.add(hit.documentId);
      hydrateIds.push(hit.documentId);
      if (hydrateIds.length >= SNIPPET_DOC_CAP) break;
    }

    if (!hydrateIds.length) {
      if (myGen !== this.searchGen) return;
      this.loading_docs = false;
      this.docs_resultados = [];
      this.rows = [];
      return;
    }

    this.sub.add(
      this.documentosService
        .ensureLoadedMany(hydrateIds, {
          concurrency: DEFAULT_BODY_LOAD_CONCURRENCY,
          isCancelled: () => myGen !== this.searchGen,
        })
        .subscribe({
          next: (fullDocs) => {
            if (myGen !== this.searchGen) return;
            this.loading_docs = false;
            for (const d of fullDocs) {
              const id = d.id || d.nombre || '';
              if (id) byId.set(id, d);
            }

            if (skipLexicalRerank) {
              // Topic mode: keep posting scores; only refresh doc refs for snippets.
              const refreshed: { hit: RankedUnitHit; doc: DocumentoDatos }[] =
                [];
              for (const row of topSlice) {
                const doc = byId.get(row.hit.documentId) ?? row.doc;
                refreshed.push({ hit: row.hit, doc });
              }
              this.applyRankingFromHits(refreshed, parsed.contentTerms);
              return;
            }

            // Re-rank hydrated docs with bodies for phrase bonus on those packs.
            const reRanked: { hit: RankedUnitHit; doc: DocumentoDatos }[] = [];
            for (const id of hydrateIds) {
              const doc = byId.get(id);
              if (!doc) continue;
              const hits = rankUnitsForDocument(
                {
                  documentId: id,
                  index: doc.indice,
                  units: doc.documento,
                },
                parsed,
              );
              for (const hit of hits) {
                reRanked.push({ hit, doc });
              }
            }
            // Keep non-hydrated index-only hits after hydrated ones if needed.
            const hydratedSet = new Set(hydrateIds);
            for (const row of rankedAll) {
              if (!hydratedSet.has(row.hit.documentId)) {
                reRanked.push(row);
              }
            }
            reRanked.sort(
              (a, b) =>
                b.hit.score - a.hit.score ||
                a.hit.documentId.localeCompare(b.hit.documentId) ||
                a.hit.unitIndex - b.hit.unitIndex,
            );
            // Re-apply topic boost after body re-rank (scores may change).
            const boostIn = reRanked.map((r) => r.hit);
            const { hits: boostedHits } = applyTopicBoostIfAny(
              boostIn,
              pack as TopicPackQueryLike | null,
              parsed.contentTerms,
            );
            const docByKey = new Map(
              reRanked.map((r) => [
                `${r.hit.documentId}:${r.hit.unitIndex}`,
                r.doc,
              ]),
            );
            const finalRows: { hit: RankedUnitHit; doc: DocumentoDatos }[] =
              [];
            for (const hit of boostedHits) {
              const doc = docByKey.get(`${hit.documentId}:${hit.unitIndex}`);
              if (doc) finalRows.push({ hit: hit as RankedUnitHit, doc });
            }
            this.applyRankingFromHits(finalRows, parsed.contentTerms);
          },
          error: (err) => {
            if (myGen !== this.searchGen) return;
            // Degrade: show index-only rows without snippets.
            this.loading_docs = false;
            this.applyRankingFromHits(topSlice, parsed.contentTerms);
            console.warn('snippet hydrate failed; index-only results', err);
          },
        }),
    );
  }

  /** Group ranked hits into docs_resultados + flat 3E rows. */
  private applyRankingFromHits(
    rankedAll: { hit: RankedUnitHit; doc: DocumentoDatos }[],
    fallbackTerms: string[],
  ): void {
    const byDoc = new Map<DocumentoDatos, RankedUnitHit[]>();
    const docOrder: DocumentoDatos[] = [];
    for (const { hit, doc } of rankedAll) {
      if (!byDoc.has(doc)) {
        byDoc.set(doc, []);
        docOrder.push(doc);
      }
      byDoc.get(doc)!.push(hit);
    }

    this.docs_resultados = [];
    for (const doc of docOrder) {
      const hits = byDoc.get(doc) ?? [];
      const puntos_completos = hits
        .map((hit) => {
          const article = doc.documento?.[hit.unitIndex];
          if (!article) {
            // Index-only hit without body: synthetic stub for navigation.
            const stub = {
              index_array: hit.unitIndex,
              consecutivo: hit.consecutivo || String(hit.unitIndex),
              contenido: '',
            };
            const terms_pure =
              hit.highlightTerms.length > 0
                ? hit.highlightTerms
                : fallbackTerms;
            return {
              article: stub,
              terms_pure,
            } as ArticleInfo;
          }
          const terms_pure =
            hit.highlightTerms.length > 0
              ? hit.highlightTerms
              : fallbackTerms;
          return { article, terms_pure } as ArticleInfo;
        })
        .filter((x): x is ArticleInfo => !!x);

      this.docs_resultados.push({
        doc,
        puntos: puntos_completos,
        puntos_paginados: puntos_completos,
      });
    }

    this.buildRowsFromRanked(rankedAll, fallbackTerms);
  }

  /**
   * Flat 3E rows in global relatedness order (not per-document bag order).
   */
  private buildRowsFromRanked(
    rankedAll: { hit: RankedUnitHit; doc: DocumentoDatos }[],
    fallbackTerms: string[],
  ): void {
    const rows: SearchRow[] = [];
    for (const { hit, doc } of rankedAll) {
      const article = doc.documento[hit.unitIndex];
      if (!article) continue;
      const terms =
        hit.highlightTerms.length > 0 ? hit.highlightTerms : fallbackTerms;
      const punto = { article, terms_pure: terms } as ArticleInfo;
      const resultado: ResultadoDeBusqueda = {
        doc,
        puntos: [punto],
        puntos_paginados: [punto],
      };
      const docLabel = this.shortLabel(resultado);
      const unidad =
        article.biblia?.consecutivo_versiculo ||
        (article.consecutivo && article.consecutivo !== 'no-encontrado'
          ? article.consecutivo
          : String((article.index_array ?? hit.unitIndex) + 1));
      rows.push({
        title: `${docLabel} · Nº ${unidad}`,
        snippetHtml: this.buildSnippet(article.contenido ?? '', terms),
        punto,
        resultado,
      });
    }
    this.rows = rows;
    this.visibleCount = PAGE;
  }

  /** Aplana los resultados por documento en filas del diseño 3E. */
  private buildRows(): void {
    const rows: SearchRow[] = [];
    for (const resultado of this.docs_resultados) {
      const docLabel = this.shortLabel(resultado);
      for (const punto of resultado.puntos) {
        const art = punto.article;
        const unidad =
          art.biblia?.consecutivo_versiculo ||
          (art.consecutivo && art.consecutivo !== 'no-encontrado'
            ? art.consecutivo
            : String((art.index_array ?? 0) + 1));
        rows.push({
          title: `${docLabel} · Nº ${unidad}`,
          snippetHtml: this.buildSnippet(
            art.contenido ?? '',
            punto.terms_pure ?? []
          ),
          punto,
          resultado,
        });
      }
    }
    this.rows = rows;
    this.visibleCount = PAGE;
  }

  /**
   * Fragmento con término resaltado (diseño 3E). Los rangos se calculan
   * sobre el texto plano y cada tramo se escapa por separado, de modo que
   * el HTML resultante solo contiene nuestros <b class="hl">.
   */
  private buildSnippet(contenido: string, terms: string[]): string {
    const raw = contenido
      .replace(/\[\+\[\d+\]\+\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const fold = (s: string) =>
      this.utilidadesService.texto.eliminar_diacriticos(s).toLowerCase();
    const foldedRaw = fold(raw);

    let firstIdx = -1;
    let firstLen = 0;
    for (const t of terms) {
      const ft = fold(t);
      if (!ft) continue;
      const i = foldedRaw.indexOf(ft);
      if (i >= 0 && (firstIdx < 0 || i < firstIdx)) {
        firstIdx = i;
        firstLen = ft.length;
      }
    }

    let start = 0;
    let end = Math.min(raw.length, 170);
    if (firstIdx >= 0) {
      start = Math.max(0, firstIdx - 70);
      end = Math.min(raw.length, firstIdx + firstLen + 100);
    }
    const slice = raw.slice(start, end);
    const foldedSlice = foldedRaw.slice(start, end);

    type R = { s: number; e: number };
    const ranges: R[] = [];
    for (const t of terms) {
      const ft = fold(t);
      if (!ft) continue;
      let from = 0;
      while (from < foldedSlice.length) {
        const i = foldedSlice.indexOf(ft, from);
        if (i < 0) break;
        ranges.push({ s: i, e: i + ft.length });
        from = i + ft.length;
      }
    }
    ranges.sort((a, b) => a.s - b.s || b.e - a.e);
    const merged: R[] = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r.s < last.e) {
        last.e = Math.max(last.e, r.e);
      } else {
        merged.push({ ...r });
      }
    }

    let html = '';
    let cursor = 0;
    for (const r of merged) {
      html += this.escapeHtml(slice.slice(cursor, r.s));
      html += '<b class="hl">' + this.escapeHtml(slice.slice(r.s, r.e)) + '</b>';
      cursor = r.e;
    }
    html += this.escapeHtml(slice.slice(cursor));

    const pre = start > 0 ? '…' : '';
    const post = end < raw.length ? '…' : '';
    return `${pre}${html}${post}`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  buscar_por_valor_una_llave(
    valor: number,
    objeto: { [key: number]: number | null }
  ) {
    for (const llave in objeto) {
      const llave_num = parseInt(llave, 10);
      if (objeto.hasOwnProperty(llave_num) && objeto[llave_num] === valor)
        return llave_num;
    }
    return undefined;
  }
}

export interface ResultadoDeBusqueda {
  doc: DocumentoDatos;
  puntos: ArticleInfo[];
  puntos_paginados: ArticleInfo[];
}
