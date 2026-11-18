import { ChangeDetectionStrategy, Component, Directive, booleanAttribute, input, model, output, viewChild } from '@angular/core'
import { SduToolComponent, type SduToolResult } from './tool.component'
import type { SduTheme } from './util'

/** Inputs and outputs shared by the ready-made tool components; the same as SduToolComponent without `tool`. */
@Directive()
export abstract class SduFixedToolBase {
  abstract readonly toolId: string
  readonly mode = model('')
  readonly value = model('')
  readonly options = input<Record<string, unknown>>({})
  readonly manual = input(false, { transform: booleanAttribute })
  readonly readonly = input(false, { transform: booleanAttribute })
  readonly compact = input(false, { transform: booleanAttribute })
  readonly label = input('')
  readonly theme = input<SduTheme>('auto')
  readonly result = output<SduToolResult>()
  readonly error = output<SduToolResult & { error: string }>()
  protected readonly inner = viewChild.required(SduToolComponent)

  /** Runs the tool now. */
  run(): Promise<SduToolResult | null> {
    return this.inner().run()
  }
}

const TEMPLATE = `<sdu-tool
  [tool]="toolId"
  [(mode)]="mode"
  [(value)]="value"
  [options]="options()"
  [manual]="manual()"
  [readonly]="readonly()"
  [compact]="compact()"
  [label]="label()"
  [theme]="theme()"
  (result)="result.emit($event)"
  (error)="error.emit($event)"
/>`

/** `<sdu-json-formatter [(value)]="json" mode="minify" />`: format, minify or validate JSON. */
@Component({
  selector: 'sdu-json-formatter',
  standalone: true,
  imports: [SduToolComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:block' },
  template: TEMPLATE,
})
export class SduJsonFormatterComponent extends SduFixedToolBase {
  readonly toolId = 'json-formatter'
}

/** `<sdu-base64 [(value)]="text" mode="decode" />`: Base64 encode and decode (standard or URL-safe). */
@Component({
  selector: 'sdu-base64',
  standalone: true,
  imports: [SduToolComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:block' },
  template: TEMPLATE,
})
export class SduBase64Component extends SduFixedToolBase {
  readonly toolId = 'base64-encoder-decoder'
}

/** `<sdu-url-encoder [(value)]="text" mode="decode" />`: URL encode and decode. */
@Component({
  selector: 'sdu-url-encoder',
  standalone: true,
  imports: [SduToolComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:block' },
  template: TEMPLATE,
})
export class SduUrlEncoderComponent extends SduFixedToolBase {
  readonly toolId = 'url-encoder-decoder'
}

/** `<sdu-hash-generator [(value)]="text" mode="sha256" />`: MD5, SHA and HMAC hashes. */
@Component({
  selector: 'sdu-hash-generator',
  standalone: true,
  imports: [SduToolComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:block' },
  template: TEMPLATE,
})
export class SduHashGeneratorComponent extends SduFixedToolBase {
  readonly toolId = 'hash-generator'
}

/** `<sdu-uuid-generator [options]="{ version: 'v7', count: 3 }" />`: UUID v1, v4, v5 and v7. */
@Component({
  selector: 'sdu-uuid-generator',
  standalone: true,
  imports: [SduToolComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:block' },
  template: TEMPLATE,
})
export class SduUuidGeneratorComponent extends SduFixedToolBase {
  readonly toolId = 'uuid-generator'
}
