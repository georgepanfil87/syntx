import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Icon } from '../icon/icon';

let inputUid = 0;

@Component({
  selector: 'app-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [Icon],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
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
        <span class="flex items-center text-muted-foreground">
          <ng-content select="[slot=leading]" />
        </span>

        <input
          [id]="resolvedId()"
          [type]="effectiveType()"
          [placeholder]="placeholder()"
          [disabled]="disabled()"
          [readonly]="readonly()"
          [autocomplete]="autocomplete()"
          [attr.aria-invalid]="error() ? 'true' : null"
          [attr.aria-describedby]="describedBy()"
          [value]="value()"
          (input)="onInput($event)"
          (blur)="onBlur()"
          class="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground/60 disabled:cursor-not-allowed"
        />

        <span class="flex items-center text-muted-foreground">
          <ng-content select="[slot=trailing]" />
        </span>

        @if (isPassword()) {
          <!--
            type=button so the toggle never accidentally submits the
            wrapping form. tabindex=-1 keeps the natural Tab order
            email → password → confirm → primary action; the toggle is
            a click affordance, not a stop on the keyboard journey.
          -->
          <button
            type="button"
            tabindex="-1"
            class="flex items-center justify-center text-muted-foreground hover:text-foreground transition rounded p-0.5"
            [attr.aria-pressed]="showPassword() ? 'true' : 'false'"
            (click)="toggleShowPassword()"
          >
            <sx-icon
              [name]="showPassword() ? 'eye-off' : 'eye'"
              [ariaLabel]="showPassword() ? 'Hide password' : 'Show password'"
            />
          </button>
        }
      </div>

      @if (error()) {
        <p [id]="resolvedId() + '-error'" class="text-xs text-destructive">{{ error() }}</p>
      } @else if (hint()) {
        <p [id]="resolvedId() + '-hint'" class="text-xs text-muted-foreground">{{ hint() }}</p>
      }
    </div>
  `,
})
export class InputComponent implements ControlValueAccessor {
  readonly type = input<string>('text');
  readonly placeholder = input<string>('');
  readonly label = input<string>('');
  readonly hint = input<string>('');
  readonly error = input<string>('');
  readonly readonly = input<boolean>(false);
  readonly autocomplete = input<string>('off');
  readonly id = input<string>('');

  protected readonly value = signal<string>('');
  protected readonly disabled = signal<boolean>(false);
  protected readonly showPassword = signal<boolean>(false);

  protected readonly resolvedId = computed(() => this.id() || `app-input-${++inputUid}`);

  protected readonly isPassword = computed(() => this.type() === 'password');

  protected readonly effectiveType = computed(() =>
    this.isPassword() && this.showPassword() ? 'text' : this.type(),
  );

  protected toggleShowPassword(): void {
    this.showPassword.update((v) => !v);
  }

  protected readonly wrapperClasses = computed(() => {
    const base =
      'flex items-center gap-2 rounded-md border bg-background px-3 h-9 ' +
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
    const v = (ev.target as HTMLInputElement).value;
    this.value.set(v);
    this._onChange(v);
  }
  protected onBlur(): void {
    this._onTouched();
  }
}
