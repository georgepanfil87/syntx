export interface Project {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  description?: string | null;
}

// JSON Merge Patch semantics: omit a key to leave it untouched,
// set it to `null` to clear it.
export interface ProjectUpdate {
  name?: string;
  description?: string | null;
}

export interface ProjectPage {
  items: Project[];
  total: number;
  limit: number;
  offset: number;
}
