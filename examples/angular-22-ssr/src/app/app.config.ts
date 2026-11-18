import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core'
import { provideClientHydration } from '@angular/platform-browser'
import { provideSmartDevUtils } from '@smartdevutils/angular'

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideClientHydration(),
    // Mermaid is imported in the browser only, the first time a diagram is drawn.
    provideSmartDevUtils({ mermaid: () => import('mermaid') }),
  ],
}
