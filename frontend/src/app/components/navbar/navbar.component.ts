import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BuscadorService } from '../buscador/buscador.service';
import { Subscription, debounceTime } from 'rxjs';
import { NavigationService } from 'src/app/services/navigation.service';
import {
  ReaderPreferences,
  ReaderPreferencesService,
} from 'src/app/services/reader-preferences.service';
import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/core/auth/auth.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit, OnDestroy {
  navigate_to_beginning() {
    this.navigationService.go_to_search();
  }
  control_buscador = new FormControl<string>('');

  version = environment.version;

  form = new FormGroup({
    buscador: this.control_buscador,
  });

  prefs: ReaderPreferences = this.readerPrefs.snapshot;

  subscripciones: Subscription[] = [];

  constructor(
    private buscadorService: BuscadorService,
    public navigationService: NavigationService,
    private readerPrefs: ReaderPreferencesService,
    public auth: AuthService,
    private router: Router
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

    this.subscripciones.push(
      this.readerPrefs.prefs$.subscribe((p) => {
        this.prefs = p;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscripciones.forEach((s) => s.unsubscribe());
  }

  navigate_to_documents() {
    this.navigationService.go_to_documents();
  }

  navigate_to_about() {
    this.navigationService.go_to_about();
  }

  navigate_to_account(): void {
    this.router.navigate(['/cuenta']);
  }

  navigate_to_studies(): void {
    this.router.navigate(['/estudios']);
  }

  cycleTheme(): void {
    this.readerPrefs.cycleTheme();
  }

  themeTitle(): string {
    const t = this.prefs.theme;
    if (t === 'paper') return 'Tema: Papel (clic para cambiar)';
    if (t === 'sepia') return 'Tema: Sepia (clic para cambiar)';
    if (t === 'night') return 'Tema: Noche (clic para cambiar)';
    return 'Tema: Sistema (clic para cambiar)';
  }
}
