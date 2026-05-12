import { Injectable, computed, signal } from '@angular/core';

export interface Command {
  id: string;
  title: string;
  hint?: string;
  group: string;
  when?: () => boolean;
  run: () => void | Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private readonly _open = signal<boolean>(false);
  private readonly _query = signal<string>('');
  private readonly _registry = signal<Command[]>([]);
  private readonly _selectedIndex = signal<number>(0);

  readonly open = this._open.asReadonly();
  readonly query = this._query.asReadonly();

  readonly results = computed<Command[]>(() => {
    const q = this._query().trim().toLowerCase();
    const all = this._registry().filter((c) => (c.when ? c.when() : true));
    if (!q) return all;

    type Scored = { cmd: Command; score: number };
    const scored: Scored[] = [];
    for (const cmd of all) {
      const title = cmd.title.toLowerCase();
      const group = cmd.group.toLowerCase();
      const hint = cmd.hint?.toLowerCase() ?? '';
      let score = 0;
      if (title.startsWith(q)) score = 3;
      else if (group.startsWith(q)) score = 2;
      else if (title.includes(q) || group.includes(q) || hint.includes(q)) score = 1;
      if (score > 0) scored.push({ cmd, score });
    }
    scored.sort((a, b) => b.score - a.score || a.cmd.title.localeCompare(b.cmd.title));
    return scored.map((s) => s.cmd);
  });

  readonly selectedIndex = computed(() => {
    const i = this._selectedIndex();
    const n = this.results().length;
    if (n === 0) return 0;
    return Math.max(0, Math.min(i, n - 1));
  });

  register(cmd: Command): void {
    this._registry.update((list) => [...list.filter((c) => c.id !== cmd.id), cmd]);
  }

  registerAll(cmds: Command[]): void {
    for (const c of cmds) this.register(c);
  }

  unregister(id: string): void {
    this._registry.update((list) => list.filter((c) => c.id !== id));
  }

  show(): void {
    this._query.set('');
    this._selectedIndex.set(0);
    this._open.set(true);
  }

  hide(): void {
    this._open.set(false);
  }

  toggle(): void {
    this._open() ? this.hide() : this.show();
  }

  setQuery(q: string): void {
    this._query.set(q);
    this._selectedIndex.set(0);
  }

  move(delta: number): void {
    const n = this.results().length;
    if (n === 0) return;
    const cur = this.selectedIndex();
    const next = (cur + delta + n) % n;
    this._selectedIndex.set(next);
  }

  setSelectedIndex(i: number): void {
    this._selectedIndex.set(i);
  }

  async runSelected(): Promise<void> {
    const cmd = this.results()[this.selectedIndex()];
    if (!cmd) return;
    this.hide();
    try {
      await cmd.run();
    } catch (err) {
      console.error('[command-palette] command failed', cmd.id, err);
    }
  }
}
