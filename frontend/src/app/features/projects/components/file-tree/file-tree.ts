import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { FileTreeEntry } from '../../../../core/models/file.model';
import { IconName, iconForPath } from '../../../../shared/icons';
import { Icon } from "../../../../shared/ui";
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

export interface RenameEvent {
  oldPath: string;
  newPath: string;
  isDir: boolean;
}

interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  size?: number;
  children?: FileNode[];
}

@Component({
  selector: 'file-tree',
  imports: [Icon, FormsModule, CommonModule],
  templateUrl: './file-tree.html',
  styleUrl: './file-tree.css',
  host: { class: 'flex flex-col h-full min-h-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,


})
export class FileTree {
  protected readonly i18n = inject(I18nService);

  readonly entries = input.required<readonly FileTreeEntry[]>();
  readonly activePath = input<string | null>(null);
  readonly pendingDeletes = input<readonly string[]>([]);
  readonly contextPaths = input<readonly string[]>([]);

  readonly select = output<string>();
  /** File delete — emits the full file path. */
  readonly delete = output<string>();
  /** Folder delete — emits the folder prefix. Parent deletes all files under it. */
  readonly deleteFolder = output<string>();
  /** Inline "New file" confirmed — emits the full resolved path. */
  readonly createFile = output<string>();

  readonly createFolder = output<string>();
  /** Rename confirmed — emits old + new full path and whether it was a directory. */
  readonly rename = output<RenameEvent>();
  /** Toggle a path's inclusion in the chat context. */
  readonly contextToggle = output<string>();
  /** Add every visible file to the chat context. */
  readonly selectAllContext = output<void>();
  /** Drop every file from the chat context. */
  readonly clearContext = output<void>();

  private readonly closedDirs = signal<ReadonlySet<string>>(new Set());
  protected readonly creatingIn = signal<string | null>(null);
  protected readonly creatingType = signal<'file' | 'folder'>('file');
  protected readonly newItemName = signal<string>('');
  protected readonly newItemError = signal<string>('');

  protected readonly renamingPath = signal<string | null>(null);
  protected readonly renameValue = signal<string>('');

  protected readonly tree = computed<FileNode[]>(() => buildTree(this.entries()));

  protected isOpen(path: string): boolean {
    return !this.closedDirs().has(path);
  }

  protected toggleDir(path: string): void {
    this.closedDirs.update((cur) => {
      const next = new Set(cur);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  protected onSelect(path: string): void {
    this.select.emit(path);
  }

  protected onDelete(path: string, ev: Event): void {
    ev.stopPropagation();
    if (this.isPending(path)) return;
    this.delete.emit(path);
  }

  protected onDeleteFolder(path: string, ev: Event): void {
    ev.stopPropagation();
    this.deleteFolder.emit(path);
  }

  protected isPending(path: string): boolean {
    return this.pendingDeletes().includes(path);
  }

  private readonly contextSet = computed(() => new Set(this.contextPaths()));

  protected isInContext(path: string): boolean {
    return this.contextSet().has(path);
  }

  protected onContextToggle(path: string, ev: Event): void {
    ev.stopPropagation();
    this.contextToggle.emit(path);
  }

  protected startCreate(folderPath: string, type: 'file' | 'folder'): void {
    // Expand the target folder so the input is visible.
    if (folderPath && this.closedDirs().has(folderPath)) {
      this.closedDirs.update((cur) => {
        const next = new Set(cur);
        next.delete(folderPath);
        return next;
      });
    }
    // Cancel any ongoing rename.
    this.cancelRename();
    this.creatingIn.set(folderPath);
    this.creatingType.set(type);
    this.newItemName.set('');
    this.newItemError.set('');
  }

  protected cancelCreate(): void {
    this.creatingIn.set(null);
    this.newItemName.set('');
    this.newItemError.set('');
  }

  protected confirmCreate(): void {
    const raw = this.newItemName().trim();
    if (!raw) {
      this.newItemError.set('Name is required.');
      return;
    }
    // Only a single path segment — no slashes, no parent traversal.
    if (raw.includes('/') || raw.includes('\\') || raw === '..' || raw === '.') {
      this.newItemError.set('Just the name, no slashes (e.g. "index.ts").');
      return;
    }

    const folderPath = this.creatingIn();
    const fullPath = folderPath ? `${folderPath}/${raw}` : raw;
    const type = this.creatingType();

    if (type === 'folder') {
      // Duplicate check: any existing entry whose path starts with the new prefix.
      const isDuplicate = this.entries().some(
        (e) => e.path === fullPath || e.path.startsWith(`${fullPath}/`),
      );
      if (isDuplicate) {
        this.newItemError.set('A folder with this name already exists.');
        return;
      }
      this.createFolder.emit(fullPath);
    } else {
      if (this.entries().some((e) => e.path === fullPath)) {
        this.newItemError.set('A file with this name already exists.');
        return;
      }
      this.createFile.emit(fullPath);
    }

    this.cancelCreate();
  }

  // Rename

  protected startRename(node: FileNode): void {
    this.cancelCreate();
    this.renamingPath.set(node.path);
    this.renameValue.set(node.name);
  }

  protected cancelRename(): void {
    this.renamingPath.set(null);
    this.renameValue.set('');
  }

  protected confirmRenameFile(node: FileNode): void {
    const newName = this.renameValue().trim();
    if (!newName || newName === node.name) {
      this.cancelRename();
      return;
    }
    if (newName.includes('/') || newName.includes('\\') || newName === '..') {
      this.cancelRename();
      return;
    }
    const slashIdx = node.path.lastIndexOf('/');
    const newPath =
      slashIdx < 0
        ? newName
        : `${node.path.slice(0, slashIdx + 1)}${newName}`;

    this.rename.emit({ oldPath: node.path, newPath, isDir: false });
    this.cancelRename();
  }

  protected confirmRenameFolder(node: FileNode): void {
    const newName = this.renameValue().trim();
    if (!newName || newName === node.name) {
      this.cancelRename();
      return;
    }
    if (newName.includes('/') || newName.includes('\\') || newName === '..') {
      this.cancelRename();
      return;
    }
    const slashIdx = node.path.lastIndexOf('/');
    const newPath =
      slashIdx < 0
        ? newName
        : `${node.path.slice(0, slashIdx + 1)}${newName}`;

    this.rename.emit({ oldPath: node.path, newPath, isDir: true });
    this.cancelRename();
  }

  //  Drag 
  protected onDragStart(ev: DragEvent, path: string): void {
    if (!ev.dataTransfer) return;
    ev.dataTransfer.effectAllowed = 'copyLink';
    ev.dataTransfer.setData('application/x-syntx-path', path);
    ev.dataTransfer.setData('text/plain', `@${path}`);
  }

  /** Per-row file glyph — colour-coded badge derived from the path. */
  protected iconFor(path: string): IconName {
    return iconForPath(path);
  }
}

function buildTree(entries: readonly FileTreeEntry[]): FileNode[] {
  const root: FileNode = { name: '', path: '', isDir: true, children: [] };

  for (const entry of entries) {
    const segments = entry.path.split('/').filter(Boolean);
    let node = root;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isLast = i === segments.length - 1;
      const path = segments.slice(0, i + 1).join('/');
      node.children ??= [];
      let child = node.children.find((c) => c.name === segment);
      if (!child) {
        child = isLast
          ? { name: segment, path, isDir: false, size: entry.size_bytes }
          : { name: segment, path, isDir: true, children: [] };
        node.children.push(child);
      }
      node = child;
    }
  }

  sort(root);
  return root.children ?? [];
}

function sort(node: FileNode): void {
  if (!node.children) return;
  node.children.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const child of node.children) sort(child);
}
