import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import { Doctor, doctorById } from 'src/app/data/doctores';

/** Ficha de un Doctor de la Iglesia (patrón 2D como Padres). */
@Component({
  standalone: true,
  selector: 'app-doctor-detalle',
  imports: [CommonModule, RouterModule, WbarComponent],
  templateUrl: './doctor-detalle.component.html',
  styleUrls: ['./doctor-detalle.component.css'],
})
export class DoctorDetalleComponent implements OnInit {
  doctor: Doctor | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.doctor = doctorById(id) || null;
    if (!this.doctor) {
      this.router.navigate(['/doctores']);
    }
  }
}
