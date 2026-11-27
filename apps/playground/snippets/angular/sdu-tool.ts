/* ---
title: A JSON formatter with two-way binding
entry: components/SduToolComponent
description: A standalone component. [(value)] and [(mode)] are model() signals; (result) fires after every run.
mode: docs
output: preview
order: 1
--- */
import { Component, signal } from '@angular/core'
import { SduToolComponent, type SduToolResult } from '@smartdevutils/angular'

@Component({
  selector: 'app-json-tool',
  imports: [SduToolComponent],
  template: `
    <sdu-tool tool="json-formatter" [(mode)]="mode" [(value)]="json" (result)="onResult($event)" />
    <p>{{ mode() }}: {{ lines() }} lines of output</p>
  `,
})
export class JsonToolComponent {
  readonly mode = signal('format')
  readonly json = signal('{"service":"billing","replicas":3,"regions":["eu-west-1","us-east-1"]}')
  readonly lines = signal(0)

  onResult(r: SduToolResult) {
    this.lines.set(r.error ? 0 : r.output.split('\n').length)
  }
}
