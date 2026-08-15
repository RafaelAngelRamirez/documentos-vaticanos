import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ListDocumentsPagesComponent } from './list-documents-pages.component';
import { CargarDocumentosJsonService } from 'src/app/services/cargar-documentos-json.service';
import { NavigationService } from 'src/app/services/navigation.service';

describe('ListDocumentsPagesComponent', () => {
  let component: ListDocumentsPagesComponent;
  let fixture: ComponentFixture<ListDocumentsPagesComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ListDocumentsPagesComponent],
      imports: [CommonModule, RouterTestingModule],
      providers: [
        {
          provide: CargarDocumentosJsonService,
          useValue: { documentos_disponibles: [] },
        },
        {
          provide: NavigationService,
          useValue: {
            goToCover: () => {},
            openReading: () => {},
            document_selected: undefined,
            actual_index: 0,
          },
        },
      ],
    });
    fixture = TestBed.createComponent(ListDocumentsPagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens the cover, not the reader', () => {
    const nav = TestBed.inject(NavigationService);
    spyOn(nav, 'goToCover');
    const doc = { nombre: 'Catecismo', documento: [] } as never;
    component.openCover({
      doc,
      kind: 'catechism',
      title: 'Catecismo de la Iglesia Católica',
      badge: null,
      kindLine: 'Catecismo',
    });
    expect(nav.goToCover).toHaveBeenCalledWith('Catecismo');
  });
});
