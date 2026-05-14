import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  ViewEncapsulation,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let textareaUid = 0;

const LINE_HEIGHT_PX = 24;

@Component({
  selector: 'sx-textarea',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Textarea),
      multi: true,
    },
  ],
  template: `
    <div class="space-y-1">
      @if (label()) {
        <label [for]="resolvedId()" class="block text-xs font-medium text-muted-foreground">{{
          label()
        }}</label>
      }

      <div [class]="wrapperClasses()">
        <textarea
          #ta
          [id]="resolvedId()"
          [placeholder]="placeholder()"
          [disabled]="disabled()"
          [readonly]="readonly()"
          [attr.aria-invalid]="error() ? 'true' : null"
          [attr.aria-describedby]="describedBy()"
          [value]="value()"
          (input)="onInput($event)"
          (blur)="onBlur()"
          [style.minHeight.px]="minHeightPx()"
          [style.maxHeight.px]="maxHeightPx()"
          class="block w-full resize-none bg-transparent outline-none border-0 text-sm placeholder:text-muted-foreground/60 disabled:cursor-not-allowed leading-6"
          [rows]="minRows()"
        ></textarea>
      </div>

      @if (error()) {
        <p [id]="resolvedId() + '-error'" class="text-xs text-destructive">{{ error() }}</p>
      } @else if (hint()) {
        <p [id]="resolvedId() + '-hint'" class="text-xs text-muted-foreground">{{ hint() }}</p>
      }
    </div>
  `,
})
export class Textarea implements ControlValueAccessor {
  readonly placeholder = input<string>('');
  readonly label = input<string>('');
  readonly hint = input<string>('');
  readonly error = input<string>('');
  readonly readonly = input<boolean>(false);
  readonly minRows = input<number>(3);
  readonly maxRows = input<number>(12);
  readonly id = input<string>('');

  @ViewChild('ta', { static: true }) private taRef?: ElementRef<HTMLTextAreaElement>;

  protected readonly value = signal<string>('');
  protected readonly disabled = signal<boolean>(false);

  protected readonly resolvedId = computed(() => this.id() || `sx-textarea-${++textareaUid}`);

  protected readonly minHeightPx = computed(() => this.minRows() * LINE_HEIGHT_PX);
  protected readonly maxHeightPx = computed(() => this.maxRows() * LINE_HEIGHT_PX);

  protected readonly wrapperClasses = computed(() => {
    const base =
      'rounded-md border bg-background px-3 py-2 ' +
      'transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent';
    const tone = this.error() ? 'border-destructive' : 'border-border hover:border-primary/40';
    const interactive = this.disabled() ? 'opacity-60 cursor-not-allowed' : '';
    return `${base} ${tone} ${interactive}`.trim();
  });

  protected readonly describedBy = computed(() => {
    if (this.error()) return `${this.resolvedId()}-error`;
    if (this.hint()) return `${this.resolvedId()}-hint`;
    return null;
  });

  private _onChange: (value: string) => void = () => {};
  private _onTouched: () => void = () => {};

  writeValue(value: string | null | undefined): void {
    this.value.set(value ?? '');

    queueMicrotask(() => this.resize());
  }
  registerOnChange(fn: (value: string) => void): void {
    this._onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onInput(ev: Event): void {
    const v = (ev.target as HTMLTextAreaElement).value;
    this.value.set(v);
    this._onChange(v);
    this.resize();
  }
  protected onBlur(): void {
    this._onTouched();
  }

  private resize(): void {
    const el = this.taRef?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, this.maxHeightPx());
    el.style.height = `${Math.max(next, this.minHeightPx())}px`;
  }
}
