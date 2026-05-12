import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { Icon } from "../../../../shared/ui";
export type ActivityView = 'files' | 'git';

@Component({
  selector: 'sx-activity-bar',
  imports: [Icon],
  templateUrl: './activity-bar.html',
  styleUrl: './activity-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex flex-col items-center gap-1 py-2 w-12 shrink-0 border-r border-border bg-card/40',
  },
})
export class ActivityBar {
  readonly selected = input<ActivityView>('files');
  readonly terminalOpen = input<boolean>(false);
  readonly exportDisabled = input<boolean>(false);

  /** User picked a side-panel view (Files / Git). */
  readonly select = output<ActivityView>();
  /** User wants to toggle the bottom terminal panel. */
  readonly toggleTerminal = output<void>();
  /** User clicked search (Cmd+P palette). */
  readonly openSearch = output<void>();
  /** User clicked export. */
  readonly exportProject = output<void>();
  /** User clicked settings — workspace router-navigates. */
  readonly openSettings = output<void>();

  protected readonly i18n = inject(I18nService);
}
