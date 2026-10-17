import { EXHIBIT_IDS, PROJECT_ROUTES } from '../domain/limits';
import type { ExhibitId, ProjectRoute } from '../domain/types';

export interface AppRoute { path: ProjectRoute; exhibitId: ExhibitId | null }
export interface ParsedRoute { route: AppRoute; canonicalHash: string; redirected: boolean; invalid: boolean }
export function routeHash(route: AppRoute): string {
  return `#${route.path}${route.path === '/museum' && route.exhibitId ? `/${route.exhibitId}` : ''}`;
}
export function parseHash(hash: string): ParsedRoute {
  const aliases: Record<string, string> = { '#/stage': '#/practice', '#light-study': '#/light', '#story-preview': '#/about', '#museum-preview': '#/museum', '#main': '#/' };
  const input = hash === '' || hash === '#' ? '#/' : hash;
  const value = Object.prototype.hasOwnProperty.call(aliases, input) ? aliases[input]! : input;
  let route: AppRoute = { path: '/', exhibitId: null }, invalid = false;
  const path = value.slice(1);
  if (value.startsWith('#') && (PROJECT_ROUTES as readonly string[]).includes(path)) route = { path: path as ProjectRoute, exhibitId: null };
  else {
    const match = /^#\/museum\/(E\d{2})$/.exec(value);
    if (match && (EXHIBIT_IDS as readonly string[]).includes(match[1]!)) route = { path: '/museum', exhibitId: match[1] as ExhibitId };
    else invalid = true;
  }
  const canonicalHash = routeHash(route);
  return { route, canonicalHash, invalid, redirected: canonicalHash !== hash };
}
export interface HashLocationPort { read(): string; push(hash: string): void; replace(hash: string): void; listen(listener: () => void): () => void }
export function createHashRouter(port: HashLocationPort, accept: (parsed: ParsedRoute) => boolean) {
  let current: AppRoute | null = null, disposed = false;
  const apply = () => {
    if (disposed) return;
    const parsed = parseHash(port.read());
    if (current && !parsed.redirected && routeHash(current) === parsed.canonicalHash) return;
    if (!accept(parsed)) { if (current) port.replace(routeHash(current)); return; }
    current = parsed.route;
    if (parsed.redirected) port.replace(parsed.canonicalHash);
  };
  const unlisten = port.listen(apply);
  return {
    start: apply,
    navigate(route: AppRoute) { if (!disposed) { port.push(routeHash(route)); apply(); } },
    dispose() { disposed = true; unlisten(); },
  };
}
