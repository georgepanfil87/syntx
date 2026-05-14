import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Logo } from '../../../../shared/ui';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'sx-landing-footer',
  imports: [Logo, RouterModule],
  template: `
    <footer
      class="border-t border-border/60 px-6 sm:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground"
    >
      <div class="flex items-center gap-2">
        <sx-logo [size]="20" ariaLabel="Syntx" />
        <span>Syntx · local AI coding workspace</span>
      </div>
      <div class="flex items-center gap-4">
        <a routerLink="/login" class="hover:text-foreground transition">Sign in</a>
        <a routerLink="/register" class="hover:text-foreground transition">Create account</a>
      </div>
    </footer>
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,

})
export class LandingFooter {}
