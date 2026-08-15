import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { AUTO_NARR_KEY, NavigationService, ROUTE } from './navigation.service';
import { IndiceDocumentos } from './cargar-documentos-json.service';

describe('NavigationService', () => {
  let service: NavigationService;
  let router: Router;

  const doc = {
    nombre: 'Catecismo',
    title: 'Catecismo de la Iglesia Católica',
    documento: [],
    indice: { indice: {}, indice_por_punto: {} },
  } as IndiceDocumentos;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
    });
    service = TestBed.inject(NavigationService);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    try {
      sessionStorage.removeItem(AUTO_NARR_KEY);
    } catch {
      /* ignore */
    }
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('openReading navigates to the reader and can flag autoNarr', () => {
    service.openReading(doc, { unitIndex: 3, autoNarr: true });
    expect(service.actual_index).toBe(3);
    expect(sessionStorage.getItem(AUTO_NARR_KEY)).toBe('1');
    expect(router.navigate).toHaveBeenCalledWith([
      ROUTE.leyendo,
      'Catecismo',
      ROUTE.punto,
      3,
    ]);
  });

  it('goToCover opens /documento/:id, not the reader', () => {
    service.goToCover('Catecismo');
    expect(router.navigate).toHaveBeenCalledWith(['/', ROUTE.documento, 'Catecismo']);
  });

  it('ignores a stale undefined localStorage payload', () => {
    localStorage.setItem('document_selected', 'undefined');
    const again = new NavigationService(router);
    expect(again.document_selected).toBeUndefined();
  });
});
