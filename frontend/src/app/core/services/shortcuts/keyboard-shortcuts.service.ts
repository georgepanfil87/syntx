import { Injectable, signal } from '@angular/core';

export interface ShortcutDef {
  id: string;
  keys: string;
  description: string;
  group: string;
  when?: () => boolean;
  allowInInput?: boolean;
  handler: () => void | Promise<void>;
}

interface ParsedKey {
  mod: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

function parseKeyspec(spec: string): ParsedKey {
  const parts = spec
    .toLowerCase()
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean);
  const out: ParsedKey = {
    mod: false,
    ctrl: false,
    meta: false,
    shift: false,
    alt: false,
    key: '',
  };
  for (const p of parts) {
    if (p === 'mod') out.mod = true;
    else if (p === 'ctrl') out.ctrl = true;
    else if (p === 'meta' || p === 'cmd') out.meta = true;
    else if (p === 'shift') out.shift = true;
    else if (p === 'alt' || p === 'option') out.alt = true;
    else out.key = p;
  }
  return out;
}

function eventMatches(parsed: ParsedKey, ev: KeyboardEvent): boolean {
  const wantMeta = parsed.meta || (parsed.mod && IS_MAC);
  const wantCtrl = parsed.ctrl || (parsed.mod && !IS_MAC);
  if (!!ev.metaKey !== wantMeta) return false;
  if (!!ev.ctrlKey !== wantCtrl) return false;
  if (!!ev.shiftKey !== parsed.shift) return false;
  if (!!ev.altKey !== parsed.alt) return false;
  return ev.key.toLowerCase() === parsed.key;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

@Injectable({ providedIn: 'root' })
export class KeyboardShortcutsService {
  private readonly _shortcuts = signal<ShortcutDef[]>([]);
  readonly shortcuts = this._shortcuts.asReadonly();

  static formatKeyspec(spec: string): string {
    const p = parseKeyspec(spec);
    const tokens: string[] = [];
    if (p.meta || (p.mod && IS_MAC)) tokens.push(IS_MAC ? '⌘' : 'Meta');
    if (p.ctrl || (p.mod && !IS_MAC)) tokens.push('Ctrl');
    if (p.alt) tokens.push(IS_MAC ? '⌥' : 'Alt');
    if (p.shift) tokens.push(IS_MAC ? '⇧' : 'Shift');
    const key = p.key.length === 1 ? p.key.toUpperCase() : p.key;
    tokens.push(key);
    return tokens.join(IS_MAC ? '' : '+');
  }

  register(s: ShortcutDef): void {
    this._shortcuts.update((list) => [...list.filter((x) => x.id !== s.id), s]);
  }

  registerAll(list: ShortcutDef[]): void {
    for (const s of list) this.register(s);
  }

  unregister(id: string): void {
    this._shortcuts.update((list) => list.filter((s) => s.id !== id));
  }

  dispatch(ev: KeyboardEvent): boolean {
    const editable = isEditableTarget(ev.target);
    for (const s of this._shortcuts()) {
      if (s.when && !s.when()) continue;
      if (editable && !s.allowInInput) continue;
      const parsed = parseKeyspec(s.keys);
      if (!eventMatches(parsed, ev)) continue;
      Promise.resolve(s.handler()).catch((err) =>
        console.error('[shortcuts] handler failed', s.id, err),
      );
      return true;
    }
    return false;
  }
}
