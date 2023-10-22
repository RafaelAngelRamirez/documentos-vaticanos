import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListDocumentsPagesComponent } from './list-documents-pages.component';

describe('ListDocumentsPagesComponent', () => {
  let component: ListDocumentsPagesComponent;
  let fixture: ComponentFixture<ListDocumentsPagesComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ListDocumentsPagesComponent]
    });
    fixture = TestBed.createComponent(ListDocumentsPagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
