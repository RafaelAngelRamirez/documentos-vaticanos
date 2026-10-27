import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  REVIEW_STORAGE_KEY,
  parseReviewStore,
  pressReviewButton,
} from 'src/app/core/review/review-queue.logic';
import type {
  ReviewButton,
  ReviewScheduleMap,
} from 'src/app/core/review/review-queue.logic';
import type { ReviewSchedule } from 'src/app/core/review/review-schedule.logic';

/**
 * Horario local del repaso. La ficha sigue siendo la nota o el marcador;
 * aquí solo vive el intervalo.
 */
@Injectable({ providedIn: 'root' })
export class ReviewQueueService {
  private subject = new BehaviorSubject<ReviewScheduleMap>(this.load());

  get snapshot(): ReviewScheduleMap {
    return this.subject.value;
  }

  press(markId: string, button: ReviewButton, today: string): ReviewSchedule {
    const { map, schedule } = pressReviewButton(
      this.subject.value,
      markId,
      button,
      today,
    );
    this.persist(map);
    return schedule;
  }

  private persist(map: ReviewScheduleMap): void {
    this.subject.next(map);
    try {
      localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // Sin almacenamiento (SSR o cuota): el horario queda en memoria.
    }
  }

  private load(): ReviewScheduleMap {
    try {
      const raw =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem(REVIEW_STORAGE_KEY)
          : null;
      return parseReviewStore(raw);
    } catch {
      return {};
    }
  }
}
