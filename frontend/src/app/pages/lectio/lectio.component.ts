import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { BnavComponent } from 'src/app/components/bnav/bnav.component';
import { PasajeComponent } from 'src/app/components/pasaje/pasaje.component';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import { Article } from 'src/app/core/corpus/corpus.models';
import { CorpusService } from 'src/app/core/corpus/corpus.service';
import { UiI18nService } from 'src/app/core/i18n/ui-i18n.service';
import {
  LectioDay,
  buildLectioDay,
} from 'src/app/core/lectio/lectio-day.logic';
import { LECTIO_STEPS } from 'src/app/core/lectio/lectio-steps';
import { PalabraDelDiaService } from 'src/app/core/lectio/palabra-del-dia.service';
import { CitedVerse } from 'src/app/core/liturgia/bible-cite.logic';
import { resolveCitedPassageFromCite } from 'src/app/core/reading/resolve-cited-passage.logic';
import { LecturaItem } from 'src/app/core/liturgia/lecturas-del-dia.logic';
import {
  calendarSaintLabel,
  saintsOfDay,
} from 'src/app/core/santoral/santoral-calendar.logic';
import { SaintRecord } from 'src/app/core/santoral/santoral-resolve.logic';
import { SantoralService } from 'src/app/core/santoral/santoral.service';
import { ReaderPreferencesService } from 'src/app/services/reader-preferences.service';
import { NavigationService } from 'src/app/services/navigation.service';
import { NarratorService } from 'src/app/services/narrator.service';
import { speechLangForDocumentLocale } from 'src/app/services/speech-lang.logic';

@Component({
  standalone: true,
  selector: 'app-lectio',
  imports: [
    CommonModule,
    RouterModule,
    AppFbarComponent,
    BnavComponent,
    PasajeComponent,
    WbarComponent,
  ],
  templateUrl: './lectio.component.html',
  styleUrls: ['./lectio.component.css'],
})
export class LectioComponent implements OnInit, OnDestroy {
  readonly steps = LECTIO_STEPS;
  day: LectioDay = buildLectioDay({});
  pasajeVerses: CitedVerse[] = [];
  pasajeCite = '';
  bibleDocId = '';
  opening = false;
  localeTick = 0;
  private pasajeSpeech = '';
  private pasajeToken = 0;
  private sub = new Subscription();

  constructor(
    public i18n: UiI18nService,
    private readonly corpus: CorpusService,
    private readonly santoral: SantoralService,
    private readonly palabra: PalabraDelDiaService,
    private readonly readerPrefs: ReaderPreferencesService,
    private readonly navigation: NavigationService,
    private readonly narrator: NarratorService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.i18n.locale$.subscribe(() => {
        this.localeTick++;
      }),
    );
    this.rebuild();
    this.sub.add(
      this.santoral.loadManifest().subscribe({
        next: (m) => {
          const saints = saintsOfDay(m.saints || [], new Date()).map((s) => ({
            id: s.id,
            name: calendarSaintLabel(s as SaintRecord),
          }));
          this.rebuild(saints);
        },
        error: () => undefined,
      }),
    );
    this.sub.add(
      this.corpus.loadManifest().subscribe({
        next: () => {
          const preferred = this.readerPrefs.resolveContentLocale();
          const bible =
            this.corpus
              .listDocuments()
              .find(
                (d) =>
                  d.kind === 'bible' &&
                  (d.locale || '').toLowerCase() === preferred,
              ) ||
            this.corpus
              .listDocuments()
              .find((d) => d.id.startsWith('bible-pueblo-de-dios-'));
          if (bible?.id) {
            this.bibleDocId = bible.id;
            this.showPassage(this.day.gospel?.cite || '', false);
          }
        },
      }),
    );
    void this.refreshPalabra();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    void this.narrator.cancel();
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  /** Cited verses only. Stays on /lectio; does not open the bible document. */
  openGospel(autoNarr = false): void {
    const gospel = this.day.gospel;
    if (!gospel || this.opening) return;
    if (
      !autoNarr &&
      this.pasajeCite === gospel.cite &&
      this.pasajeVerses.length &&
      this.pasajeSpeech.trim()
    ) {
      this.focusPassage();
      return;
    }
    this.showPassage(gospel.cite, autoNarr, true);
  }

