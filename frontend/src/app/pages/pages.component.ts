import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { ReaderPreferencesService } from '../services/reader-preferences.service';
import { ROUTE } from '../services/navigation.service';
import { BnavSection } from '../components/bnav/bnav.component';

@Component({
  selector: 'app-pages',
  templateUrl: './pages.component.html',
  styleUrls: ['./pages.component.css'],
})
export class PagesComponent implements OnInit, OnDestroy {
  isImmersiveRoute = false;
  bnavSection: BnavSection = 'inicio';
  private sub = new Subscription();

  constructor(
    private router: Router,
    private readerPrefs: ReaderPreferencesService
  ) {}

  ngOnInit(): void {
    this.readerPrefs.applyToDom();
    this.sync(this.router.url);
    this.sub.add(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe((e) => this.sync(e.urlAfterRedirects || e.url))
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    document.body.classList.remove('reader-mode');
  }

  private sync(url: string): void {
    const path = (url || '').split('?')[0];
    this.isImmersiveRoute =
      path.includes(`/${ROUTE.leyendo}`) || path.startsWith(`/${ROUTE.leyendo}`);
    document.body.classList.toggle('reader-mode', this.isImmersiveRoute);
    if (path.includes(ROUTE.list_documents) || path.includes('/documento/')) {
      this.bnavSection = 'biblioteca';
    } else if (path.includes(ROUTE.about)) {
      this.bnavSection = 'about';
    } else {
      this.bnavSection = 'inicio';
    }
  }
}
