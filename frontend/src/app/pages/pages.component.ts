import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { ReaderPreferencesService } from '../services/reader-preferences.service';
import { isImmersivePath } from './immersive-route.logic';

@Component({
  selector: 'app-pages',
  templateUrl: './pages.component.html',
  styleUrls: ['./pages.component.css'],
})
export class PagesComponent implements OnInit, OnDestroy {
  /** Home, library, reader, full-text search — no outer chrome. */
  isImmersiveRoute = false;

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
    document.body.classList.remove('reader-mode', 'dv-immersive');
  }

  private syncRoute(url: string): void {
    this.isImmersiveRoute = isImmersivePath(url);
    document.body.classList.toggle('reader-mode', this.isImmersiveRoute);
  }
}
