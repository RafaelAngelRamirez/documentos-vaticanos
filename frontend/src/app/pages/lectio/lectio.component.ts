import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { BnavComponent } from 'src/app/components/bnav/bnav.component';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import { Article } from 'src/app/core/corpus/corpus.models';
import { CorpusService } from 'src/app/core/corpus/corpus.service';
import { UiI18nService } from 'src/app/core/i18n/ui-i18n.service';
import {
  LectioDay,
  buildLectioDay,
  snippet,
  stripHtmlLite,
} from 'src/app/core/lectio/lectio-day.logic';
import { LECTIO_STEPS } from 'src/app/core/lectio/lectio-steps';
import { PalabraDelDiaService } from 'src/app/core/lectio/palabra-del-dia.service';
import {
  findBibleUnitIndex,
  parseLectionaryCite,
} from 'src/app/core/liturgia/bible-cite.logic';
import { LecturaItem } from 'src/app/core/liturgia/lecturas-del-dia.logic';
import {
  calendarSaintLabel,
  saintsOfDay,
} from 'src/app/core/santoral/santoral-calendar.logic';
import { SaintRecord } from 'src/app/core/santoral/santoral-resolve.logic';
import { SantoralService } from 'src/app/core/santoral/santoral.service';
import { ReaderPreferencesService } from 'src/app/services/reader-preferences.service';
import { NavigationService } from 'src/app/services/navigation.service';

@Component({
  standalone: true,
  selector: 'app-lectio',
  imports: [
    CommonModule,
    RouterModule,
    AppFbarComponent,
    BnavComponent,
    WbarComponent,
  ],
  templateUrl: './lectio.component.html',
  styleUrls: ['./lectio.component.css'],
})
export class LectioComponent implements OnInit, OnDestroy {
  readonly steps = LECTIO_STEPS;
  day: LectioDay = buildLectioDay({});
  gospelExcerpt = '';
  bibleDocId = '';
  opening = false;
  localeTick = 0;
  private sub = new Subscription();

  constructor(
    public i18n: UiI18nService,
    private readonly corpus: CorpusService,
    private readonly santoral: SantoralService,
    private readonly palabra: PalabraDelDiaService,
    private readonly readerPrefs: ReaderPreferencesService,
    private readonly navigation: NavigationService,
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
            this.loadGospelExcerpt();
          }
        },
      }),
    );
    void this.refreshPalabra();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  openGospel(autoNarr = false): void {
    const gospel = this.day.gospel;
    if (!gospel || !this.bibleDocId || this.opening) return;
    const parsed = parseLectionaryCite(gospel.cite);
    if (!parsed) {
      void this.router.navigate(['/documento', this.bibleDocId]);
      return;
    }
    this.opening = true;
    this.sub.add(
      this.corpus.ensureLoaded(this.bibleDocId).subscribe({
        next: (doc) => {
          this.opening = false;
          const units = (doc.documento || []) as Article[];
          const idx = findBibleUnitIndex(units, parsed);
          if (idx == null) {
            void this.router.navigate(['/documento', this.bibleDocId]);
            return;
          }
          this.navigation.openReading(this.bibleDocId, {
            unitIndex: idx,
            autoNarr,
          });
        },
        error: () => {
          this.opening = false;
          void this.router.navigate(['/documento', this.bibleDocId]);
        },
      }),
    );
  }

  openReading(r: LecturaItem): void {
    this.day = { ...this.day, gospel: r.role === 'gospel' ? r : this.day.gospel };
    if (r.role === 'gospel') {
      this.openGospel(false);
      return;
    }
    if (!this.bibleDocId) return;
    const parsed = parseLectionaryCite(r.cite);
    if (!parsed) {
      void this.router.navigate(['/documento', this.bibleDocId]);
      return;
    }
    this.sub.add(
      this.corpus.ensureLoaded(this.bibleDocId).subscribe({
        next: (doc) => {
          const units = (doc.documento || []) as Article[];
          const idx = findBibleUnitIndex(units, parsed);
          if (idx == null) {
            void this.router.navigate(['/documento', this.bibleDocId]);
            return;
          }
          this.navigation.openReading(this.bibleDocId, { unitIndex: idx });
        },
      }),
    );
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

  private loadGospelExcerpt(): void {
    const gospel = this.day.gospel;
    if (!gospel || !this.bibleDocId) return;
    const parsed = parseLectionaryCite(gospel.cite);
    if (!parsed) return;
    this.sub.add(
      this.corpus.ensureLoaded(this.bibleDocId).subscribe({
        next: (doc) => {
          const units = (doc.documento || []) as Article[];
          const idx = findBibleUnitIndex(units, parsed);
          if (idx == null) return;
          this.gospelExcerpt = snippet(
            stripHtmlLite(units[idx]?.contenido || ''),
            480,
          );
        },
      }),
    );
  }
}
