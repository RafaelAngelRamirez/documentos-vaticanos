import { TestBed } from '@angular/core/testing';

import { DarkReaderService } from './dark-reader.service';

describe('DarkReaderService', () => {
  let service: DarkReaderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DarkReaderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
