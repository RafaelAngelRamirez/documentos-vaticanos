import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { InicioComponent } from './inicio.component';
import { CargarDocumentosJsonService } from 'src/app/services/cargar-documentos-json.service';
import { NavigationService } from 'src/app/services/navigation.service';

describe('InicioComponent', () => {
  let component: InicioComponent;
  let fixture: ComponentFixture<InicioComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [InicioComponent, RouterTestingModule],
      providers: [
        {
          provide: CargarDocumentosJsonService,
          useValue: { documentos_disponibles: [] },
        },
        {
          provide: NavigationService,
          useValue: { openReading: () => {}, goToCover: () => {}, go_to_documents: () => {} },
        },
      ],
    });
    fixture = TestBed.createComponent(InicioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
