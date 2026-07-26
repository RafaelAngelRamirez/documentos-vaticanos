import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { BnavComponent } from 'src/app/components/bnav/bnav.component';
import {
  EraListComponent,
  EraListGroup,
  EraListItem,
} from 'src/app/components/era-list/era-list.component';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import { SaintRecord } from 'src/app/core/santoral/santoral-resolve.logic';
import { SantoralService } from 'src/app/core/santoral/santoral.service';
import { CorpusService } from 'src/app/core/corpus/corpus.service';
import { DocumentMeta } from 'src/app/core/corpus/corpus.models';
import {
  misalBlockTitle,
  misalReadCtaLabel,
  pickPrimaryMisalEntry,
} from 'src/app/core/misal/misal-liturgia.logic';
import { ReaderPreferencesService } from 'src/app/services/reader-preferences.service';
import {
  calendarSaintLabel,
  DayCell,
  daysInMonth,
  monthDayCells,
  monthLabel,
  MonthSummary,
  parseDayParam,
  parseMonthParam,
  saintsForDay,
  yearMonthSummaries,
} from 'src/app/core/santoral/santoral-calendar.logic';

export type SantoralViewMode = 'lista' | 'calendario';
export type CalendarLevel = 'anio' | 'mes' | 'dia';

/** Lista del santoral offline + modo calendario (año → mes → día). */
@Component({
  standalone: true,
  selector: 'app-santoral',
  imports: [
    CommonModule,
    RouterModule,
    AppFbarComponent,
    BnavComponent,
    WbarComponent,
    EraListComponent,
  ],
  templateUrl: './santoral.component.html',
  styleUrls: ['./santoral.component.css'],
})
export class SantoralComponent implements OnInit, OnDestroy {
  groups: { era: string; items: SaintRecord[] }[] = [];
  /** Presentational groups for app-era-list (lista mode). */
  eraListGroups: EraListGroup[] = [];
  allSaints: SaintRecord[] = [];
  loading = true;
  error: string | null = null;
  total = 0;

  /** lista | calendario */
  mode: SantoralViewMode = 'lista';
  /** Nested calendar depth */
  calLevel: CalendarLevel = 'anio';
  /** 1–12 when in mes/día */
  calMonth: number | null = null;
  /** 1–31 when in día */
  calDay: number | null = null;

  yearMonths: MonthSummary[] = [];
  monthCells: DayCell[] = [];
  daySaints: SaintRecord[] = [];

  /** Misal pack entry on calendar shell (same packs as Inicio). */
  misalPrimary: DocumentMeta | null = null;
  readonly misalBlockTitle = misalBlockTitle();

  private routeSub?: Subscription;

