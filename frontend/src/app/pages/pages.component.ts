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
  /**
   * Immersive reading shell (matches design): home, library, full-text search, reader.
   * No global navbar — each view owns its topbar.
   */
  isImmersiveRoute = false;

  /** Secondary product chrome (cuenta, estudios, about). */
  showAppChrome = false;

  private sub = new Subscription();

  constructor(
    private router: Router,
    private readerPrefs: ReaderPreferencesService
  ) {}

  ngOnInit(): void {
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

    const isHome = path === `/${ROUTE.inicio}` || path === '/' || path === '';
    const isLib =
      path === `/${ROUTE.list_documents}` ||
      path.startsWith(`/${ROUTE.list_documents}`);
    const isFullTextSearch = path === '/buscar' || path.startsWith('/buscar/');

    this.isImmersiveRoute = isReader || isHome || isLib || isFullTextSearch;
    this.showAppChrome = !this.isImmersiveRoute;
    this.setReaderMode(isReader || isHome || isLib || isFullTextSearch);
  }

  private setReaderMode(on: boolean): void {
    if (typeof document === 'undefined') {
      return;
    }
    // Apply reading tokens / bg on immersive routes (sepia shell).
    document.body.classList.toggle('reader-mode', on);
    document.body.classList.toggle('dv-immersive', on);
  }
}
