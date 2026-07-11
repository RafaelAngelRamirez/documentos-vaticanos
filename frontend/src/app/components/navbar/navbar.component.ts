import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NavigationService } from 'src/app/services/navigation.service';
import {
  ReaderPreferences,
  ReaderPreferencesService,
} from 'src/app/services/reader-preferences.service';
import { AuthService } from 'src/app/core/auth/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit, OnDestroy {
  menuOpen = false;

  prefs: ReaderPreferences = this.readerPrefs.snapshot;

  private sub = new Subscription();

  closeMenu(): void {
    this.menuOpen = false;
  }

  constructor(
    public navigationService: NavigationService,
    private readerPrefs: ReaderPreferencesService,
    public auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.readerPrefs.prefs$.subscribe((p) => {
        this.prefs = p;
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  navigate_to_beginning() {
    this.navigationService.go_to_search();
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
    if (t === 'paper') return 'Tema: Claro (clic para cambiar)';
    if (t === 'sepia') return 'Tema: Sepia (clic para cambiar)';
    if (t === 'night') return 'Tema: Oscuro (clic para cambiar)';
    return 'Tema: Sistema (clic para cambiar)';
  }
}
