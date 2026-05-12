import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  output,
  signal,
} from '@angular/core';

@Component({
  selector: 'sx-resizer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="resizer-track h-full w-1.5 cursor-col-resize select-none transition-colors focus:outline-none focus:bg-primary/45"
      [class.is-active]="dragging()"
      role="separator"
      aria-orientation="vertical"
      tabindex="0"
      (pointerdown)="onPointerDown($event)"
      (keydown)="onKeyDown($event)"
    ></div>
  `,
  styles: [
    `
      :host {
        display: block;
        flex: 0 0 auto;
        height: 100%;
      }
      .resizer-track {
        background: transparent;
      }
      .resizer-track:hover,
      .resizer-track.is-active {
        background: hsl(var(--primary) / 0.45);
      }
    `,
  ],
})
export class Resizer {
  readonly start = output<void>();
  readonly delta = output<number>();
  readonly commit = output<number>();
  readonly nudge = output<number>();

  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly dragging = signal<boolean>(false);

  private startX = 0;
  private lastDelta = 0;
  private activePointer: number | null = null;

  protected onPointerDown(ev: PointerEvent): void {
    if (ev.button !== 0) return;
    ev.preventDefault();
    const handle = ev.currentTarget as HTMLElement;
    this.startX = ev.clientX;
    this.lastDelta = 0;
    this.activePointer = ev.pointerId;
    this.dragging.set(true);
    handle.setPointerCapture(ev.pointerId);
    this.start.emit();
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(ev: PointerEvent): void {
    if (!this.dragging() || ev.pointerId !== this.activePointer) return;
    const next = ev.clientX - this.startX;
    if (next === this.lastDelta) return;
    this.lastDelta = next;
    this.delta.emit(next);
  }

  protected onKeyDown(ev: KeyboardEvent): void {
    const STEP = ev.shiftKey ? 32 : 8;
    let delta = 0;
    switch (ev.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        delta = -STEP;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        delta = STEP;
        break;
      case 'Home':
        delta = -100_000;
        break;
      case 'End':
        delta = 100_000;
        break;
      default:
        return;
    }
    ev.preventDefault();
    this.nudge.emit(delta);
  }

  @HostListener('pointerup', ['$event'])
  @HostListener('pointercancel', ['$event'])
  onPointerUp(ev: PointerEvent): void {
    if (!this.dragging() || ev.pointerId !== this.activePointer) return;
    const handle = ev.target as HTMLElement;
    if (handle.releasePointerCapture && handle.hasPointerCapture?.(ev.pointerId)) {
      handle.releasePointerCapture(ev.pointerId);
    }
    this.dragging.set(false);
    this.activePointer = null;
    this.commit.emit(this.lastDelta);
  }
}
