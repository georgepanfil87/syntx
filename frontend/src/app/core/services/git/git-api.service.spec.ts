import { TestBed } from '@angular/core/testing';

import { GitApiService } from './git-api.service';

describe('GitApiService', () => {
  let service: GitApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GitApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
