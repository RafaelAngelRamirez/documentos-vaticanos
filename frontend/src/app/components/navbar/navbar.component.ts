import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DarkReaderService } from 'src/app/services/dark-reader.service';
import { BuscadorService } from '../buscador/buscador.service';
import { Subscription, debounceTime } from 'rxjs';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit {
  control_buscador = new FormControl<string>('');

  form = new FormGroup({
    buscador: this.control_buscador,
  });

  subscripciones: Subscription[] = [];

  constructor(private buscadorService: BuscadorService) {}

  ngOnInit(): void {
    let s = this.control_buscador.valueChanges
      .pipe(debounceTime(1000))
      .subscribe((v) => {
        this.buscadorService.buscar(v);
      });
    this.subscripciones.push(s);
  }
}
