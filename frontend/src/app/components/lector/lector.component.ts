import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';
import {
  CargarDocumentosJsonService,
  IndiceDocumentos,
} from 'src/app/services/cargar-documentos-json.service';
import { NavigationService } from 'src/app/services/navigation.service';
import {
  ReaderFont,
  ReaderPreferences,
  ReaderPreferencesService,
  ReaderTheme,
} from 'src/app/services/reader-preferences.service';
import { ArticleInfo } from '../punto/punto/punto.component';
import { PuntoModule } from '../punto/punto.module';
import { CorpusService } from 'src/app/core/corpus/corpus.service';
import { ReadingProgressService } from 'src/app/services/reading-progress.service';
import { AnotacionesService } from 'src/app/services/anotaciones.service';
import { DvSheetComponent } from '../dv-sheet/dv-sheet.component';
import { WbarComponent } from '../wbar/wbar.component';

const CONTEXT_SIZE = 5;

interface ThemeOption {
  value: ReaderTheme;
  label: string;
}

/** Pantalla 2B/4A/4B · Lectura con selección de texto y notas locales. */
@Component({
  selector: 'app-lector',
  standalone: true,
  imports: [CommonModule, FormsModule, PuntoModule, DvSheetComponent, WbarComponent],
  templateUrl: './lector.component.html',
  styleUrls: ['./lector.component.css'],
})
export class LectorComponent implements OnInit, OnDestroy {
  document: IndiceDocumentos | undefined = undefined;

  actual_articles: ArticleInfo[] = [];
  actual_index = 0;
  focus_article: ArticleInfo | undefined = undefined;
  quantity_to_load = 10;

  actual_inferior_limit = 0;
  actual_superior_limit = 0;

  loading = false;
  load_error: string | null = null;

  prefsOpen = false;
  prefs: ReaderPreferences = this.readerPrefs.snapshot;

  /** Índice global (index_array) de la unidad visible — alimenta rfoot. */
  visibleIndex = 0;

  /** 4A: popover de selección. */
  selPop: { top: number; left: number } | null = null;
  selExcerpt = '';
  selUnitIndex: number | null = null;
  selFeedback: string | null = null;

  /** 4B: sheet de nueva nota. */
  notaOpen = false;
  notaText = '';

  /** 5D · Narrador (Web Speech API). */
  narrPlaying = false;
  narrRate = 1;
  private utter: SpeechSynthesisUtterance | null = null;
  private narrIndex = 0;

  /** Orden del diseño 3F. */
  readonly themeOptions: ThemeOption[] = [
    { value: 'sepia', label: 'Sepia' },
    { value: 'claro', label: 'Claro' },
    { value: 'oscuro', label: 'Oscuro' },
    { value: 'system', label: 'Sistema' },
  ];

  private sub = new Subscription();
  private io?: IntersectionObserver;
  private scrollPending = false;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private selDebounce: ReturnType<typeof setTimeout> | null = null;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly onScroll = (): void => {
    if (this.scrollPending) return;
    this.scrollPending = true;
    requestAnimationFrame(() => {
      this.scrollPending = false;
      if (this.selPop) this.selPop = null;
      this.updateVisibleUnit();
    });
  };

  private readonly onSelectionChange = (): void => {
    if (this.selDebounce) clearTimeout(this.selDebounce);
    this.selDebounce = setTimeout(() => {
      this.selDebounce = null;
      this.evaluateSelection();
    }, 220);
  };

  @ViewChild('sentinel')
  set sentinelRef(el: ElementRef<HTMLElement> | undefined) {
    this.attachObserver(el?.nativeElement);
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public navigationService: NavigationService,
    private cargarDocumentosJsonService: CargarDocumentosJsonService,
    private readerPrefs: ReaderPreferencesService,
    private corpus: CorpusService,
    private progress: ReadingProgressService,
    private anotaciones: AnotacionesService,
    private host: ElementRef<HTMLElement>
  ) {
    this.sub.add(
      combineLatest([this.route.paramMap, this.route.url]).subscribe(() => {
        this.load_data();
      })
    );
  }

