import { Injectable, computed, signal } from '@angular/core';
import { Lang, DICTIONARIES } from './dictionaries';
import { EN } from './en-dictionary';


@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly _lang = signal<Lang>('en');

  readonly lang = this._lang.asReadonly();

  private readonly dict = computed(() => DICTIONARIES[this._lang()] ?? EN);

  setLang(lang: Lang): void {
    if (this._lang() === lang) return;
    this._lang.set(lang);
  }
  t(key: string, params?: Record<string, string | number>): string {
    let value = this.dict()[key];
    if (value === undefined) {
      value = EN[key] ?? key;
    }
    if (!params) return value;
    return interpolate(value, params);
  }
}

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    const v = params[name];
    return v === undefined ? match : String(v);
  });
}
