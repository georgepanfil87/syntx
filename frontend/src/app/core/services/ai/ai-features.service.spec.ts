import { TestBed } from '@angular/core/testing';

import { AiFeaturesService } from './ai-features.service';

describe('AiFeaturesService', () => {
  let service: AiFeaturesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AiFeaturesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
