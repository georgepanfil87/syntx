import { TestBed } from '@angular/core/testing';

import { CompletionsApiService } from './completions-api.service';

describe('CompletionsApiService', () => {
  let service: CompletionsApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CompletionsApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
