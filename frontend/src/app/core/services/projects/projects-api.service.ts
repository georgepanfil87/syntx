import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ProjectPage, Project, ProjectCreate, ProjectUpdate } from '../../models/project.model';
import { ApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class ProjectsApi {
  private readonly api = inject(ApiService);

  list(params: { limit?: number; offset?: number } = {}): Observable<ProjectPage> {
    return this.api.get<ProjectPage>('/projects', {
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    });
  }

  getById(id: string): Observable<Project> {
    return this.api.get<Project>(`/projects/${id}`);
  }

  create(req: ProjectCreate): Observable<Project> {
    return this.api.post<Project, ProjectCreate>('/projects', req);
  }

  update(id: string, req: ProjectUpdate): Observable<Project> {
    return this.api.patch<Project, ProjectUpdate>(`/projects/${id}`, req);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/projects/${id}`);
  }
}
