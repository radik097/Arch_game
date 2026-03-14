export function resolveAppBasePath(pathname: string = window.location.pathname): string {
  const normalized = pathname.replace(/\/+$/, '');
  const withoutRoute = normalized.replace(/\/(docs|stats|vm)$/u, '');

  if (!withoutRoute) {
    return '/';
  }

  return withoutRoute.endsWith('/') ? withoutRoute : `${withoutRoute}/`;
}

export function buildAppPath(segment = '', pathname: string = window.location.pathname): string {
  const basePath = resolveAppBasePath(pathname);
  if (!segment) {
    return basePath;
  }

  return `${basePath.replace(/\/$/, '')}/${segment.replace(/^\//, '')}`;
}

export function buildPublicAssetPath(assetPath: string, pathname: string = window.location.pathname): string {
  return buildAppPath(assetPath.replace(/^\//, ''), pathname);
}