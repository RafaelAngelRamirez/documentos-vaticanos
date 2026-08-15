import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AboutComponent } from './about.component';
import { NarratorPreferencesService } from 'src/app/services/narrator-preferences.service';

describe('AboutComponent', () => {
  let component: AboutComponent;
  let fixture: ComponentFixture<AboutComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AboutComponent],
      imports: [CommonModule],
      providers: [
        {
          provide: NarratorPreferencesService,
          useValue: {
            snapshot: { readCitationPrefix: true, grokEnabled: false },
            xaiApiKey: null,
            update: () => {},
            toggleGrokEnabled: () => {},
            setXaiApiKey: () => {},
            clearXaiApiKey: () => {},
          },
        },
      ],
    });
    fixture = TestBed.createComponent(AboutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
