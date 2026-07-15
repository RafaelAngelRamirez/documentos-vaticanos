import { Component, OnInit } from '@angular/core';
import { DownloadsService } from '../../core/downloads/downloads.service';

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
    version: '',
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
      this.links = links;
    });
  }
}
