import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PuntoComponent } from './punto.component';

describe('PuntoComponent', () => {
  let component: PuntoComponent;
  let fixture: ComponentFixture<PuntoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PuntoComponent],
      imports: [CommonModule],
    }).compileComponents();

    fixture = TestBed.createComponent(PuntoComponent);
    component = fixture.componentInstance;
    component.infoPunto = {
      article: {
        index_array: 0,
        consecutivo: '1',
        contenido: 'El Verbo se hizo carne.',
      },
      terms_pure: [],
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
