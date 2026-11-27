import { ChangeDetectionStrategy, Component, inject, input, OnInit } from '@angular/core'
import { Title } from '@angular/platform-browser'
import { RouterLink } from '@angular/router'

@Component({
  selector: 'pg-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="state-panel" aria-labelledby="nf-title">
      <h1 id="nf-title">Not found</h1>
      <p>{{ message() }}</p>
      <p><a routerLink="/">Back to all packages</a> or use the search in the sidebar.</p>
    </section>
  `,
})
export class NotFound implements OnInit {
  readonly message = input('There is no page at this address in the playground.')
  readonly setTitle = input(true)
  private readonly title = inject(Title)

  ngOnInit(): void {
    if (this.setTitle()) this.title.setTitle('Not found — SmartDevUtils Playground')
  }
}

/** Route component for unknown URLs. */
@Component({
  selector: 'pg-not-found-page',
  imports: [NotFound],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<pg-not-found />`,
})
export class NotFoundPage {}
