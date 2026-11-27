/* ---
title: A diagram, a recipe and its run
entry: components/SduDiagramComponent, components/SduRecipeComponent, components/SduRecipeRunComponent
description: Diagrams draw in the browser only, after hydration; recipes run when the visitor presses Run.
mode: docs
output: preview
--- */
import { Component, signal } from '@angular/core'
import { SduDiagramComponent, SduRecipeComponent, SduRecipeRunComponent } from '@smartdevutils/angular'
import type { RecipeRun } from '@smartdevutils/recipes'

@Component({
  selector: 'app-pipeline',
  imports: [SduDiagramComponent, SduRecipeComponent, SduRecipeRunComponent],
  template: `
    <sdu-diagram [source]="flow" label="Release flow" />
    <sdu-recipe recipe="decode-base64-json-param" (run)="lastRun.set($event)" />
    @if (lastRun(); as run) {
      <sdu-recipe-run [run]="run" upload />
    }
  `,
})
export class PipelineComponent {
  readonly flow = 'flowchart LR\n  Commit --> Test --> Deploy'
  readonly lastRun = signal<RecipeRun | null>(null)
}
