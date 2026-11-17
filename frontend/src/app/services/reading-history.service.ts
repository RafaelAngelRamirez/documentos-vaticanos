import { Injectable } from '@angular/core';
import {
  ReadingHistoryEntry,
  ReadingHistoryInput,
  clearReadingHistory,
  readReadingHistory,
  recordReadingInStore,
} from '../core/reading/cite';

export type { ReadingHistoryEntry } from '../core/reading/cite';

/** Device history. No network and no corpus writes. */
@Injectable({ providedIn: 'root' })
export class ReadingHistoryService {
  list(): ReadingHistoryEntry[] {
    if (typeof localStorage === 'undefined') return [];
    return readReadingHistory(localStorage);
  }

  record(input: ReadingHistoryInput): ReadingHistoryEntry[] {
    if (typeof localStorage === 'undefined') return [];
    return recordReadingInStore(localStorage, input);
  }

  clear(): void {
    if (typeof localStorage === 'undefined') return;
    clearReadingHistory(localStorage);
  }
}
