import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface StudyStep {
  id?: string;
  order: number;
  documentId: string;
  unitIndex: number;
  unitLabel?: string | null;
  teacherNote?: string | null;
}

export interface StudyTeacher {
  id: string;
  name: string;
  email: string;
  pictureUrl?: string | null;
}

export interface Study {
  id: string;
  teacherId: string;
  title: string;
  description?: string | null;
  coverImageKey?: string | null;
  coverImageUrl?: string | null;
  status: string;
  publishedAt?: string | null;
  steps: StudyStep[];
  teacher?: StudyTeacher;
  _count?: { enrollments: number };
}

export interface Enrollment {
  id: string;
  studyId: string;
  studentId: string;
  status: string;
  study?: Study;
  student?: StudyTeacher;
}

@Injectable({ providedIn: 'root' })
export class StudiesService {
  constructor(private http: HttpClient) {}

  private get base(): string {
    return environment.apiBaseUrl;
  }

  /** Absolute URL for cover images served by API. */
  coverUrl(study: Study): string | null {
    if (study.coverImageUrl) {
      if (study.coverImageUrl.startsWith('http')) return study.coverImageUrl;
      const origin = this.base.replace(/\/api\/v1\/?$/, '');
      return `${origin}${study.coverImageUrl}`;
    }
    if (study.coverImageKey) {
      const origin = this.base.replace(/\/api\/v1\/?$/, '');
      return `${origin}/uploads/${study.coverImageKey}`;
    }
    return null;
  }

  listPublished(): Observable<Study[]> {
    return this.http
      .get<{ items: Study[] }>(`${this.base}/studies`)
      .pipe(map((r) => r.items));
  }

  get(id: string): Observable<Study> {
    return this.http
      .get<{ item: Study }>(`${this.base}/studies/${id}`)
      .pipe(map((r) => r.item));
  }

  listMine(): Observable<Study[]> {
    return this.http
      .get<{ items: Study[] }>(`${this.base}/me/studies`)
      .pipe(map((r) => r.items));
  }

  create(input: {
    title: string;
    description?: string;
    coverImageKey?: string;
  }): Observable<Study> {
    return this.http
      .post<{ item: Study }>(`${this.base}/studies`, input)
      .pipe(map((r) => r.item));
  }

  update(
    id: string,
    input: Partial<{ title: string; description: string; coverImageKey: string }>
  ): Observable<Study> {
    return this.http
      .patch<{ item: Study }>(`${this.base}/studies/${id}`, input)
      .pipe(map((r) => r.item));
  }

  setSteps(
    id: string,
    steps: Array<{
      documentId: string;
      unitIndex: number;
      unitLabel?: string;
      teacherNote?: string;
    }>
  ): Observable<Study> {
    return this.http
      .put<{ item: Study }>(`${this.base}/studies/${id}/steps`, { steps })
      .pipe(map((r) => r.item));
  }

  publish(id: string): Observable<Study> {
    return this.http
      .post<{ item: Study }>(`${this.base}/studies/${id}/publish`, {})
      .pipe(map((r) => r.item));
  }

  archive(id: string): Observable<Study> {
    return this.http
      .post<{ item: Study }>(`${this.base}/studies/${id}/archive`, {})
      .pipe(map((r) => r.item));
  }

  remove(id: string): Observable<void> {
    return this.http
      .delete(`${this.base}/studies/${id}`)
      .pipe(map(() => undefined));
  }

  enroll(id: string): Observable<Enrollment> {
    return this.http
      .post<{ enrollment: Enrollment }>(`${this.base}/studies/${id}/enroll`, {})
      .pipe(map((r) => r.enrollment));
  }

  myEnrollments(): Observable<Enrollment[]> {
    return this.http
      .get<{ items: Enrollment[] }>(`${this.base}/me/enrollments`)
      .pipe(map((r) => r.items));
  }

  students(studyId: string): Observable<Enrollment[]> {
    return this.http
      .get<{ items: Enrollment[] }>(`${this.base}/studies/${studyId}/students`)
      .pipe(map((r) => r.items));
  }

  uploadImage(file: File): Observable<{
    key: string;
    url: string;
    width: number;
    height: number;
    bytes: number;
  }> {
    const fd = new FormData();
    fd.append('image', file);
    return this.http.post<{
      key: string;
      url: string;
      width: number;
      height: number;
      bytes: number;
    }>(`${this.base}/uploads/image`, fd);
  }
}