  constructor(
    private santoral: SantoralService,
    private corpus: CorpusService,
    private readerPrefs: ReaderPreferencesService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.queryParamMap.subscribe((q) => {
      const vista = (q.get('vista') || q.get('mode') || 'lista').toLowerCase();
      this.mode =
        vista === 'calendario' || vista === 'calendar' ? 'calendario' : 'lista';
      this.calMonth = parseMonthParam(q.get('m') || q.get('mes'));
      this.calDay = parseDayParam(q.get('d') || q.get('dia'));
      this.syncCalendarLevel();
      this.rebuildCalendarViews();
    });

    this.corpus.loadManifest().subscribe({
      next: () => {
        const preferred = this.readerPrefs.resolveContentLocale();
        this.misalPrimary = pickPrimaryMisalEntry(
          this.corpus.listDocuments(),
          preferred,
        ) as DocumentMeta | null;
        this.santoral.loadManifest().subscribe({
          next: (m) => {
            this.groups = this.santoral.groupsByEra();
            this.eraListGroups = this.groups.map((g) => ({
              era: g.era,
              items: g.items.map((s) => ({
                id: s.id,
                name: this.label(s),
                meta: this.sub(s),
                initials: this.initials(s),
              })),
            }));
            this.allSaints = m.saints || [];
            this.total = this.allSaints.length;
            this.rebuildCalendarViews();
            this.loading = false;
          },
          error: (err) => {
            this.loading = false;
            this.error = err?.message || 'No se pudo cargar el santoral.';
          },
        });
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.message || 'No se pudo cargar el catálogo.';
      },
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  private syncCalendarLevel(): void {
    if (this.mode !== 'calendario') {
      this.calLevel = 'anio';
      return;
    }
    if (this.calMonth != null && this.calDay != null) {
      const max = daysInMonth(this.calMonth);
      if (this.calDay > max) {
        this.calDay = null;
        this.calLevel = 'mes';
        return;
      }
      this.calLevel = 'dia';
    } else if (this.calMonth != null) {
      this.calLevel = 'mes';
    } else {
      this.calLevel = 'anio';
    }
  }

  private rebuildCalendarViews(): void {
    if (!this.allSaints.length) {
      this.yearMonths = yearMonthSummaries([]);
      this.monthCells = [];
      this.daySaints = [];
      return;
    }
    this.yearMonths = yearMonthSummaries(this.allSaints);
    if (this.calMonth != null) {
      this.monthCells = monthDayCells(this.allSaints, this.calMonth);
    } else {
      this.monthCells = [];
    }
    if (this.calMonth != null && this.calDay != null) {
      this.daySaints = saintsForDay(
        this.allSaints,
        this.calMonth,
        this.calDay,
      ) as SaintRecord[];
    } else {
      this.daySaints = [];
    }
  }

  setMode(mode: SantoralViewMode): void {
    if (mode === 'lista') {
      this.router.navigate(['/santoral'], { queryParams: {} });
      return;
    }
    this.router.navigate(['/santoral'], {
      queryParams: { vista: 'calendario' },
    });
  }

  openYear(): void {
    this.router.navigate(['/santoral'], {
      queryParams: { vista: 'calendario' },
    });
  }

  openMonth(month: number): void {
    const mm = String(month).padStart(2, '0');
    this.router.navigate(['/santoral'], {
      queryParams: { vista: 'calendario', m: mm },
    });
  }

  openDay(month: number, day: number): void {
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    this.router.navigate(['/santoral'], {
      queryParams: { vista: 'calendario', m: mm, d: dd },
    });
  }

  backFromCalendar(): void {
    if (this.calLevel === 'dia' && this.calMonth != null) {
      this.openMonth(this.calMonth);
      return;
    }
    if (this.calLevel === 'mes') {
      this.openYear();
      return;
    }
    this.setMode('lista');
  }

  open(s: SaintRecord): void {
    this.router.navigate(['/santoral', s.id]);
  }

  openListItem(it: EraListItem): void {
    this.router.navigate(['/santoral', it.id]);
  }

  openMisal(): void {
    if (!this.misalPrimary?.id) return;
    this.router.navigate(['/documento', this.misalPrimary.id]);
  }

  misalReadLabel(): string {
    return misalReadCtaLabel(this.misalPrimary);
  }

  label(s: SaintRecord): string {
    return calendarSaintLabel(s);
  }

  sub(s: SaintRecord): string {
    if (s.meta) return s.meta;
    const n = this.santoral.worksForSaint(s).length;
    const parts = [s.years, s.role, n ? `${n} obras` : null].filter(Boolean);
    return parts.join(' · ');
  }

  initials(s: SaintRecord): string {
    if (s.initials) return s.initials;
    const n = (s.displayName || s.name || '?').replace(
      /^(San|Santa|Santo|Beato|Beata)\s+/i,
      '',
    );
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }

  fbarTitle(): string {
    if (this.mode !== 'calendario') return 'Santoral';
    if (this.calLevel === 'dia' && this.calMonth != null && this.calDay != null) {
      return `${this.calDay} de ${monthLabel(this.calMonth)}`;
    }
    if (this.calLevel === 'mes' && this.calMonth != null) {
      return monthLabel(this.calMonth);
    }
    return 'Calendario';
  }

  /** Mobile fbar ← label; null hides back. */
  fbarBackLabel(): string | null {
    if (this.mode !== 'calendario') return null;
    if (this.calLevel === 'dia') return '← Mes';
    if (this.calLevel === 'mes') return '← Año';
    return '← Lista';
  }

  fbarBackQuery(): Record<string, string> | null {
    if (this.mode !== 'calendario') return null;
    if (this.calLevel === 'dia' && this.calMonth != null) {
      return {
        vista: 'calendario',
        m: String(this.calMonth).padStart(2, '0'),
      };
    }
    if (this.calLevel === 'mes') {
      return { vista: 'calendario' };
    }
    // año → lista (clear query)
    return null;
  }

  monthTitle(): string {
    return this.calMonth != null ? monthLabel(this.calMonth) : '';
  }

  dayTitle(): string {
    if (this.calMonth == null || this.calDay == null) return '';
    return `${this.calDay} de ${monthLabel(this.calMonth)}`;
  }
}
