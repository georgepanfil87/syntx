import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Logo, Button } from '../../../../shared/ui';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'sx-landing-top-bar',
  imports: [Logo, Button, RouterModule],
  template: `
    <header class="flex items-center justify-between px-6 sm:px-10 py-4 border-b border-border/60">
      <a routerLink="/" class="flex items-center gap-2">
        <sx-logo [size]="32" ariaLabel="Syntx" />
        <span class="text-sm font-semibold gradient-text tracking-wide">Syntx</span>
      </a>
      <nav class="flex items-center gap-2 text-xs">
        <a
          href=""
          target="_blank"
          rel="noopener"
          class="text-muted-foreground hover:text-foreground transition px-2"
          >Docs</a
        >
        <a routerLink="/login" class="text-muted-foreground hover:text-foreground transition px-2"
          >Sign in</a
        >
        <sx-button size="sm" routerLink="/register">Get started</sx-button>
      </nav>
    </header>
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,

})
export class LandingTopBar {}
