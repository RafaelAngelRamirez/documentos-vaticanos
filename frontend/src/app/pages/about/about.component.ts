import { Component, OnInit } from '@angular/core';
import { DownloadsService } from '../../core/downloads/downloads.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.css']
})
export class AboutComponent implements OnInit {
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

  constructor(private readonly downloads: DownloadsService) {}

  ngOnInit(): void {
    this.downloads.getLinks().subscribe((links) => {
      this.links = {
        ...links,
        version: environment.version || links.version || '',
      };
    });
  }
}
