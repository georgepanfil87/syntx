import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { FileTree, FileRead, FileUpsert } from '../../models/file.model';
import { ApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class FilesApi {
  private readonly api = inject(ApiService);

  tree(projectId: string): Observable<FileTree> {
    return this.api.get<FileTree>(`/projects/${projectId}/tree`);
  }

  read(projectId: string, path: string): Observable<FileRead> {
    return this.api.get<FileRead>(`/projects/${projectId}/files/${encodePath(path)}`);
  }

  upsert(projectId: string, path: string, body: FileUpsert): Observable<FileRead> {
    return this.api.put<FileRead, FileUpsert>(
      `/projects/${projectId}/files/${encodePath(path)}`,
      body,
    );
  }

  delete(projectId: string, path: string): Observable<void> {
    return this.api.delete<void>(`/projects/${projectId}/files/${encodePath(path)}`);
  }
}

/** Encodes per-segment so `/` stays literal but `#`, `?`, spaces escape. */
function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}
