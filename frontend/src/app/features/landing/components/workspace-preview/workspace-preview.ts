import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Logo } from '../../../../shared/ui';

@Component({
  selector: 'sx-workspace-preview',
  imports: [Logo],
  template: `
    <section class="px-6 sm:px-10 pb-16">
      <div class="max-w-7xl mx-auto">
        <div class="rounded-2xl border border-border surface-elevated overflow-hidden shadow-2xl">
          <!-- Mock top bar -->
          <div
            class="flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-card/60"
          >
            <div class="flex items-center gap-3">
              <sx-logo [size]="28" ariaLabel="Syntx" />
              <span class="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                syntx / projects / portfolio-rewrite
              </span>
            </div>
            <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
              backend up
            </span>
          </div>

          <!-- Mock 3-pane grid — taller, larger fonts -->
          <div
            class="grid grid-cols-[220px_minmax(0,1fr)_320px] gap-3 p-3 bg-background/40"
            style="min-height: 520px"
          >
            <!-- Tree -->
            <div
              class="rounded-md border border-border bg-card p-3 text-xs font-mono text-muted-foreground space-y-1.5"
            >
              <p class="text-primary uppercase tracking-wider mb-3 text-[10px]">Files</p>
              <p>▾ src</p>
              <p class="pl-3">▾ app</p>
              <p class="pl-6 text-foreground">main.ts</p>
              <p class="pl-6 bg-secondary text-primary px-1 rounded">styles.css</p>
              <p class="pl-6 text-foreground">router.ts</p>
              <p class="pl-3">▸ lib</p>
              <p class="pl-3">▸ assets</p>
              <p>▸ tests</p>
              <p>package.json</p>
              <p>tsconfig.json</p>
            </div>

            <!-- Editor -->
            <div class="rounded-md border border-border bg-card flex flex-col overflow-hidden">
              <div
                class="flex items-center justify-between px-3 py-2 border-b border-border text-xs"
              >
                <span class="font-mono text-muted-foreground">src/app/styles.css</span>
                <span
                  class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/12 text-primary border border-primary/30"
                  >unsaved</span
                >
              </div>
              <div class="flex-1 p-4 text-sm font-mono leading-relaxed">
                <p class="text-muted-foreground/70">/* path: src/app/styles.css */</p>
                <p><span class="text-primary">.hero</span> {{ '{' }}</p>
                <p class="pl-4">
                  <span class="text-primary/80">color</span>:
                  <span class="text-foreground">hsl(var(--primary));</span>
                </p>
                <p class="pl-4">
                  <span class="text-primary/80">font-family</span>:
                  <span class="text-foreground">var(--font-display);</span>
                </p>
                <p class="pl-4">
                  <span class="text-primary/80">letter-spacing</span>:
                  <span class="text-foreground">-0.02em;</span>
                </p>
                <p>{{ '}' }}</p>
                <p class="mt-2"><span class="text-primary">.hero__title</span> {{ '{' }}</p>
                <p class="pl-4">
                  <span class="text-primary/80">background</span>:
                  <span class="text-foreground">var(--gradient-text);</span>
                </p>
                <p class="pl-4 text-muted-foreground/80">
                  <span class="text-primary/60">/* ghost: */</span>
                  <span class="opacity-70">background-clip: text;</span>
                </p>
              </div>
              <div
                class="flex items-center justify-between px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground font-mono"
              >
                <span>312 chars · 14 lines</span>
                <span>edited</span>
              </div>
            </div>

            <!-- Chat -->
            <div class="rounded-md border border-border bg-card flex flex-col overflow-hidden">
              <div class="flex items-center justify-between px-3 py-2 border-b border-border">
                <span class="text-[10px] uppercase tracking-wider text-primary">Chat</span>
                <span class="text-[10px] text-muted-foreground">+ New chat</span>
              </div>
              <div class="flex-1 p-3 space-y-2 overflow-hidden text-xs">
                <div
                  class="self-end ml-auto rounded-xl bg-primary/15 border border-primary/30 px-3 py-2 max-w-[85%]"
                >
                  refactor <span class="text-primary">@src/app/styles.css</span> to use design
                  tokens
                </div>
                <div
                  class="rounded-xl bg-secondary border border-border px-3 py-2 max-w-[90%] space-y-1.5"
                >
                  <p>
                    Renamed brand colors to
                    <code class="font-mono text-primary">var(--primary)</code> and the headline
                    gradient to <code class="font-mono text-primary">var(--gradient-text)</code>.
                  </p>
                  <div class="rounded-md border border-border bg-background overflow-hidden">
                    <div
                      class="px-2 py-1 bg-secondary/60 border-b border-border text-[10px] flex items-center justify-between"
                    >
                      <span class="text-primary font-mono">src/app/styles.css</span>
                      <span class="text-primary">✓ Apply</span>
                    </div>
                    <pre class="p-2 text-[10px] font-mono leading-snug">
.hero {{ '{' }}
  color: var(--primary);
{{ '}' }}</pre
                    >
                  </div>
                  <p class="text-[10px] text-muted-foreground font-mono">
                    qwen2.5-coder:1.5b · 87 tokens · 1.4s
                  </p>
                </div>
              </div>
              <div class="border-t border-border p-2">
                <div
                  class="flex items-end gap-2 rounded-md border border-border bg-background px-3 py-2"
                >
                  <span class="flex-1 text-xs text-muted-foreground/60">Continue this chat…</span>
                  <span
                    class="w-7 h-7 rounded-md flex items-center justify-center bg-primary text-primary-foreground text-xs"
                    >→</span
                  >
                </div>
              </div>
            </div>
          </div>
        </div>

        <p class="text-center text-xs text-muted-foreground mt-4">
          What you see after sign in — three panes, one project, zero context switches.
        </p>
      </div>
    </section>
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspacePreview {}
