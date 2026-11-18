import { Component, signal } from '@angular/core'
import {
  SduBase64Component,
  SduDiagramComponent,
  SduRecipeComponent,
  SduRecipeRunComponent,
  SduToolComponent,
  type SduToolResult,
} from '@smartdevutils/angular'
import type { RecipeRun } from '@smartdevutils/recipes'

@Component({
  selector: 'app-root',
  imports: [SduToolComponent, SduBase64Component, SduDiagramComponent, SduRecipeComponent, SduRecipeRunComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  protected readonly text = signal('{"service":"billing","replicas":3}')
  protected readonly last = signal('')
  protected readonly lastRun = signal<RecipeRun | null>(null)
  protected readonly flow = 'graph LR\n  A[Commit] --> B{Tests pass?}\n  B -- yes --> C[Deploy to staging]\n  B -- no --> D[Fix]\n  D --> A'

  onResult(r: SduToolResult): void {
    this.last.set(r.error ? `Error: ${r.error}` : `${r.output.length} characters`)
  }

  toggleTheme(): void {
    const root = document.documentElement
    root.dataset['theme'] = root.dataset['theme'] === 'dark' ? 'light' : 'dark'
  }
}
