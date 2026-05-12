import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api/api.service';


export type ChangeKind = 'added' | 'modified' | 'deleted';

export interface StatusFile {
  path: string;
  change: ChangeKind;
}

export interface StatusResponse {
  branch: string;
  commits: number;
  last_commit_at: string | null;
  changed: StatusFile[];
}

export interface CommitRef {
  id: string;
  message: string;
  file_count: number;
  author_id: string | null;
  created_at: string;
}

export interface SnapshotFileMeta {
  path: string;
  size_bytes: number;
}

export interface CommitDetail extends CommitRef {
  files: SnapshotFileMeta[];
}

export interface CommitListResponse {
  items: CommitRef[];
}

export interface DiffResponse {
  path: string;
  before: string;
  after: string;
}

@Injectable({ providedIn: 'root' })
export class GitApi {
  private readonly api = inject(ApiService);

  status(projectId: string): Observable<StatusResponse> {
    return this.api.get<StatusResponse>(`/projects/${projectId}/git/status`);
  }

  log(projectId: string, limit = 50): Observable<CommitListResponse> {
    return this.api.get<CommitListResponse>(
      `/projects/${projectId}/git/log`,
      { limit },
    );
  }

  commit(projectId: string, message: string): Observable<CommitRef> {
    return this.api.post<CommitRef, { message: string }>(
      `/projects/${projectId}/git/commit`,
      { message },
    );
  }

  detail(projectId: string, commitId: string): Observable<CommitDetail> {
    return this.api.get<CommitDetail>(
      `/projects/${projectId}/git/commits/${commitId}`,
    );
  }

  diff(projectId: string, commitId: string, path: string): Observable<DiffResponse> {
    return this.api.get<DiffResponse>(
      `/projects/${projectId}/git/diff`,
      { commit_id: commitId, path },
    );
  }
}
