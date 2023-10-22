import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DarkReaderService } from 'src/app/services/dark-reader.service';
import { BuscadorService } from '../buscador/buscador.service';
import { Subscription, debounceTime } from 'rxjs';
import { NavigationService } from 'src/app/services/navigation.service';
import { environment } from 'src/environments/environment';


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

  version = environment.version

  form = new FormGroup({
    buscador: this.control_buscador,
  });

  subscripciones: Subscription[] = [];

  constructor(
    private buscadorService: BuscadorService,
    public navigationService: NavigationService
  ) {}

  ngOnInit(): void {
    this.buscadorService.global_control_search_input = this.control_buscador;
    let s = this.control_buscador.valueChanges
      .pipe(debounceTime(1000))
      .subscribe((v) => {
        this.buscadorService.buscar(v);
        this.navigationService.go_to_search();
      });
    this.subscripciones.push(s);
  }

  navigate_to_documents() {
    this.navigationService.go_to_documents();
  }
}
