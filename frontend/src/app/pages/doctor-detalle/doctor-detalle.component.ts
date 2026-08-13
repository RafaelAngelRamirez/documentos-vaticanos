import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ReadingCtasComponent } from 'src/app/components/reading-cover';
import {
  PersonFichaComponent,
  PersonWorkLink,
} from 'src/app/components/person-ficha/person-ficha.component';
import { Doctor, doctorById } from 'src/app/data/doctores';
import { primaryWorkDocumentId } from 'src/app/core/person/person-reading.logic';
import { NavigationService } from 'src/app/services/navigation.service';

/** Ficha de un Doctor de la Iglesia (patrón 2D como Padres). */
@Component({
  standalone: true,
  selector: 'app-doctor-detalle',
  imports: [
    CommonModule,
    RouterModule,
    PersonFichaComponent,
    ReadingCtasComponent,
  ],
  templateUrl: './doctor-detalle.component.html',
  styleUrls: ['./doctor-detalle.component.css'],
})
export class DoctorDetalleComponent implements OnInit {
  doctor: Doctor | null = null;
  works: PersonWorkLink[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private navigation: NavigationService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.doctor = doctorById(id) || null;
    if (!this.doctor) {
      this.router.navigate(['/doctores']);
      return;
    }
    this.works = (this.doctor.works || []).map((w) => ({
      title: w.title,
      documentId: w.documentId,
      sourceUrl: w.sourceUrl,
    }));
  }

  get kindLine(): string {
    if (!this.doctor) return '';
    return `Doctor · ${this.doctor.years} · proclamado ${this.doctor.proclaimedYear}`;
  }

  get primaryWorkId(): string | null {
    return primaryWorkDocumentId(this.works);
  }

  openPrimaryWork(autoNarr = false): void {
    const id = this.primaryWorkId;
    if (!id) return;
    this.navigation.openReading(id, { unitIndex: 0, autoNarr });
  }
}
