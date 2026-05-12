import { TestBed } from '@angular/core/testing';

import { CommandPaletteService } from './command-palette.service';

describe('CommandPaletteService', () => {
  let service: CommandPaletteService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CommandPaletteService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
