import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PuntoResaltadoTerminosComponent } from './punto-resaltado-terminos.component';

describe('PuntoResaltadoTerminosComponent', () => {
  let component: PuntoResaltadoTerminosComponent;
  let fixture: ComponentFixture<PuntoResaltadoTerminosComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PuntoResaltadoTerminosComponent]
    });
    fixture = TestBed.createComponent(PuntoResaltadoTerminosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
