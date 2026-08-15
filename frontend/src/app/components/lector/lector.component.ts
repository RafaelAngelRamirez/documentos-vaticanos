import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { t } from 'src/app/core/i18n/ui-strings';
import {
  CargarDocumentosJsonService,
  IndiceDocumentos,
} from 'src/app/services/cargar-documentos-json.service';
import {
  AUTO_NARR_KEY,
  NavigationService,
} from 'src/app/services/navigation.service';
import {
  NarratorService,
  NarratorVoice,
  narrVoicePillLabel,
} from 'src/app/services/narrator.service';
import {
  NarratorPreferencesService,
  resolvePreferredVoice,
} from 'src/app/services/narrator-preferences.service';
import { cycleRate } from 'src/app/services/narrator-prefs.logic';
import { ReaderPreferencesService } from 'src/app/services/reader-preferences.service';
import {
  localeToBcp47,
  nextSpeakableIndex,
  prepareSpeechText,
} from 'src/app/services/speech-prep.logic';
import { ArticleInfo } from '../punto/punto/punto.component';
import { PuntoModule } from '../punto/punto.module';

const CONTEXT_SIZE = 5;

@Component({
  selector: 'app-lector',
  standalone: true,
  imports: [CommonModule, PuntoModule],
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
  loading = true;
  load_error: string | null = null;
  barsHidden = false;
  prefsOpen = false;
  narrPlaying = false;
  narrIndex = 0;
  narrVoices: NarratorVoice[] = [];
  narrVoice: NarratorVoice | null = null;
  toast: string | null = null;
  t = t;
  themeOptions = [
    { value: 'mono' as const, label: 'Mono' },
    { value: 'sepia' as const, label: 'Sepia' },
    { value: 'claro' as const, label: 'Claro' },
    { value: 'oscuro' as const, label: 'Oscuro' },
  ];

  private lastScrollY = 0;
  private scrollAccum = 0;
  private autoNarrTimer: ReturnType<typeof setTimeout> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private sub = new Subscription();

  constructor(
    route: ActivatedRoute,
    public navigationService: NavigationService,
    private cargarDocumentosJsonService: CargarDocumentosJsonService,
    private narrator: NarratorService,
    public narrPrefs: NarratorPreferencesService,
    public readerPrefs: ReaderPreferencesService
  ) {
    this.sub.add(
      route.url.subscribe(() => {
        this.load_data();
      })
    );
    this.sub.add(
      this.narrator.fallbackNotice$.subscribe((msg) => this.flash(msg))
    );
  }

  ngOnInit(): void {
    void this.loadNarrVoices();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    if (this.autoNarrTimer) clearTimeout(this.autoNarrTimer);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    void this.narrator.cancel();
  }

  get prefs() {
    return this.readerPrefs.prefs;
  }

  get narrSupported(): boolean {
    return this.narrator.supported;
  }

  get documentTitle(): string {
    return this.document?.title || this.document?.nombre || '';
  }

  get headerTitle(): string {
    return this.document?.shortTitle || this.documentTitle;
  }

  get documentLocale(): string {
    return this.document?.locale || 'es';
  }

  get posLabel(): string {
    const total = this.document?.documento.length ?? 0;
    const n = this.unidadLabelAt(this.narrPlaying ? this.narrIndex : this.actual_index);
    return `Nº ${n} de ${total.toLocaleString('es')}`;
  }

  get percent(): number {
    const total = this.document?.documento.length ?? 0;
    if (!total) return 0;
    const idx = this.narrPlaying ? this.narrIndex : this.actual_index;
    return Math.min(100, Math.round(((idx + 1) / total) * 100));
  }

  get narrProgressPct(): number {
    return this.percent;
  }

  get narrLabel(): string {
    const total = this.document?.documento.length ?? 0;
    return `Nº ${this.unidadLabelAt(this.narrIndex)} de ${total.toLocaleString('es')}`;
  }

  get narrRateLabel(): string {
    return `${this.narrPrefs.narrRate}×`;
  }

  get narrVoiceLabel(): string {
    return narrVoicePillLabel(this.narrVoice, this.narrVoices);
  }

  get canLoadBefore(): boolean {
    return this.actual_inferior_limit > 0;
  }

  get canLoadNext(): boolean {
    const size = this.document?.documento.length ?? 0;
    return this.actual_superior_limit < size;
  }

  unidadLabelAt(index: number): string {
    const art = this.document?.documento[index];
    return art?.consecutivo && art.consecutivo !== 'no-encontrado'
      ? art.consecutivo
      : String(index + 1);
  }

  load_data() {
    this.loading = true;
    this.load_error = null;
    void this.narrator.cancel();
    this.narrPlaying = false;
    const fromRoute = decodeURIComponent(
      location.pathname.split('/leyendo/')[1]?.split('/')[0] || ''
    );
    this.document =
      this.cargarDocumentosJsonService.documentos_disponibles.find(
        (d) => d.nombre === fromRoute
      ) || this.navigationService.document_selected;
    this.actual_index = this.navigationService.actual_index;
    this.narrIndex = this.actual_index;
    this.focus_article = this.navigationService.article_selected;
    if (!this.document) {
      this.load_error = 'Documento no encontrado';
      this.loading = false;
      return;
    }
    this.generate_context_for_article();
    this.loading = false;
    this.maybeAutoNarr();
  }

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
  }

  private _get_articles(inferior_limit = 0, superior_limit = 0) {
    const articles =
      this.document?.documento.slice(inferior_limit, superior_limit) ?? [];
    return articles.map((article) => {
      return { article, terms_pure: [] } as ArticleInfo;
    });
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

  goBack(): void {
    if (this.document) {
      this.navigationService.goToCover(this.document.nombre);
      return;
    }
    this.navigationService.go_to_documents();
  }

  togglePrefs(): void {
    this.prefsOpen = !this.prefsOpen;
    if (this.prefsOpen) this.barsHidden = false;
  }

  toggleCitationPrefix(): void {
    this.narrPrefs.update({
      readCitationPrefix: !this.narrPrefs.snapshot.readCitationPrefix,
    });
  }

  setTheme(value: 'mono' | 'sepia' | 'claro' | 'oscuro'): void {
    this.readerPrefs.update({ theme: value });
  }

  setFont(font: 'serif' | 'sans'): void {
    this.readerPrefs.update({ font });
  }

  decreaseFont(): void {
    this.readerPrefs.update({
      fontSizePx: Math.max(14, this.prefs.fontSizePx - 1),
    });
  }

  increaseFont(): void {
    this.readerPrefs.update({
      fontSizePx: Math.min(28, this.prefs.fontSizePx + 1),
    });
  }

  async loadNarrVoices(): Promise<void> {
    this.narrVoices = await this.narrator.listVoices(this.documentLocale);
    this.narrVoice = resolvePreferredVoice(this.narrVoices, this.narrPrefs.voiceId);
  }

  cycleRate(): void {
    const next = cycleRate(this.narrPrefs.narrRate);
    this.narrPrefs.setNarrRate(next);
    if (this.narrPlaying) {
      void this.startNarratorFrom(this.narrIndex);
    }
  }

  cycleVoice(): void {
    if (this.narrVoices.length < 2) return;
    const i = this.narrVoice
      ? this.narrVoices.findIndex((v) => v.id === this.narrVoice!.id)
      : -1;
    this.narrVoice = this.narrVoices[(i + 1) % this.narrVoices.length];
    this.narrPrefs.setVoiceId(this.narrVoice.id);
    if (this.narrPlaying) {
      void this.startNarratorFrom(this.narrIndex);
    }
  }

  toggleNarrator(): void {
    if (this.narrPlaying) {
      const paused = this.narrator.pause();
      if (paused) {
        this.narrPlaying = false;
        return;
      }
      void this.narrator.cancel();
      this.narrPlaying = false;
      return;
    }
    if (this.narrator.isPaused && this.narrator.resume()) {
      this.narrPlaying = true;
      return;
    }
    void this.startNarratorFrom(this.narrIndex);
  }

  async startNarratorFrom(index: number): Promise<void> {
    if (!this.narrSupported || !this.document) return;
    if (!this.narrVoices.length) await this.loadNarrVoices();
    const start = nextSpeakableIndex(this.document.documento, index);
    if (start < 0) {
      this.flash('Nada que narrar en este idioma');
      return;
    }
    this.narrIndex = start;
    this.ensureNarrVisible(start);
    await this.speakFrom(start);
  }

  private async speakFrom(index: number): Promise<void> {
    if (!this.document) return;
    const unit = this.document.documento[index];
    if (!unit) {
      this.narrPlaying = false;
      return;
    }
    const prep = prepareSpeechText(unit.contenido);
    if (prep.skip) {
      const next = nextSpeakableIndex(this.document.documento, index + 1);
      if (next < 0) {
        this.narrPlaying = false;
        return;
      }
      this.narrIndex = next;
      await this.speakFrom(next);
      return;
    }
    let text = prep.text;
    if (this.narrPrefs.snapshot.readCitationPrefix && this.documentLocale === 'es') {
      const n = this.unidadLabelAt(index);
      text = `Cita ${n}. Dice: ${text}`;
    }
    this.narrPlaying = true;
    this.narrIndex = index;
    const rate = Math.max(0.5, Math.min(2, this.narrPrefs.narrRate * prep.rateScale));
    const ok = await this.narrator.speak(text, {
      lang: localeToBcp47(this.documentLocale),
      rate,
      voice: this.narrVoice,
    });
    if (!ok) {
      this.narrPlaying = false;
      return;
    }
    if (!this.narrPlaying) return;
    const next = nextSpeakableIndex(this.document.documento, index + 1);
    if (next < 0) {
      this.narrPlaying = false;
      return;
    }
    this.narrIndex = next;
    this.ensureNarrVisible(next);
    await this.speakFrom(next);
  }

  ensureNarrVisible(index: number): void {
    if (index < this.actual_inferior_limit) {
      this.actual_inferior_limit = Math.max(0, index - 2);
      this.actual_articles = this._get_articles(
        this.actual_inferior_limit,
        this.actual_superior_limit
      );
    }
    if (index >= this.actual_superior_limit) {
      this.actual_superior_limit = Math.min(
        this.document?.documento.length ?? 0,
        index + 6
      );
      this.actual_articles = this._get_articles(
        this.actual_inferior_limit,
        this.actual_superior_limit
      );
    }
    this.actual_index = index;
    this.navigationService.actual_index = index;
    this.navigationService.save_actual_index();
  }

  private maybeAutoNarr(): void {
    try {
      if (sessionStorage.getItem(AUTO_NARR_KEY) === '1') {
        sessionStorage.removeItem(AUTO_NARR_KEY);
        this.autoNarrTimer = setTimeout(() => {
          void this.startNarratorFrom(this.narrIndex);
        }, 400);
      }
    } catch {
      /* ignore */
    }
  }

  private flash(msg: string): void {
    this.toast = msg;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = null), 2200);
  }

  @HostListener('window:scroll')
  onScroll(): void {
    const y = window.scrollY || 0;
    const delta = y - this.lastScrollY;
    this.lastScrollY = y;
    const uiOpen = this.prefsOpen || this.narrPlaying;
    if (uiOpen) {
      this.barsHidden = false;
      this.scrollAccum = 0;
      return;
    }
    this.scrollAccum += delta;
    if (this.scrollAccum > 24) this.barsHidden = true;
    else if (this.scrollAccum < -24) this.barsHidden = false;
  }
}
