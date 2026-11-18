import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core'

/**
 * Adds the @smartdevutils/theme stylesheet (tokens and .sdu-* classes) to the page once, the first
 * time any SmartDevUtils component renders. The tokens use :where() (zero specificity), so your own
 * --sdu-* values win wherever they are set.
 */
@Component({
  selector: 'sdu-styles',
  standalone: true,
  template: '',
  styleUrl: '../../node_modules/@smartdevutils/theme/dist/styles.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { hidden: '', 'aria-hidden': 'true' },
})
export class SduStylesComponent {}
