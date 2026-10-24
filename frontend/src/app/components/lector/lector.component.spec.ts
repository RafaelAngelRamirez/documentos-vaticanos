import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { LectorComponent } from './lector.component';

describe('LectorComponent', () => {
  let component: LectorComponent;
  let fixture: ComponentFixture<LectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LectorComponent, HttpClientTestingModule, RouterTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(LectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
