import { RenderMode, ServerRoute } from '@angular/ssr'

// Render on every request, so the server runs the tool and the HTML already holds its output.
export const serverRoutes: ServerRoute[] = [{ path: '**', renderMode: RenderMode.Server }]
