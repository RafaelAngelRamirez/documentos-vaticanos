import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  PersonFichaComponent,
  PersonWorkLink,
} from 'src/app/components/person-ficha/person-ficha.component';
import { Doctor, doctorById } from 'src/app/data/doctores';

/** Ficha de un Doctor de la Iglesia (patrón 2D como Padres). */
@Component({
  standalone: true,
  selector: 'app-doctor-detalle',
  imports: [CommonModule, RouterModule, PersonFichaComponent],
  templateUrl: './doctor-detalle.component.html',
  styleUrls: ['./doctor-detalle.component.css'],
})
export class DoctorDetalleComponent implements OnInit {
  doctor: Doctor | null = null;
  works: PersonWorkLink[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
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
}
