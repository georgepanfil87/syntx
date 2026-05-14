import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { ICONS, IconName } from '../../icons';

@Component({
  selector: 'sx-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      [attr.viewBox]="def().viewBox"
      [attr.width]="size()"
      [attr.height]="size()"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      [attr.role]="ariaLabel() ? 'img' : null"
      [attr.aria-hidden]="ariaLabel() ? null : 'true'"
      [attr.aria-label]="ariaLabel() || null"
      [innerHTML]="safeBody()"
    ></svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        line-height: 0;
      }
    `,
  ],
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input<number | string>(16);
  readonly ariaLabel = input<string>('');

  private readonly sanitizer = inject(DomSanitizer);

  protected readonly def = computed(() => ICONS[this.name()]);

  protected readonly safeBody = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.def().body),
  );
}
