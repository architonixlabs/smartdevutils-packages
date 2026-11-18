import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core'
import { provideSmartDevUtils } from '@smartdevutils/angular'

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Draw diagrams with the installed mermaid package instead of the CDN copy.
    provideSmartDevUtils({ mermaid: () => import('mermaid') }),
  ],
}
