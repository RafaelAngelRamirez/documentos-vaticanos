import { Component } from '@angular/core';
import { t } from 'src/app/core/i18n/ui-strings';
import { NarratorPreferencesService } from 'src/app/services/narrator-preferences.service';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.css'],
})
export class AboutComponent {
  t = t;
  keyDraft = '';

  constructor(public narrPrefs: NarratorPreferencesService) {}

  togglePrefix(): void {
    this.narrPrefs.update({
      readCitationPrefix: !this.narrPrefs.snapshot.readCitationPrefix,
    });
  }

  onKey(ev: Event): void {
    this.keyDraft = (ev.target as HTMLInputElement).value;
  }

  saveKey(): void {
    const raw = this.keyDraft.trim();
    if (raw) this.narrPrefs.setXaiApiKey(raw);
    this.keyDraft = '';
  }

  clearKey(): void {
    this.narrPrefs.clearXaiApiKey();
  }
}
