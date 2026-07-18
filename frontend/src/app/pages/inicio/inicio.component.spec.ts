import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import {
  InicioComponent,
  formatVersionLabel,
  isWebDownloadShell,
  resolveAppVersionLabel,
} from './inicio.component';
import { AppUpdateService } from 'src/app/core/downloads/app-update.service';
import { DownloadsService } from 'src/app/core/downloads/downloads.service';
import { STABLE_DOWNLOAD_PATHS } from 'src/app/core/downloads/downloads.models';
import { SantoralService } from 'src/app/core/santoral/santoral.service';
import { environment } from 'src/environments/environment';

/** Stale downloads-stub version — must NOT pin the home-screen label. */
const STALE_MANIFEST_VERSION = '0.0.13';

const STUB_LINKS = {
  apk: STABLE_DOWNLOAD_PATHS.apk,
  linux: STABLE_DOWNLOAD_PATHS.linux,
  windows: STABLE_DOWNLOAD_PATHS.windows,
  version: STALE_MANIFEST_VERSION,
};

const EXPECTED_BUILD_LABEL = resolveAppVersionLabel(environment.version);

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

describe('resolveAppVersionLabel', () => {
  it('uses build-embedded version even when downloads stub is older', () => {
    expect(resolveAppVersionLabel('0.0.16', '0.0.13')).toBe('v0.0.16');
    expect(resolveAppVersionLabel(environment.version, STALE_MANIFEST_VERSION)).toBe(
      EXPECTED_BUILD_LABEL
    );
  });

  it('falls back to manifest only when build version is missing', () => {
    expect(resolveAppVersionLabel('', '1.2.3')).toBe('v1.2.3');
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
    const santoralStub = {
      loadManifest: jasmine.createSpy('loadManifest').and.returnValue(
        of({
          version: '1',
          saints: [
            {
              id: 'fixture-saint',
              name: 'Fixture',
              feastDays: ['01-01'],
              bio: 'Bio de prueba del pack offline.',
            },
          ],
        }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [InicioComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: DownloadsService, useValue: downloadsStub },
        { provide: AppUpdateService, useValue: appUpdateStub },
        { provide: SantoralService, useValue: santoralStub },
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
    // Build version, not the stale downloads-stub version from getLinks.
    expect(ver!.textContent!.trim()).toBe(EXPECTED_BUILD_LABEL);
    expect(component.versionLabel).toBe(EXPECTED_BUILD_LABEL);
    expect(component.versionLabel).not.toBe(`v${STALE_MANIFEST_VERSION}`);
  });

  it('on native shell hides download controls while still showing build version', () => {
    createWithShell(false);
    const el: HTMLElement = fixture.nativeElement;

    expect(component.showDownloads).toBe(false);
    expect(el.querySelector('[data-testid="inicio-downloads"]')).toBeNull();
    expect(el.querySelector('[data-testid="inicio-dl-android"]')).toBeNull();
    expect(el.querySelector('[data-testid="inicio-dl-windows"]')).toBeNull();
    expect(el.querySelector('[data-testid="inicio-dl-linux"]')).toBeNull();

    const ver = el.querySelector('[data-testid="inicio-version"]');
    expect(ver).toBeTruthy();
    // Regression: APK must not show lagging assets/downloads manifest version.
    expect(ver!.textContent!.trim()).toBe(EXPECTED_BUILD_LABEL);
    expect(component.versionLabel).toBe(EXPECTED_BUILD_LABEL);
    expect(component.links.version).toBe(environment.version);
  });
});
