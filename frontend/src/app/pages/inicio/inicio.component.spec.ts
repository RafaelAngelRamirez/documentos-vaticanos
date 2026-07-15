import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import {
  InicioComponent,
  formatVersionLabel,
  isWebDownloadShell,
} from './inicio.component';
import { AppUpdateService } from 'src/app/core/downloads/app-update.service';
import { DownloadsService } from 'src/app/core/downloads/downloads.service';
import { STABLE_DOWNLOAD_PATHS } from 'src/app/core/downloads/downloads.models';

const STUB_LINKS = {
  apk: STABLE_DOWNLOAD_PATHS.apk,
  linux: STABLE_DOWNLOAD_PATHS.linux,
  windows: STABLE_DOWNLOAD_PATHS.windows,
  version: '1.2.3',
};

describe('isWebDownloadShell', () => {
  it('is true only for pure web (not native, not electron)', () => {
    expect(isWebDownloadShell(false, false)).toBe(true);
    expect(isWebDownloadShell(true, false)).toBe(false);
    expect(isWebDownloadShell(false, true)).toBe(false);
    expect(isWebDownloadShell(true, true)).toBe(false);
  });
});

describe('formatVersionLabel', () => {
  it('prefixes semver with v', () => {
    expect(formatVersionLabel('0.0.13')).toBe('v0.0.13');
    expect(formatVersionLabel('v1.2.3')).toBe('v1.2.3');
  });
});

describe('InicioComponent', () => {
  let component: InicioComponent;
  let fixture: ComponentFixture<InicioComponent>;
  let downloadsStub: { getLinks: jasmine.Spy };

  beforeEach(async () => {
    downloadsStub = {
      getLinks: jasmine
        .createSpy('getLinks')
        .and.returnValue(of({ ...STUB_LINKS })),
    };
    const appUpdateStub = {
      availableUpdate$: of(null),
      openDownload: jasmine.createSpy('openDownload'),
      dismiss: jasmine.createSpy('dismiss'),
      checkForUpdate: jasmine.createSpy('checkForUpdate'),
    };

    await TestBed.configureTestingModule({
      imports: [InicioComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: DownloadsService, useValue: downloadsStub },
        { provide: AppUpdateService, useValue: appUpdateStub },
      ],
    }).compileComponents();
  });

  /**
   * Creates the real component; only the platform gate is forced so we can
   * assert web vs native DOM. DownloadsService is stubbed at the HTTP boundary
   * only (returns fixed links); template + ngOnInit run for real.
   */
  function createWithShell(webShell: boolean): void {
    fixture = TestBed.createComponent(InicioComponent);
    component = fixture.componentInstance;
    spyOn(component, 'resolveShowDownloads').and.returnValue(webShell);
    fixture.detectChanges();
  }

  it('should create', () => {
    createWithShell(true);
    expect(component).toBeTruthy();
  });

  it('on web shows three download anchors with resolved hrefs and version label', () => {
    createWithShell(true);
    const el: HTMLElement = fixture.nativeElement;

    expect(downloadsStub.getLinks).toHaveBeenCalled();
    expect(component.showDownloads).toBe(true);
    expect(el.querySelector('[data-testid="inicio-downloads"]')).toBeTruthy();

    const android = el.querySelector(
      '[data-testid="inicio-dl-android"]'
    ) as HTMLAnchorElement;
    const windows = el.querySelector(
      '[data-testid="inicio-dl-windows"]'
    ) as HTMLAnchorElement;
    const linux = el.querySelector(
      '[data-testid="inicio-dl-linux"]'
    ) as HTMLAnchorElement;

    expect(android).toBeTruthy();
    expect(windows).toBeTruthy();
    expect(linux).toBeTruthy();
    expect(android.getAttribute('href')).toBe(STUB_LINKS.apk);
    expect(windows.getAttribute('href')).toBe(STUB_LINKS.windows);
    expect(linux.getAttribute('href')).toBe(STUB_LINKS.linux);
    expect(android.getAttribute('aria-label')).toMatch(/Android/i);
    expect(windows.getAttribute('aria-label')).toMatch(/Windows/i);
    expect(linux.getAttribute('aria-label')).toMatch(/Linux/i);

    const ver = el.querySelector('[data-testid="inicio-version"]');
    expect(ver).toBeTruthy();
    expect(ver!.textContent!.trim()).toBe('v1.2.3');
    expect(component.versionLabel).toBe('v1.2.3');
  });

  it('on native shell hides download controls while still showing version', () => {
    createWithShell(false);
    const el: HTMLElement = fixture.nativeElement;

    expect(component.showDownloads).toBe(false);
    expect(el.querySelector('[data-testid="inicio-downloads"]')).toBeNull();
    expect(el.querySelector('[data-testid="inicio-dl-android"]')).toBeNull();
    expect(el.querySelector('[data-testid="inicio-dl-windows"]')).toBeNull();
    expect(el.querySelector('[data-testid="inicio-dl-linux"]')).toBeNull();

    const ver = el.querySelector('[data-testid="inicio-version"]');
    expect(ver).toBeTruthy();
    expect(ver!.textContent!.trim()).toBe('v1.2.3');
  });
});
