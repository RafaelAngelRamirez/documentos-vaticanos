import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { LectorComponent } from './lector.component';
import { NavigationService } from 'src/app/services/navigation.service';

describe('LectorComponent', () => {
  let component: LectorComponent;
  let fixture: ComponentFixture<LectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LectorComponent, HttpClientTestingModule, RouterTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(LectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('Index opens a sheet instead of going back to the document cover', () => {
    component.document = {
      id: 'esortazione-ap-20160319-amoris-laetitia-en',
      nombre: 'Amoris laetitia',
      documento: [],
      indice: { indice: {}, indice_por_punto: {} },
      partial: false,
    };
    component.chapters = [
      { num: 'I', title: 'The light of the Gospel', unitIndex: 17 },
    ];
    const nav = TestBed.inject(NavigationService);
    const goBack = spyOn(nav, 'goBack').and.returnValue(false);
    const canGoBack = spyOn(nav, 'canGoBack').and.returnValue(false);
    const navigate = spyOn(TestBed.inject(Router), 'navigate');

    component.toggleIndex();

    expect(component.indexOpen).toBeTrue();
    expect(goBack).not.toHaveBeenCalled();
    expect(canGoBack).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('selecting an index row jumps with openReading and closes the sheet', () => {
    component.document = {
      id: 'esortazione-ap-20160319-amoris-laetitia-en',
      nombre: 'Amoris laetitia',
      documento: [],
      indice: { indice: {}, indice_por_punto: {} },
    };
    component.indexOpen = true;
    const entry = {
      num: 'I',
      title: 'The light of the Gospel',
      unitIndex: 17,
    };
    component.chapters = [entry];
    const openReading = spyOn(
      TestBed.inject(NavigationService),
      'openReading',
    );

    component.onSelectIndex(entry);

    expect(component.indexOpen).toBeFalse();
    expect(openReading).toHaveBeenCalledWith(
      'esortazione-ap-20160319-amoris-laetitia-en',
      { unitIndex: 17, stack: 'keep' },
    );
  });
});
