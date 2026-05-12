import { TestBed } from '@angular/core/testing';

import { ProjectExportImportService } from './project-export-import.service';

describe('ProjectExportImportService', () => {
  let service: ProjectExportImportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProjectExportImportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
