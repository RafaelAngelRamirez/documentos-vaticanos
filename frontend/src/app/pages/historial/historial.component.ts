import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { BnavComponent } from 'src/app/components/bnav/bnav.component';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import { UiI18nService } from 'src/app/core/i18n/ui-i18n.service';
import { NavigationService } from 'src/app/services/navigation.service';
import {
  ReadingHistoryEntry,
  ReadingHistoryService,
} from 'src/app/services/reading-history.service';

/** Lecturas de este dispositivo, la más reciente primero. */
@Component({
  standalone: true,
  selector: 'app-historial',
  imports: [CommonModule, AppFbarComponent, BnavComponent, WbarComponent],
  templateUrl: './historial.component.html',
  styleUrls: ['./historial.component.css'],
})
export class HistorialComponent implements OnInit, OnDestroy {
  entries: ReadingHistoryEntry[] = [];
  localeTick = 0;
  private sub = new Subscription();

  constructor(
    public i18n: UiI18nService,
    private history: ReadingHistoryService,
    private navigation: NavigationService,
  ) {}

  ngOnInit(): void {
    this.entries = this.history.list();
    this.sub.add(
      this.i18n.locale$.subscribe(() => {
        this.localeTick++;
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  t(key: string, params?: Record<string, string | number>): string {
    void this.localeTick;
    return this.i18n.t(key, params);
  }

  line(entry: ReadingHistoryEntry): string {
    const place = entry.label
      ? entry.label
      : this.t('history.unit', { n: entry.unitIndex + 1 });
    const when = this.when(entry);
    return when ? `${place} · ${when}` : place;
  }

  open(entry: ReadingHistoryEntry): void {
    this.navigation.openReading(entry.documentId, {
      unitIndex: entry.unitIndex,
      stack: 'clear',
    });
  }

  clear(): void {
    this.history.clear();
    this.entries = [];
  }

  private when(entry: ReadingHistoryEntry): string {
    const date = new Date(entry.updatedAt);
    if (Number.isNaN(date.getTime())) return '';
    try {
      return new Intl.DateTimeFormat(this.i18n.locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    } catch {
      return entry.updatedAt;
    }
  }
}