  /** Speaks the passage on screen: the gospel, or the reading just chosen. */
  listenPassage(): void {
    if (this.opening) return;
    if (!this.pasajeSpeech.trim()) {
      this.openGospel(true);
      return;
    }
    void this.speakPassage();
  }

  openReading(r: LecturaItem): void {
    if (!r?.cite || this.opening) return;
    this.showPassage(r.cite, false, true);
  }

  async listenReflection(): Promise<void> {
    const text = (this.day.reflectionText || '').trim();
    if (!text) return;
    await this.narrator.cancel();
    const locale =
      this.corpus.getMeta(this.bibleDocId)?.locale ||
      this.readerPrefs.resolveContentLocale();
    const plan = await this.narrator.planUtterance(
      speechLangForDocumentLocale(locale),
    );
    await this.narrator.speak(text, plan);
  }

  openMethod(): void {
    const docId = this.day.methodDoc.documentId;
    this.sub.add(
      this.corpus.ensureLoaded(docId).subscribe({
        next: (doc) => {
          const units = doc.documento || [];
          const idx = units.findIndex(
            (u) => String(u.consecutivo) === this.day.methodDoc.consecutivo,
          );
          this.navigation.openReading(docId, {
            unitIndex: idx >= 0 ? idx : 0,
          });
        },
        error: () => {
          void this.router.navigate(['/documento', docId]);
        },
      }),
    );
  }

  private rebuild(
    saints: { id: string; name: string }[] = this.day.saints,
  ): void {
    this.day = buildLectioDay({
      now: new Date(),
      saints,
      palabra: this.palabra.loadCached(),
    });
  }

  private async refreshPalabra(): Promise<void> {
    const loc = this.readerPrefs.resolveContentLocale();
    const row = await this.palabra.refresh(loc, this.day.dateIso);
    if (row) {
      this.day = buildLectioDay({
        now: new Date(),
        saints: this.day.saints,
        palabra: row,
      });
    }
  }

  /**
   * Show only the verses the citation names (shared resolver).
   * The full bible stays closed: a jump must not pull in the verses between.
   */
  private showPassage(cite: string, speak: boolean, focus = false): void {
    this.pasajeCite = cite;
    this.pasajeVerses = [];
    this.pasajeSpeech = '';
    if (!cite || !this.bibleDocId) return;
    const token = ++this.pasajeToken;
    this.opening = true;
    this.sub.add(
      this.corpus
        .ensureForCitedPassage(this.bibleDocId, { citeLabel: cite })
        .subscribe({
        next: (doc) => {
          if (token !== this.pasajeToken) return;
          this.opening = false;
          const units = (doc.documento || []) as Article[];
          const resolved = resolveCitedPassageFromCite(
            this.bibleDocId,
            cite,
            units,
          );
          this.pasajeVerses = resolved?.verses ?? [];
          this.pasajeSpeech = resolved?.speechText ?? '';
          if (focus) this.focusPassage();
          if (speak) void this.speakPassage();
        },
        error: () => {
          if (token !== this.pasajeToken) return;
          this.opening = false;
          this.pasajeVerses = [];
          this.pasajeSpeech = '';
        },
      }),
    );
  }

  private focusPassage(): void {
    setTimeout(() => {
      document
        .querySelector('[data-testid="lectio-gospel-excerpt"]')
        ?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }

  private async speakPassage(): Promise<void> {
    const text = this.pasajeSpeech.trim();
    if (!text) return;
    await this.narrator.cancel();
    const locale =
      this.corpus.getMeta(this.bibleDocId)?.locale ||
      this.readerPrefs.resolveContentLocale();
    const plan = await this.narrator.planUtterance(
      speechLangForDocumentLocale(locale),
    );
    await this.narrator.speak(text, plan);
  }
}
