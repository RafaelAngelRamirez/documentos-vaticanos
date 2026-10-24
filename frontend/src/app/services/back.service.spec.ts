import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { BackService } from './back.service';
import { NavigationService } from './navigation.service';

describe('BackService', () => {
  let service: BackService;
  let routerStub: {
    url: string;
    navigateByUrl: jasmine.Spy;
    events: Subject<unknown>;
  };
  let navStub: {
    canGoBack: jasmine.Spy;
    goBack: jasmine.Spy;
  };

  beforeEach(() => {
    routerStub = {
      url: '/inicio',
      navigateByUrl: jasmine.createSpy('navigateByUrl'),
      events: new Subject<unknown>(),
    };
    navStub = {
      canGoBack: jasmine.createSpy('canGoBack').and.returnValue(false),
      goBack: jasmine.createSpy('goBack').and.returnValue(false),
    };

    TestBed.configureTestingModule({
      providers: [
        BackService,
        { provide: Router, useValue: routerStub },
        { provide: NavigationService, useValue: navStub },
      ],
    });
    service = TestBed.inject(BackService);
  });

  afterEach(() => {
    document.querySelectorAll('.dv-toast').forEach((n) => n.remove());
  });

  describe('parentUrl (jerarquía 7A)', () => {
    it('lector → ficha del documento', () => {
      expect(service.parentUrl('/leyendo/abc/punto/12')).toBe(
        '/documento/abc'
      );
      expect(service.parentUrl('/leyendo/abc')).toBe('/documento/abc');
    });

    it('documento → biblioteca → inicio', () => {
      expect(service.parentUrl('/documento/abc')).toBe('/biblioteca');
      expect(service.parentUrl('/biblioteca')).toBe('/inicio');
      expect(service.parentUrl('/documentos/listar')).toBe('/inicio');
    });

    it('subrutas de cuenta y estudios', () => {
      expect(service.parentUrl('/cuenta/temas/5')).toBe('/cuenta/temas');
      expect(service.parentUrl('/cuenta/temas')).toBe('/cuenta');
      expect(service.parentUrl('/cuenta/referencias')).toBe('/cuenta');
      expect(service.parentUrl('/cuenta')).toBe('/inicio');
      expect(service.parentUrl('/estudios/9/editar')).toBe('/estudios/9');
      expect(service.parentUrl('/estudios/9')).toBe('/estudios');
      expect(service.parentUrl('/padres/agustin')).toBe('/padres');
      expect(service.parentUrl('/papas/francisco')).toBe('/papas');
      expect(service.parentUrl('/doctores/agustin-hipona')).toBe('/doctores');
      expect(service.parentUrl('/admin/revision/3')).toBe('/admin/revision');
    });

    it('raíces → inicio; inicio → null', () => {
      expect(service.parentUrl('/buscar')).toBe('/inicio');
      expect(service.parentUrl('/ajustes')).toBe('/inicio');
      expect(service.parentUrl('/inicio')).toBeNull();
    });
  });

  describe('handleBack', () => {
    it('consume primero el último handler registrado (LIFO)', () => {
      const first = jasmine.createSpy('first').and.returnValue(true);
      const second = jasmine.createSpy('second').and.returnValue(true);
      service.register(first);
      service.register(second);

      expect(service.handleBack()).toBeTrue();
      expect(second).toHaveBeenCalled();
      expect(first).not.toHaveBeenCalled();
    });

    it('un handler que no consume deja pasar al siguiente nivel', () => {
      routerStub.url = '/buscar';
      const open = jasmine.createSpy('open').and.returnValue(false);
      service.register(open);

      expect(service.handleBack()).toBeTrue();
      expect(open).toHaveBeenCalled();
      expect(routerStub.navigateByUrl).toHaveBeenCalledWith('/inicio');
    });

    it('los handlers des-registrados no se invocan', () => {
      routerStub.url = '/buscar';
      const handler = jasmine.createSpy('handler').and.returnValue(true);
      const off = service.register(handler);
      off();

      service.handleBack();
      expect(handler).not.toHaveBeenCalled();
    });

    it('en el lector usa la pila de citas antes que la jerarquía', () => {
      routerStub.url = '/leyendo/abc/punto/12';
      navStub.canGoBack.and.returnValue(true);
      navStub.goBack.and.returnValue(true);

      expect(service.handleBack()).toBeTrue();
      expect(navStub.goBack).toHaveBeenCalled();
      expect(routerStub.navigateByUrl).not.toHaveBeenCalled();
    });

    it('fuera del lector ignora la pila de citas', () => {
      routerStub.url = '/documento/abc';
      navStub.canGoBack.and.returnValue(true);

      expect(service.handleBack()).toBeTrue();
      expect(navStub.goBack).not.toHaveBeenCalled();
      expect(routerStub.navigateByUrl).toHaveBeenCalledWith('/biblioteca');
    });

    it('en inicio: primer back avisa, segundo dentro de la ventana sale', () => {
      routerStub.url = '/inicio';

      expect(service.handleBack()).toBeTrue();
      expect(document.querySelector('.dv-toast')?.textContent).toContain(
        'salir'
      );

      expect(service.handleBack()).toBeFalse();
    });
  });
});
