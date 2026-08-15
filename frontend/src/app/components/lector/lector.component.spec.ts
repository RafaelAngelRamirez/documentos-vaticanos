import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { of, Subject } from 'rxjs';
import { LectorComponent } from './lector.component';
import { CargarDocumentosJsonService } from 'src/app/services/cargar-documentos-json.service';
import { NavigationService } from 'src/app/services/navigation.service';
import { NarratorService } from 'src/app/services/narrator.service';
import { NarratorPreferencesService } from 'src/app/services/narrator-preferences.service';
import { ReaderPreferencesService } from 'src/app/services/reader-preferences.service';

describe('LectorComponent', () => {
  let component: LectorComponent;
  let fixture: ComponentFixture<LectorComponent>;
  let listVoices: jasmine.Spy;
  const fallbackNotice = new Subject<string>();

  beforeEach(() => {
    listVoices = jasmine.createSpy('listVoices').and.resolveTo([]);
    TestBed.configureTestingModule({
      imports: [LectorComponent, RouterTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { url: of([]), snapshot: { queryParamMap: { get: () => null } } },
        },
        {
          provide: CargarDocumentosJsonService,
          useValue: { documentos_disponibles: [] },
        },
        {
          provide: NavigationService,
          useValue: {
            consumeAutoNarr: () => false,
            document_selected: undefined,
            actual_index: 0,
            article_selected: undefined,
            save_actual_index: () => {},
            goToCover: () => {},
            go_to_documents: () => {},
          },
        },
        {
          provide: NarratorService,
          useValue: {
            supported: true,
            isPaused: false,
            fallbackNotice$: fallbackNotice.asObservable(),
            listVoices,
            pause: () => true,
            resume: () => true,
            cancel: () => Promise.resolve(),
            speak: () => Promise.resolve(true),
          },
        },
        {
          provide: NarratorPreferencesService,
          useValue: {
            narrRate: 1,
            voiceId: null,
            snapshot: { readCitationPrefix: false },
            setNarrRate: () => {},
            setVoiceId: () => {},
            update: () => {},
          },
        },
        {
          provide: ReaderPreferencesService,
          useValue: {
            prefs: { theme: 'mono', font: 'serif', fontSizePx: 18 },
            update: () => {},
          },
        },
      ],
    });
    fixture = TestBed.createComponent(LectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('resumes from narrIndex, not visibleIndex', () => {
    component.narrIndex = 7;
    component.actual_index = 2;
    component.narrPlaying = false;
    spyOn(component, 'startNarratorFrom').and.resolveTo();
    component.toggleNarrator();
    expect(component.startNarratorFrom).toHaveBeenCalledWith(7);
  });

  it('asks listVoices for the pack locale', async () => {
    component.document = {
      nombre: 'dv-zh',
      locale: 'zh',
      documento: [],
      indice: { indice: {}, indice_por_punto: {} },
    };
    await component.loadNarrVoices();
    expect(listVoices).toHaveBeenCalledWith('zh');
  });

  it('keeps nfill and percent on the same index while narrating', () => {
    component.document = {
      nombre: 'x',
      documento: new Array(20).fill(0).map((_, i) => ({
        index_array: i,
        consecutivo: String(i + 1),
        contenido: 'texto',
      })),
      indice: { indice: {}, indice_por_punto: {} },
    };
    component.narrPlaying = true;
    component.narrIndex = 9;
    component.actual_index = 3;
    expect(component.percent).toBe(component.narrProgressPct);
    expect(component.percent).toBe(50);
  });
});
