import { Component, signal } from '@angular/core'
import {
  SduDiagramComponent,
  SduHashGeneratorComponent,
  SduRecipeComponent,
  SduRecipeRunComponent,
  SduToolComponent,
} from '@smartdevutils/angular'
import type { RecipeRun } from '@smartdevutils/recipes'

@Component({
  selector: 'app-root',
  imports: [SduToolComponent, SduHashGeneratorComponent, SduDiagramComponent, SduRecipeComponent, SduRecipeRunComponent],
  templateUrl: './app.html',
})
export class App {
  protected readonly encoded = signal('name%3Dsample%20user%26role%3Dviewer')
  protected readonly lastRun = signal<RecipeRun | null>(null)
  protected readonly erd = [
    'erDiagram',
    '  CUSTOMER ||--o{ ORDER : places',
    '  ORDER ||--|{ LINE_ITEM : contains',
    '  CUSTOMER { string id string email }',
    '  ORDER { string id date created_at }',
  ].join('\n')

  toggleTheme(): void {
    const root = document.documentElement
    root.dataset['theme'] = root.dataset['theme'] === 'dark' ? 'light' : 'dark'
  }
}
