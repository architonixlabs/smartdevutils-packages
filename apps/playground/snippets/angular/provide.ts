/* ---
title: Use your own Mermaid install
entry: index/provideSmartDevUtils
description: By default Mermaid loads from a pinned jsDelivr build. Provide a loader to use the mermaid package your app installs, or a self-hosted URL.
mode: docs
--- */
import { bootstrapApplication } from '@angular/platform-browser'
import { provideZonelessChangeDetection } from '@angular/core'
import { provideSmartDevUtils } from '@smartdevutils/angular'
import { AppComponent } from './app/app.component'

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideSmartDevUtils({ mermaid: () => import('mermaid') }),
    // or: provideSmartDevUtils({ mermaidUrl: '/assets/mermaid.esm.min.mjs' })
  ],
})
