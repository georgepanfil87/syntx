import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Button, Icon, Badge } from '../../../../shared/ui';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'sx-hero',
  imports: [Button, Icon, Badge, RouterModule],
  template: `
    <section class="flex-1 flex items-center justify-center hero-glow px-6 py-16 sm:py-24">
      <div class="max-w-3xl text-center space-y-7 animate-fade-up">
        <span
          class="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
          Local-first · powered by Ollama
        </span>

        <h1 class="text-4xl sm:text-6xl font-semibold leading-[1.05] tracking-tight">
          <span class="gradient-text">Code with an AI</span>
          <br />
          <span>that never leaves your machine.</span>
        </h1>

        <p class="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto text-balance">
          An IDE-style workspace fused with a chat-driven coding assistant. Files, chats,
          completions — everything runs locally. Every model call is observable, every change is
          yours to apply.
        </p>

        <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
          <sx-button size="lg" routerLink="/register">
            <span>Get started — it's free</span>
            <sx-icon slot="trailing" name="arrow-right" [size]="14" />
          </sx-button>
          <sx-button size="lg" variant="ghost" routerLink="/login">Sign in</sx-button>
        </div>

        <div class="flex flex-wrap items-center justify-center gap-2 pt-2 text-[11px]">
          <sx-badge variant="outline">no cloud sync</sx-badge>
          <sx-badge variant="outline">no telemetry</sx-badge>
          <sx-badge variant="outline">observable model calls</sx-badge>
        </div>
      </div>
    </section>
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,

})
export class Hero {}
