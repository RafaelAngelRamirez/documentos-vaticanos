import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { ListDocumentsPagesComponent } from './list-documents-pages.component';

describe('ListDocumentsPagesComponent', () => {
  let component: ListDocumentsPagesComponent;
  let fixture: ComponentFixture<ListDocumentsPagesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListDocumentsPagesComponent, HttpClientTestingModule, RouterTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(ListDocumentsPagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
