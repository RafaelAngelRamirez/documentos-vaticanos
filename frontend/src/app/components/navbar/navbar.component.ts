import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DarkReaderService } from 'src/app/services/dark-reader.service';
import { BuscadorService } from '../buscador/buscador.service';
import { Subscription, debounceTime } from 'rxjs';
import { NavigationService } from 'src/app/services/navigation.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit {
  navigate_to_beginning() {
    this.navigationService.go_to_search();
  }
  control_buscador = new FormControl<string>('');

  form = new FormGroup({
    buscador: this.control_buscador,
  });

  subscripciones: Subscription[] = [];

  constructor(
    private buscadorService: BuscadorService,
    private navigationService: NavigationService
  ) {}

  ngOnInit(): void {
    let s = this.control_buscador.valueChanges
      .pipe(debounceTime(1000))
      .subscribe((v) => {
        this.buscadorService.buscar(v);
        this.navigationService.go_to_search();
      });
    this.subscripciones.push(s);
  }
}
