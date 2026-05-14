import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ENVIRONMENT } from '../../config/environment';
import { Project } from '../../models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectExportImportService {
  private readonly http = inject(HttpClient);

  export(projectId: string): Observable<Blob> {
    return this.http.get(`${ENVIRONMENT.apiBaseUrl}/projects/${projectId}/export`, {
      responseType: 'blob',
    });
  }

  import(archive: File): Observable<Project> {
    const form = new FormData();
    form.append('archive', archive, archive.name);
    return this.http.post<Project>(`${ENVIRONMENT.apiBaseUrl}/projects/import`, form);
  }
}
