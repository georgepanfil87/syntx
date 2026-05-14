import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

let logoUid = 0;

@Component({
  selector: 'sx-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.aria-label]="ariaLabel() || 'Syntx'"
      role="img"
    >
      <defs>
        <!-- Brand gradient: cyan top-left → violet bottom-right. -->
        <linearGradient
          [attr.id]="bgId()"
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" class="logo-stop-primary" />
          <stop offset="100%" class="logo-stop-accent" />
        </linearGradient>

        <!-- Soft inner highlight at the upper-left — gives the tile depth. -->
        <radialGradient [attr.id]="highlightId()" cx="0.25" cy="0.2" r="0.7">
          <stop offset="0%" stop-color="white" stop-opacity="0.28" />
          <stop offset="55%" stop-color="white" stop-opacity="0.06" />
          <stop offset="100%" stop-color="white" stop-opacity="0" />
        </radialGradient>

        <!-- Accent gradient for the spark dot — slightly cooler than the bg. -->
        <linearGradient [attr.id]="dotId()" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="white" />
          <stop offset="100%" class="logo-stop-primary-tint" />
        </linearGradient>
      </defs>

      <!-- Background tile -->
      <rect x="1" y="1" width="30" height="30" rx="8" [attr.fill]="bgUrl()" />
      <!-- Inner highlight overlay -->
      <rect x="1" y="1" width="30" height="30" rx="8" [attr.fill]="highlightUrl()" />
      <!-- Hairline border for crispness on light backgrounds -->
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="8"
        fill="none"
        stroke="white"
        stroke-opacity="0.10"
        stroke-width="1"
      />

      <path
        d="M22 9 H12 a3 3 0 0 0 -3 3 v0 a3 3 0 0 0 3 3 H20 a3 3 0 0 1 3 3 v0 a3 3 0 0 1 -3 3 H10"
        fill="none"
        stroke="white"
        stroke-width="2.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- Spark accent at the start of the stroke -->
      <circle cx="22" cy="9" r="1.7" [attr.fill]="dotUrl()" />
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        line-height: 0;
      }
      .logo-stop-primary {
        stop-color: hsl(var(--primary));
      }
      .logo-stop-accent {
        stop-color: hsl(var(--accent));
      }
      .logo-stop-primary-tint {
        stop-color: hsl(var(--primary) / 1);
        stop-color: color-mix(in oklab, white 70%, hsl(var(--primary)));
      }
    `,
  ],
})
export class Logo {
  readonly size = input<number | string>(32);
  readonly ariaLabel = input<string>('');

  private readonly uid = ++logoUid;
  protected readonly bgId = computed(() => `syntx-logo-bg-${this.uid}`);
  protected readonly highlightId = computed(() => `syntx-logo-hl-${this.uid}`);
  protected readonly dotId = computed(() => `syntx-logo-dot-${this.uid}`);

  protected readonly bgUrl = computed(() => `url(#${this.bgId()})`);
  protected readonly highlightUrl = computed(() => `url(#${this.highlightId()})`);
  protected readonly dotUrl = computed(() => `url(#${this.dotId()})`);
}
