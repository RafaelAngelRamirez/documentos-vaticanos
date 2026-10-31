import { Injectable } from '@angular/core';
import { SyncJournalService } from '../core/sync/sync-journal.service';
import {
  LastRead,
  LastReadInput,
  getLastReadFromStore,
  lastReadPercent,
  setLastReadInStore,
} from './reading-progress.logic';

export type { LastRead } from './reading-progress.logic';

@Injectable({ providedIn: 'root' })
export class ReadingProgressService {
  constructor(private journal: SyncJournalService) {}

  setLastRead(entry: LastReadInput): void {
    const full = setLastReadInStore(localStorage, entry);
    this.journal.recordLectura(full);
  }

  getLastRead(): LastRead | null {
    return getLastReadFromStore(localStorage);
  }

  /** 0–100 progress estimate from unit index. */
  percent(entry: LastRead | null | undefined): number {
    return lastReadPercent(entry);
  }
}
