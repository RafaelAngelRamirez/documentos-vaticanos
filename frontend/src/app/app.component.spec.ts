import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AppComponent } from './app.component';
import { SafeAreaService } from './core/shell/safe-area.service';
import { ReaderPreferencesService } from './services/reader-preferences.service';

describe('AppComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [AppComponent],
      providers: [
        { provide: SafeAreaService, useValue: { init() {} } },
        { provide: ReaderPreferencesService, useValue: { applyToDom() {} } },
      ],
    })
  );

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
