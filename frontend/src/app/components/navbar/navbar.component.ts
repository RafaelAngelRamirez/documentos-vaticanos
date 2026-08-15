import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, debounceTime, filter } from 'rxjs';
import { BuscadorService } from '../buscador/buscador.service';
import { NavigationService, ROUTE } from 'src/app/services/navigation.service';
import { environment } from 'src/environments/environment';
import { t } from 'src/app/core/i18n/ui-strings';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit, OnDestroy {
  @Input() title = t('app.name');
  control_buscador = new FormControl<string>('');
  version = environment.version;
  active: 'inicio' | 'biblioteca' | 'about' | null = null;
  t = t;
  private subs = new Subscription();

  constructor(
    private buscadorService: BuscadorService,
    public navigationService: NavigationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.buscadorService.global_control_search_input = this.control_buscador;
    this.subs.add(
      this.control_buscador.valueChanges.pipe(debounceTime(400)).subscribe((v) => {
        this.buscadorService.buscar(v);
        this.navigationService.go_to_search();
      })
    );
    this.sync(this.router.url);
    this.subs.add(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe((e) => this.sync(e.urlAfterRedirects || e.url))
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private sync(url: string): void {
    if (url.includes(ROUTE.list_documents) || url.includes('/documento/')) {
      this.active = 'biblioteca';
      this.title = t('library.title');
    } else if (url.includes(ROUTE.about)) {
      this.active = 'about';
      this.title = t('about.title');
    } else {
      this.active = 'inicio';
      this.title = t('app.name');
    }
  }

  navigate_to_beginning(): void {
    this.navigationService.go_to_search();
  }
  navigate_to_documents(): void {
    this.navigationService.go_to_documents();
  }
  navigate_to_about(): void {
    this.navigationService.go_to_about();
  }
}