  ngOnInit(): void {
    this.readerPrefs.applyToDom();
    this.sub.add(
      this.readerPrefs.prefs$.subscribe((p) => {
        this.prefs = p;
      })
    );
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', this.onScroll, { passive: true });
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('selectionchange', this.onSelectionChange);
    }
  }

  ngOnDestroy(): void {
    this.stopNarrator();
    this.sub.unsubscribe();
    this.io?.disconnect();
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.onScroll);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('selectionchange', this.onSelectionChange);
    }
    if (this.selDebounce) clearTimeout(this.selDebounce);
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistProgress(this.visibleIndex);
    }
  }

  get narrSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  get narrLabel(): string {
    const total = this.document?.documento.length ?? 0;
    if (!total) return 'Narrador';
    return `Nº ${this.unidadLabelAt(this.narrIndex)} de ${total.toLocaleString('es')}`;
  }

  get narrProgressPct(): number {
    const total = this.document?.documento.length ?? 0;
    if (!total) return 0;
    return Math.min(100, Math.round(((this.narrIndex + 1) / total) * 100));
  }

  toggleNarrator(): void {
    if (!this.narrSupported) {
      this.flashFeedback('Narración no disponible en este navegador');
      return;
    }
    if (this.narrPlaying) {
      this.pauseNarrator();
      return;
    }
    this.startNarrator();
  }

  cycleRate(): void {
    const rates = [0.75, 1, 1.25, 1.5];
    const i = rates.indexOf(this.narrRate);
    this.narrRate = rates[(i + 1) % rates.length];
    if (this.narrPlaying) {
      this.pauseNarrator();
      this.startNarrator();
    }
  }

  private startNarrator(): void {
    if (!this.narrSupported || !this.document) return;
    this.narrIndex = this.visibleIndex;
    this.speakFrom(this.narrIndex);
  }

  private speakFrom(index: number): void {
    const doc = this.document?.documento;
    if (!doc || index < 0 || index >= doc.length) {
      this.narrPlaying = false;
      return;
    }
    const unit = doc[index] as {
      texto?: string;
      text?: string;
      contenido?: string;
      html?: string;
    };
    let text = String(
      unit?.contenido || unit?.texto || unit?.text || unit?.html || ''
    ).trim();
    // Strip simple HTML / ref placeholders for speech
    text = text
      .replace(/\[\+\[\d+\]\+\]/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) {
      this.speakFrom(index + 1);
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES';
    u.rate = this.narrRate;
    u.onend = () => {
      if (!this.narrPlaying) return;
      this.narrIndex = index + 1;
      this.speakFrom(this.narrIndex);
    };
    u.onerror = () => {
      this.narrPlaying = false;
    };
    this.utter = u;
    this.narrPlaying = true;
    this.narrIndex = index;
    window.speechSynthesis.speak(u);
  }

  private pauseNarrator(): void {
    this.narrPlaying = false;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.utter = null;
  }

  private stopNarrator(): void {
    this.pauseNarrator();
  }

  get narrRateLabel(): string {
    return `${this.narrRate}×`;
  }

  get documentTitle(): string {
    return (
      this.document?.title ||
      this.document?.nombre ||
      this.meta?.title ||
      this.document?.id ||
      ''
    );
  }

  /** Título compacto para la fbar (diseño 2B). */
  get headerTitle(): string {
    return this.document?.shortTitle || this.documentTitle;
  }

  /** 5D wbar: «Laudato Si' · Capítulo…» */
  get readerChromeTitle(): string {
    const base = this.headerTitle;
    if (this.rangoLabel) return `${base} · ${this.rangoLabel}`;
    return base;
  }

  get meta() {
    const id = this.document?.id || this.navigationService.document_id;
    return id ? this.corpus.getMeta(id) : undefined;
  }

  get canLoadBefore(): boolean {
    return this.actual_inferior_limit > 0;
  }

  get canLoadNext(): boolean {
    const len = this.document?.documento.length ?? 0;
    return this.actual_superior_limit < len;
  }

  /** rhead: rango del tramo cargado, p. ej. «Nº 17–19». */
  get rangoLabel(): string {
    const arts = this.actual_articles;
    if (!arts.length) return '';
    const first = this.unidadLabelDe(arts[0]);
    const last = this.unidadLabelDe(arts[arts.length - 1]);
    return first === last ? `Nº ${first}` : `Nº ${first}–${last}`;
  }

  /** rfoot izquierda: «Nº 17 de 246». */
  get posLabel(): string {
    const total = this.document?.documento.length ?? 0;
    if (!total) return '';
    return `Nº ${this.unidadLabelAt(this.visibleIndex)} de ${total.toLocaleString(
      'es'
    )}`;
  }

  /** rfoot derecha: porcentaje estimado. */
  get percent(): number {
    const total = this.document?.documento.length ?? 0;
    if (!total) return 0;
    return Math.min(
      100,
      Math.max(0, Math.round(((this.visibleIndex + 1) / total) * 100))
    );
  }

  /** 4B: «Laudato Si' · Nº 91». */
  get notaMeta(): string {
    if (this.selUnitIndex == null) return this.headerTitle;
    return `${this.headerTitle} · Nº ${this.unidadLabelAt(this.selUnitIndex)}`;
  }

  goBack(): void {
    if (this.navigationService.canGoBack()) {
      this.navigationService.goBack();
      return;
    }
    const id = this.document?.id || this.navigationService.document_id;
    if (id) {
      this.router.navigate(['/documento', id]);
    } else {
      this.navigationService.go_to_documents();
    }
  }

  goBackFromRef(): void {
    this.navigationService.goBack();
  }

  togglePrefs(): void {
    this.prefsOpen = !this.prefsOpen;
  }

  decreaseFont(): void {
    this.readerPrefs.bumpFontSize(-1);
  }

  increaseFont(): void {
    this.readerPrefs.bumpFontSize(1);
  }

  setTheme(theme: ReaderTheme): void {
    this.readerPrefs.setTheme(theme);
  }

  setFont(font: ReaderFont): void {
    this.readerPrefs.setFont(font);
  }

  resetPrefs(): void {
    this.readerPrefs.reset();
  }

  // ------------------------------------------------------------------
  // 4A · Selección de texto
  // ------------------------------------------------------------------

  subrayar(): void {
    if (!this.saveAnnotation('subrayado')) return;
    this.flashFeedback('Subrayado guardado');
    this.dismissSelection();
  }

  abrirNota(): void {
    if (this.selUnitIndex == null || !this.selExcerpt) return;
    this.notaText = '';
    this.notaOpen = true;
    this.selPop = null;
  }

  cancelarNota(): void {
    this.notaOpen = false;
    this.dismissSelection();
  }

  /** 4B: «Solo subrayar» (true) o «Guardar nota». */
  guardarNota(soloSubrayar = false): void {
    const texto = this.notaText.trim();
    const kind = soloSubrayar || !texto ? 'subrayado' : 'nota';
    if (!this.saveAnnotation(kind, kind === 'nota' ? texto : undefined)) {
      this.notaOpen = false;
      this.dismissSelection();
      return;
    }
    this.notaOpen = false;
    this.flashFeedback(kind === 'nota' ? 'Nota guardada' : 'Subrayado guardado');
    this.dismissSelection();
  }

  async copiarSeleccion(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.selExcerpt);
      this.flashFeedback('Copiado');
    } catch {
      this.flashFeedback('No se pudo copiar');
    }
    this.dismissSelection();
  }

  async compartirSeleccion(): Promise<void> {
    const text = `«${this.selExcerpt}» — ${this.documentTitle}`;
    const nav = navigator as Navigator & {
      share?: (data: { text: string; title?: string }) => Promise<void>;
    };
    try {
      if (nav.share) {
        await nav.share({ text, title: this.documentTitle });
      } else {
        await navigator.clipboard.writeText(text);
        this.flashFeedback('Copiado para compartir');
      }
    } catch {
      // Cancelado por el usuario.
    }
    this.dismissSelection();
  }

  private evaluateSelection(): void {
    if (this.notaOpen) return;
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      this.selPop = null;
      return;
    }
    const text = sel.toString().trim();
    if (!text || text.length < 3) {
      this.selPop = null;
      return;
    }
    const range = sel.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const el = node instanceof Element ? node : node.parentElement;
    const puntoEl = el?.closest?.('[data-unit]') ?? null;
    if (!puntoEl || !this.host.nativeElement.contains(puntoEl)) {
      this.selPop = null;
      return;
    }
    const unit = Number(puntoEl.getAttribute('data-unit'));
    if (!Number.isFinite(unit)) {
      this.selPop = null;
      return;
    }
    const rect = range.getBoundingClientRect();
    const width = typeof window !== 'undefined' ? window.innerWidth : 360;
    this.selExcerpt = text.length > 280 ? `${text.slice(0, 277)}…` : text;
    this.selUnitIndex = unit;
    this.selPop = {
      top: Math.max(64, rect.top - 10),
      left: Math.min(Math.max(rect.left + rect.width / 2, 92), width - 92),
    };
  }

  private saveAnnotation(kind: 'subrayado' | 'nota', nota?: string): boolean {
    const id =
      this.document?.id ??
      this.document?.nombre ??
      this.navigationService.document_id;
    if (!id || this.selUnitIndex == null || !this.selExcerpt) return false;
    this.anotaciones.add({
      documentId: id,
      unitIndex: this.selUnitIndex,
      unitLabel: this.unidadLabelAt(this.selUnitIndex),
      excerpt: this.selExcerpt,
      nota,
      kind,
    });
    return true;
  }

  private dismissSelection(): void {
    if (typeof window !== 'undefined') {
      window.getSelection()?.removeAllRanges();
    }
    this.selPop = null;
    this.selExcerpt = '';
    this.selUnitIndex = null;
  }

  private flashFeedback(msg: string): void {
    this.selFeedback = msg;
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => {
      this.feedbackTimer = null;
      this.selFeedback = null;
    }, 1800);
  }

  // ------------------------------------------------------------------
  // Carga de documento y contexto
  // ------------------------------------------------------------------

  load_data() {
    this.actual_index = this.navigationService.actual_index;
    this.focus_article = this.navigationService.article_selected;

    const routeDoc =
      this.route.snapshot.paramMap.get('documento') ??
      this.route.snapshot.paramMap.get('id');
    const routePunto = this.route.snapshot.paramMap.get('user');

    const documentKey =
      this.navigationService.document_selected?.id ??
      this.navigationService.document_selected?.nombre ??
      this.navigationService.document_id ??
      routeDoc ??
      undefined;

    if (!documentKey) {
      this.load_error =
        'No hay documento seleccionado. Vuelve al listado o a la búsqueda.';
      this.document = undefined;
      this.actual_articles = [];
      return;
    }

    // Prefer the route document when it differs from the in-memory selection
    // (e.g. following a cross-document reference).
    const effectiveKey = routeDoc ?? documentKey;

    // If we already have the full document in memory, use it.
    if (
      this.navigationService.document_selected &&
      (this.navigationService.document_selected.id === effectiveKey ||
        this.navigationService.document_selected.nombre === effectiveKey)
    ) {
      this.document = this.navigationService.document_selected;
      this.navigationService.document_id =
        this.document.id ?? this.document.nombre;
      this.applyRoutePunto(routePunto);
      this.generate_context_for_article();
      return;
    }

    this.loading = true;
    this.load_error = null;
    this.sub.add(
      this.cargarDocumentosJsonService.ensureLoaded(effectiveKey).subscribe({
        next: (doc) => {
          this.loading = false;
          this.document = doc;
          this.navigationService.document_selected = doc;
          this.navigationService.document_id = doc.id ?? doc.nombre;
          this.applyRoutePunto(routePunto);
          this.generate_context_for_article();
        },
        error: (err) => {
          this.loading = false;
          this.load_error =
            err?.message ?? `No se pudo cargar el documento: ${effectiveKey}`;
          console.error(err);
        },
      })
    );
  }

  private applyRoutePunto(routePunto: string | null) {
    if (!this.document || routePunto == null || routePunto === '') {
      return;
    }

    // Prefer navigationService.actual_index when it already points at an article
    // consistent with the route (set by navigateToUnit / go_to_read_article).
    const navIdx = this.navigationService.actual_index;
    const atNav = this.document.documento[navIdx];
    if (atNav) {
      const matchesRoute =
        String(navIdx) === String(routePunto) ||
        atNav.consecutivo === routePunto ||
        String(atNav.index_array) === String(routePunto);
      if (matchesRoute) {
        this.actual_index = navIdx;
        // Keep focus_article only when it still refers to this unit.
        if (
          this.focus_article &&
          this.focus_article.article?.index_array !== atNav.index_array
        ) {
          this.focus_article = undefined;
        }
        return;
      }
    }

    // Prefer navigation index when focus_article already matches a loaded article.
    if (
      this.focus_article &&
      this.document.documento[this.actual_index]?.index_array ===
        this.focus_article.article?.index_array
    ) {
      return;
    }

    const asNumber = Number(routePunto);
    if (!Number.isNaN(asNumber) && String(asNumber) === String(routePunto)) {
      if (this.document.documento[asNumber]) {
        this.actual_index = asNumber;
        this.navigationService.actual_index = asNumber;
        this.focus_article = undefined;
        return;
      }
    }

    const foundIdx = this.document.documento.findIndex(
      (a) => a.consecutivo === routePunto
    );
    if (foundIdx >= 0) {
      this.actual_index = foundIdx;
      this.navigationService.actual_index = foundIdx;
      this.focus_article = undefined;
    }
  }

  /**
   * The context for the article is the n articles before and after
   * the focused index in the document.
   */
  generate_context_for_article() {
    let inferior_limit = this.actual_index - CONTEXT_SIZE;
    inferior_limit = inferior_limit < 1 ? 0 : inferior_limit;

    const document_length = this.document?.documento.length ?? 0;
    let superior_limit = this.actual_index + CONTEXT_SIZE;
    superior_limit =
      superior_limit <= document_length ? superior_limit : document_length;

    this.actual_inferior_limit = inferior_limit;
    this.actual_superior_limit = superior_limit;

    this.actual_articles = this._get_articles(
      this.actual_inferior_limit,
      this.actual_superior_limit
    );

    const actual_article_in_list = this.actual_articles.find(
      (article) => article.article.index_array === this.actual_index
    );

    if (actual_article_in_list) {
      actual_article_in_list.termns = this.focus_article?.termns;
      actual_article_in_list.terms_pure = this.focus_article?.terms_pure ?? [];
    }

    // Keep navigation service in sync for subsequent ref pushes.
    this.navigationService.actual_index = this.actual_index;
    if (this.document) {
      this.navigationService.document_id =
        this.document.id ?? this.document.nombre;
    }
    this.navigationService.save_actual_index();
    this.visibleIndex = this.actual_index;
    this.persistProgress(this.visibleIndex);
    this.maybeAutoNarr();
  }

  /** 5C → 5D: si se pidió «Escuchar con narrador», arrancar al cargar. */
  private maybeAutoNarr(): void {
    try {
      if (sessionStorage.getItem('dv.autoNarr') === '1') {
        sessionStorage.removeItem('dv.autoNarr');
        setTimeout(() => this.startNarrator(), 400);
      }
    } catch {
      // ignore
    }
  }

  load_before() {
    let new_inferior_limit = this.actual_inferior_limit - this.quantity_to_load;
    if (new_inferior_limit < 0) new_inferior_limit = 0;
    this.actual_inferior_limit = new_inferior_limit;

    this.actual_articles = this._get_articles(
      this.actual_inferior_limit,
      this.actual_superior_limit
    );
  }

  load_next() {
    let new_superior_limit = this.actual_superior_limit + this.quantity_to_load;

    const document_size = this.document?.documento.length ?? 0;

    if (new_superior_limit > document_size) new_superior_limit = document_size;
    this.actual_superior_limit = new_superior_limit;

    this.actual_articles = this._get_articles(
      this.actual_inferior_limit,
      this.actual_superior_limit
    );
  }

  /** Etiqueta de unidad para un índice global del documento. */
  private unidadLabelAt(index: number): string {
    const art = this.document?.documento[index];
    return (
      art?.biblia?.consecutivo_versiculo ||
      (art?.consecutivo && art.consecutivo !== 'no-encontrado'
        ? art.consecutivo
        : String(index + 1))
    );
  }

  private unidadLabelDe(info: ArticleInfo | undefined): string {
    const art = info?.article;
    if (!art) return '';
    return (
      art.biblia?.consecutivo_versiculo ||
      (art.consecutivo && art.consecutivo !== 'no-encontrado'
        ? art.consecutivo
        : String(art.index_array + 1))
    );
  }

  /** Carga por tramos al desplazar (diseño 2B: scroll infinito). */
  private attachObserver(el?: HTMLElement): void {
    this.io?.disconnect();
    this.io = undefined;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    this.io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && this.canLoadNext && !this.loading) {
            this.load_next();
          }
        }
      },
      { rootMargin: '600px 0px' }
    );
    this.io.observe(el);
  }

  /** Scroll-spy barato: unidad cuyo inicio queda sobre el 35 % del viewport. */
  private updateVisibleUnit(): void {
    if (!this.document) return;
    const nodes =
      this.host.nativeElement.querySelectorAll<HTMLElement>('app-punto');
    if (!nodes.length) return;
    const anchor = window.innerHeight * 0.35;
    let idx = 0;
    nodes.forEach((node, i) => {
      if (node.getBoundingClientRect().top <= anchor) idx = i;
    });
    const globalIdx = this.actual_inferior_limit + idx;
    if (globalIdx !== this.visibleIndex) {
      this.visibleIndex = globalIdx;
      this.schedulePersist();
    }
  }

  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persistProgress(this.visibleIndex);
    }, 600);
  }

  private persistProgress(unitIndex: number): void {
    if (!this.document) return;
    const id = this.document.id ?? this.document.nombre;
    if (!id) return;
    this.progress.setLastRead({
      documentId: id,
      title: this.documentTitle,
      unitIndex,
      unitCount: this.document.documento?.length ?? 0,
    });
    this.progress.saveScroll(
      id,
      typeof window !== 'undefined' ? window.scrollY : 0
    );
  }

  private _get_articles(inferior_limit = 0, superior_limit = 0) {
    let articles =
      this.document?.documento.slice(inferior_limit, superior_limit) ?? [];

    return articles.map((article) => {
      return { article, terms_pure: [] } as ArticleInfo;
    });
  }
}
