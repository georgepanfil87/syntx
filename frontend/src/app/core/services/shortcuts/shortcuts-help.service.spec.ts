import { TestBed } from '@angular/core/testing';

import { ShortcutsHelpService } from './shortcuts-help.service';

describe('ShortcutsHelpService', () => {
  let service: ShortcutsHelpService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ShortcutsHelpService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
