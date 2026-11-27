/* ---
title: The ready-made tool components
entry: components/SduBase64Component, components/SduHashGeneratorComponent, components/SduUuidGeneratorComponent, components/SduUrlEncoderComponent
description: Each is sdu-tool fixed to one tool, with the same inputs and outputs except tool.
mode: docs
output: preview
--- */
import { Component, signal } from '@angular/core'
import {
  SduBase64Component,
  SduHashGeneratorComponent,
  SduUuidGeneratorComponent,
  SduUrlEncoderComponent,
} from '@smartdevutils/angular'

@Component({
  selector: 'app-dev-tools',
  imports: [SduBase64Component, SduHashGeneratorComponent, SduUuidGeneratorComponent, SduUrlEncoderComponent],
  template: `
    <sdu-base64 mode="decode" [(value)]="token" compact />
    <sdu-hash-generator mode="sha256" value="hello world" />
    <sdu-url-encoder mode="encode" value="q=hello world&lang=en" />
    <sdu-uuid-generator [options]="{ version: 'v7', count: 3 }" />
  `,
})
export class DevToolsComponent {
  readonly token = signal('eyJ1c2VyIjoiYWRhIn0=')
}
