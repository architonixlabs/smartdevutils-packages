import { Routes } from '@angular/router'

// /playground/                              home: package cards and search
// /playground/<package>                     package overview (README, install, changelog)
// /playground/<package>/<section>           one section's items (API module, Tools, Elements, …)
// /playground/<package>/<section>/<entry>   one function, tool, element or component with its playground
export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/home').then((m) => m.HomePage) },
  { path: ':pkg', loadComponent: () => import('./features/package-page').then((m) => m.PackagePage) },
  {
    path: ':pkg/:section',
    loadComponent: () => import('./features/section-page').then((m) => m.SectionPage),
  },
  {
    path: ':pkg/:section/:entry',
    loadComponent: () => import('./features/entry-page').then((m) => m.EntryPage),
  },
  { path: '**', loadComponent: () => import('./shared/not-found').then((m) => m.NotFoundPage) },
]
