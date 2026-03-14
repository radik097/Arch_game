import { describe, expect, it } from 'vitest';
import { buildAppPath, buildPublicAssetPath, resolveAppBasePath } from '../app/routes';

describe('app route helpers', () => {
  it('resolves the workspace base path from leaf routes', () => {
    expect(resolveAppBasePath('/Arch_game/vm')).toBe('/Arch_game/');
    expect(resolveAppBasePath('/Arch_game/docs/')).toBe('/Arch_game/');
    expect(resolveAppBasePath('/Arch_game/stats')).toBe('/Arch_game/');
  });

  it('builds app routes relative to the deployment base path', () => {
    expect(buildAppPath('vm', '/Arch_game')).toBe('/Arch_game/vm');
    expect(buildAppPath('docs', '/Arch_game/stats')).toBe('/Arch_game/docs');
    expect(buildAppPath('', '/Arch_game/vm')).toBe('/Arch_game/');
  });

  it('builds public asset paths under the deployment base path', () => {
    expect(buildPublicAssetPath('vm/archlinux.ext2', '/Arch_game/vm')).toBe('/Arch_game/vm/archlinux.ext2');
    expect(buildPublicAssetPath('/vm/archlinux.ext2', '/')).toBe('/vm/archlinux.ext2');
  });
});