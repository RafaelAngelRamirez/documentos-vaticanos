import { Injectable } from '@angular/core';
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
  setLastRead(entry: LastReadInput): void {
    setLastReadInStore(localStorage, entry);
  }

  getLastRead(): LastRead | null {
    return getLastReadFromStore(localStorage);
  }

  /** 0–100 progress estimate from unit index. */
  percent(entry: LastRead | null | undefined): number {
    return lastReadPercent(entry);
  }
}
