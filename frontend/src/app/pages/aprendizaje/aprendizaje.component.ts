import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { AuthService } from 'src/app/core/auth/auth.service';
import {
  Enrollment,
  Study,
  StudyStep,
  StudiesService,
} from 'src/app/core/account/studies.service';
import { environment } from 'src/environments/environment';
import { ROUTE } from 'src/app/services/navigation.service';

const LESSON_KEY = (id: string) => `dv.lesson.${id}`;

@Component({
  standalone: true,
  selector: 'app-aprendizaje',
  imports: [CommonModule, RouterModule, AppFbarComponent],
  templateUrl: './aprendizaje.component.html',
  styleUrls: ['./aprendizaje.component.css'],
})
export class AprendizajeComponent implements OnInit {
  loading = false;
  error: string | null = null;
  study: Study | null = null;
  done = new Set<number>();

  constructor(
    public auth: AuthService,
    private studies: StudiesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.auth.isLoggedIn || !environment.apiBaseUrl) {
      return;
    }
    this.loading = true;
    this.studies.myEnrollments().subscribe({
      next: (items: Enrollment[]) => {
        this.loading = false;
        const first = items.find((e) => e.study)?.study ?? null;
        this.study = first;
        if (first) this.loadDone(first.id);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || err?.message || 'Error';
      },
    });
  }

  get steps(): StudyStep[] {
    return this.study?.steps || [];
  }

  get doneCount(): number {
    return this.steps.filter((_, i) => this.done.has(i)).length;
  }

  get total(): number {
    return this.steps.length || 12;
  }

  get pct(): number {
    if (!this.steps.length) return 0;
    return Math.round((this.doneCount / this.steps.length) * 100);
  }

  get nextIndex(): number {
    const i = this.steps.findIndex((_, idx) => !this.done.has(idx));
    return i < 0 ? 0 : i;
  }

  isDone(i: number): boolean {
    return this.done.has(i);
  }

  isNext(i: number): boolean {
    return i === this.nextIndex && !this.isDone(i);
  }

  private loadDone(studyId: string): void {
    try {
      const raw = localStorage.getItem(LESSON_KEY(studyId));
      const arr = raw ? (JSON.parse(raw) as number[]) : [];
      this.done = new Set(arr);
    } catch {
      this.done = new Set();
    }
  }

  private saveDone(): void {
    if (!this.study) return;
    localStorage.setItem(
      LESSON_KEY(this.study.id),
      JSON.stringify([...this.done])
    );
  }

  openStep(i: number): void {
    const s = this.steps[i];
    if (!s) return;
    this.done.add(i);
    this.saveDone();
    this.router.navigate([
      ROUTE.leyendo,
      s.documentId,
      ROUTE.punto,
      s.unitIndex,
    ]);
  }

  continueNext(): void {
    this.openStep(this.nextIndex);
  }

  goEstudio(): void {
    this.router.navigate(['/estudio']);
  }

  goCuenta(): void {
    this.router.navigate(['/cuenta']);
  }
}
