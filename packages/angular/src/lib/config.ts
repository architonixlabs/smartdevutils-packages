import { InjectionToken, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core'
import type { MermaidLoader } from '@smartdevutils/browser/mermaid'

export interface SmartDevUtilsConfig {
  /** Where Mermaid comes from, for example `() => import('mermaid')` to use your installed copy. */
  mermaid?: MermaidLoader
  /** Or a URL of an ES module build of Mermaid. Default: the pinned jsDelivr build (MERMAID_CDN_URL). */
  mermaidUrl?: string
}

export const SMART_DEV_UTILS_CONFIG = new InjectionToken<SmartDevUtilsConfig>('SMART_DEV_UTILS_CONFIG')

/**
 * Optional app-wide settings:
 *
 *   bootstrapApplication(App, { providers: [provideSmartDevUtils({ mermaid: () => import('mermaid') })] })
 */
export function provideSmartDevUtils(config: SmartDevUtilsConfig = {}): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: SMART_DEV_UTILS_CONFIG, useValue: config }])
}
