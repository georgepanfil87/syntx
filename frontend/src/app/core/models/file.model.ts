// Tree entries skip `content` to keep the sidebar payload small;
// `FileRead` is the full body, used when a file is opened in the editor.
export interface FileTreeEntry {
  path: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface FileTree {
  project_id: string;
  items: FileTreeEntry[];
}

export interface FileRead {
  path: string;
  size_bytes: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface FileUpsert {
  content: string;
}
