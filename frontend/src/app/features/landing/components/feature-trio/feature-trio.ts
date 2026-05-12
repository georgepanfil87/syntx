import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Card, Icon } from '../../../../shared/ui';

@Component({
  selector: 'sx-feature-trio',
  imports: [Card, Icon],
  template: `
    <section class="px-6 sm:px-10 pb-16">
      <div class="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        <sx-card variant="elevated">
          <div
            class="w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-primary/15 text-primary border border-primary/30"
          >
            <sx-icon name="folder" [size]="18" />
          </div>
          <h3 class="text-base font-semibold">IDE + chat in one window</h3>
          <p class="text-sm text-muted-foreground mt-1.5">
            Three resizable panes — file tree, Monaco editor, AI chat — share the same project
            context. Reference any file with
            <code class="font-mono text-primary">&#64;mention</code>.
          </p>
        </sx-card>

        <sx-card variant="elevated">
          <div
            class="w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-primary/15 text-primary border border-primary/30"
          >
            <sx-icon name="check" [size]="18" />
          </div>
          <h3 class="text-base font-semibold">Apply with one click</h3>
          <p class="text-sm text-muted-foreground mt-1.5">
            Code blocks tagged with a path get an Apply affordance. Inline diff compares current and
            proposed before anything is written to disk.
          </p>
        </sx-card>

        <sx-card variant="elevated">
          <div
            class="w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-primary/15 text-primary border border-primary/30"
          >
            <sx-icon name="chart-line" [size]="18" />
          </div>
          <h3 class="text-base font-semibold">Observable by default</h3>
          <p class="text-sm text-muted-foreground mt-1.5">
            Every request shows model, tokens and latency in the audit drawer. The admin dashboard
            surfaces p50/p95 across endpoints.
          </p>
        </sx-card>
      </div>
    </section>
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureTrio {}
