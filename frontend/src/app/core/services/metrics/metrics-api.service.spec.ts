import { TestBed } from '@angular/core/testing';

import { MetricsApiService } from './metrics-api.service';

describe('MetricsApiService', () => {
  let service: MetricsApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MetricsApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
