import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BuscadorComponent } from './buscador.component';
import { CargarDocumentosJsonService } from 'src/app/services/cargar-documentos-json.service';

describe('BuscadorComponent', () => {
  let component: BuscadorComponent;
  let fixture: ComponentFixture<BuscadorComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BuscadorComponent, RouterTestingModule],
      providers: [
        {
          provide: CargarDocumentosJsonService,
          useValue: { documentos_disponibles: [] },
        },
      ],
    });
    fixture = TestBed.createComponent(BuscadorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
