import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import {
  dueReviewCards,
  nextReviewDay,
  reviewableMarks,
} from 'src/app/core/review/review-queue.logic';
import type {
  ReviewButton,
  ReviewCard,
} from 'src/app/core/review/review-queue.logic';
import {
  formatReviewEase,
  localIsoDay,
} from 'src/app/core/review/review-schedule.logic';
import {
  Anotacion,
  AnotacionesService,
} from 'src/app/services/anotaciones.service';
import { NavigationService } from 'src/app/services/navigation.service';
import { ReviewQueueService } from 'src/app/services/review-queue.service';

/** Repaso SM-2 de las notas y los marcadores de este dispositivo. */
@Component({
  standalone: true,
  selector: 'app-repaso',
  imports: [CommonModule, RouterModule, AppFbarComponent, WbarComponent],
  templateUrl: './repaso.component.html',
  styleUrls: ['./repaso.component.css'],
})
export class RepasoComponent implements OnInit, OnDestroy {
  card: ReviewCard | null = null;
  pending = 0;
  hasMarks = false;
  nextDue: string | null = null;
  lastEase: number | null = null;
  lastDue: string | null = null;
  private marks: Anotacion[] = [];
  private sub = new Subscription();

  constructor(
    private anotaciones: AnotacionesService,
    private queue: ReviewQueueService,
    private navigation: NavigationService,
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.anotaciones.anotaciones$.subscribe((list) => {
        this.marks = list;
        this.refresh();
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  easeText(ease: number): string {
    return formatReviewEase(ease);
  }

  again(): void {
    this.press('again');
  }

  good(): void {
    this.press('good');
  }

  easy(): void {
    this.press('easy');
  }

  open(): void {
    if (!this.card) return;
    this.navigation.openReading(this.card.documentId, {
      unitIndex: this.card.unitIndex,
    });
  }

  private press(button: ReviewButton): void {
    if (!this.card) return;
    const today = localIsoDay();
    const schedule = this.queue.press(this.card.id, button, today);
    this.lastEase = schedule.ease;
    this.lastDue = schedule.due;
    this.refresh();
  }

  private refresh(): void {
    const today = localIsoDay();
    const due = dueReviewCards(this.marks, this.queue.snapshot, today);
    this.hasMarks = reviewableMarks(this.marks).length > 0;
    this.pending = due.length;
    this.card = due[0] ?? null;
    this.nextDue = this.card
      ? null
      : nextReviewDay(this.marks, this.queue.snapshot, today);
  }
}
