import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { ReaderPreferencesService } from '../services/reader-preferences.service';
import { ROUTE } from '../services/navigation.service';

@Component({
  selector: 'app-pages',
  templateUrl: './pages.component.html',
  styleUrls: ['./pages.component.css'],
})
export class PagesComponent implements OnInit, OnDestroy {
  /** True while the active route is the offline reader (`/leyendo/...`). */
  isReaderRoute = false;

  private sub = new Subscription();

  constructor(
    private router: Router,
    private readerPrefs: ReaderPreferencesService
  ) {}

  ngOnInit(): void {
    // Ensure reader CSS vars are applied app-wide (navbar theme toggle too).
    this.readerPrefs.applyToDom();

    this.syncRoute(this.router.url);
    this.sub.add(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe((e) => this.syncRoute(e.urlAfterRedirects || e.url))
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.setReaderMode(false);
  }

  private syncRoute(url: string): void {
    const path = (url || '').split('?')[0].split('#')[0];
    const isReader =
      path === `/${ROUTE.leyendo}` ||
      path.startsWith(`/${ROUTE.leyendo}/`) ||
      path.includes(`/${ROUTE.leyendo}/`);
    this.isReaderRoute = isReader;
    this.setReaderMode(isReader);
  }

  private setReaderMode(on: boolean): void {
    if (typeof document === 'undefined') {
      return;
    }
    document.body.classList.toggle('reader-mode', on);
  }
}
