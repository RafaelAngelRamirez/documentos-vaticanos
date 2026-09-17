import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { DownloadsService } from '../../core/downloads/downloads.service';
import { UiI18nService } from '../../core/i18n/ui-i18n.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.css']
})
export class AboutComponent implements OnInit, OnDestroy {
  localeTick = 0;
  private sub = new Subscription();
  links: {
    apk: string;
    linux: string;
    windows: string;
    version: string;
  } = {
    apk: '/downloads/documentos-vaticanos.apk',
    linux: '/downloads/documentos-vaticanos-linux.AppImage',
    windows: '/downloads/documentos-vaticanos-windows.exe',
    // Build-embedded version (same source as Inicio); not the downloads stub.
    version: environment.version || '',
  };

  get windowsDownloadName(): string {
    const href = this.links.windows || '';
    if (href.endsWith('.zip')) {
      return 'documentos-vaticanos-windows.zip';
    }
    return 'documentos-vaticanos-windows.exe';
  }

  constructor(
    public i18n: UiI18nService,
    private readonly downloads: DownloadsService,
  ) {}

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  ngOnInit(): void {
    this.sub.add(
      this.i18n.locale$.subscribe(() => {
        this.localeTick++;
      }),
    );
    this.downloads.getLinks().subscribe((links) => {
      this.links = {
        ...links,
        version: environment.version || links.version || '',
      };
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
