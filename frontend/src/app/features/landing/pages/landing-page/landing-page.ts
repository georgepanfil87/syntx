import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LandingFooter } from '../../components/landing-footer/landing-footer';
import { FeatureTrio } from '../../components/feature-trio/feature-trio';
import { WorkspacePreview } from '../../components/workspace-preview/workspace-preview';
import { Hero } from '../../components/hero/hero';
import { LandingTopBar } from '../../components/landing-top-bar/landing-top-bar';

@Component({
  selector: 'sx-landing-page',
  imports: [LandingFooter, FeatureTrio, WorkspacePreview, Hero, LandingTopBar],
  template: `
    <div class="min-h-screen flex flex-col bg-background text-foreground">
      <sx-landing-top-bar />
      <sx-hero />
      <sx-workspace-preview />
      <sx-feature-trio />
      <sx-landing-footer />
    </div>
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage {}
