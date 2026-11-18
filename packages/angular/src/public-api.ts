/*
 * @smartdevutils/angular: standalone components for SmartDevUtils tools, recipes and diagrams.
 */
export { SduToolComponent, type SduToolResult } from './lib/tool.component'
export {
  SduFixedToolBase,
  SduBase64Component,
  SduHashGeneratorComponent,
  SduJsonFormatterComponent,
  SduUrlEncoderComponent,
  SduUuidGeneratorComponent,
} from './lib/named-tools'
export { SduDiagramComponent, type SduRenderedEvent } from './lib/diagram.component'
export { SduRecipeComponent, type SduStepEvent } from './lib/recipe.component'
export { SduRecipeRunComponent } from './lib/recipe-run.component'
export { SduStepDetailComponent } from './lib/step-detail.component'
export { SduOptionFieldsComponent, type SduOptionChange } from './lib/option-fields.component'
export { SduStylesComponent } from './lib/styles.component'
export { SMART_DEV_UTILS_CONFIG, provideSmartDevUtils, type SmartDevUtilsConfig } from './lib/config'
export type { SduTheme } from './lib/util'
