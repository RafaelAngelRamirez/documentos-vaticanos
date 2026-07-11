import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { CargarDocumentosJsonService } from './cargar-documentos-json.service';

describe('CargarDocumentosJsonService', () => {
  let service: CargarDocumentosJsonService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(CargarDocumentosJsonService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
