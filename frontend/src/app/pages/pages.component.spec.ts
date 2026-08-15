import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { PagesComponent } from './pages.component';
import { NavbarComponent } from '../components/navbar/navbar.component';
import { BnavComponent } from '../components/bnav/bnav.component';
import { ReaderPreferencesService } from '../services/reader-preferences.service';

describe('PagesComponent', () => {
  let component: PagesComponent;
  let fixture: ComponentFixture<PagesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PagesComponent],
      imports: [RouterTestingModule, NavbarComponent, BnavComponent],
      providers: [
        { provide: ReaderPreferencesService, useValue: { applyToDom() {} } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
