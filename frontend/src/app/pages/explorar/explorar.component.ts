import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { StudiesService, Study } from 'src/app/core/account/studies.service';
import {
  catalogDisplayFor,
  CatalogDisplay,
} from 'src/app/core/corpus/catalog.display';
import { CorpusService } from 'src/app/core/corpus/corpus.service';
import { environment } from 'src/environments/environment';

type Tab = 'maestros' | 'temas' | 'epocas';

interface TeacherRow {
  id: string;
  name: string;
  meta: string;
  initials: string;
  studyIds: string[];
}

interface EpochRow {
  label: string;
  meta: string;
  docIds: string[];
}

@Component({
  standalone: true,
  selector: 'app-explorar',
  imports: [CommonModule, RouterModule, AppFbarComponent],
  templateUrl: './explorar.component.html',
  styleUrls: ['./explorar.component.css'],
})
export class ExplorarComponent implements OnInit {
  tab: Tab = 'maestros';
  teachers: TeacherRow[] = [];
  topicChips = [
    'Fe y razón',
    'Familia',
    'Eucaristía',
    'Esperanza',
    'Caridad',
    'Creación',
  ];
  epochs: EpochRow[] = [];
  loading = false;

  constructor(
    private studies: StudiesService,
    private corpus: CorpusService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.buildEpochsFromCatalog();
    if (!environment.apiBaseUrl) {
      this.teachers = this.fallbackAuthors();
      return;
    }
    this.loading = true;
    this.studies.listPublished().subscribe({
      next: (items) => {
        this.loading = false;
        this.teachers = this.groupTeachers(items);
        if (!this.teachers.length) this.teachers = this.fallbackAuthors();
      },
      error: () => {
        this.loading = false;
        this.teachers = this.fallbackAuthors();
      },
    });
  }

  setTab(t: Tab): void {
    this.tab = t;
  }

  private groupTeachers(studies: Study[]): TeacherRow[] {
    const map = new Map<string, TeacherRow>();
    for (const s of studies) {
      const t = s.teacher;
      const id = t?.id || s.teacherId || 'unknown';
      const name = t?.name || 'Maestro';
      let row = map.get(id);
      if (!row) {
        row = {
          id,
          name,
          meta: '',
          initials: name
            .split(/\s+/)
            .slice(0, 2)
            .map((p) => p.charAt(0).toUpperCase())
            .join(''),
          studyIds: [],
        };
        map.set(id, row);
      }
      row.studyIds.push(s.id);
    }
    return [...map.values()].map((r) => ({
      ...r,
      meta: `${r.studyIds.length} estudio${r.studyIds.length === 1 ? '' : 's'} publicado${r.studyIds.length === 1 ? '' : 's'}`,
    }));
  }

  private fallbackAuthors(): TeacherRow[] {
    const authors = new Map<string, { count: number; display: CatalogDisplay }>();
    for (const m of this.corpus.listDocuments()) {
      const d = catalogDisplayFor(m.id, m.kind);
      const key = d.autor || d.tipo;
      const prev = authors.get(key) || { count: 0, display: d };
      prev.count += 1;
      authors.set(key, prev);
    }
    return [...authors.entries()].map(([name, v]) => ({
      id: name,
      name,
      meta: `${v.count} documento${v.count === 1 ? '' : 's'} en el corpus`,
      initials: name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p.charAt(0).toUpperCase())
        .join(''),
      studyIds: [],
    }));
  }

  private buildEpochsFromCatalog(): void {
    this.corpus.loadManifest().subscribe(() => {
      const buckets: Record<string, string[]> = {
        'Concilio Vaticano II': [],
        Catecismo: [],
        Escritura: [],
        'Otros': [],
      };
      for (const m of this.corpus.listDocuments()) {
        const d = catalogDisplayFor(m.id, m.kind);
        if (d.tipo.includes('Vaticano')) buckets['Concilio Vaticano II'].push(m.id);
        else if (d.tipo.includes('Catecismo')) buckets['Catecismo'].push(m.id);
        else if (d.tipo.includes('Escritura')) buckets['Escritura'].push(m.id);
        else buckets['Otros'].push(m.id);
      }
      this.epochs = Object.entries(buckets)
        .filter(([, ids]) => ids.length)
        .map(([label, docIds]) => ({
          label,
          meta: `${docIds.length} documento${docIds.length === 1 ? '' : 's'}`,
          docIds,
        }));
    });
  }

  openTeacher(t: TeacherRow): void {
    if (t.studyIds[0]) {
      this.router.navigate(['/estudios', t.studyIds[0]]);
    } else {
      this.router.navigate(['/biblioteca']);
    }
  }

  openEpoch(e: EpochRow): void {
    if (e.docIds[0]) {
      this.router.navigate(['/leyendo', e.docIds[0], 'punto', 0]);
    }
  }

  chip(c: string): void {
    this.router.navigate(['/buscar'], { queryParams: { q: c } });
  }
}
