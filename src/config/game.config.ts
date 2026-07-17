export type GraphicsQuality = 'low' | 'medium' | 'high';

function graphicsQuality(value: string | undefined): GraphicsQuality {
  return value === 'low' || value === 'high' ? value : 'medium';
}

function booleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === 'true';
}

export const gameConfig = {
  title: import.meta.env.VITE_GAME_TITLE || 'El Salvador: Rutas Perdidas',
  version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.3.0',
  buildSha: typeof __BUILD_SHA__ === 'string' ? __BUILD_SHA__ : 'local',
  enableTerrain: booleanFlag(import.meta.env.VITE_ENABLE_TERRAIN, false),
  enableThreePlayer: booleanFlag(
    import.meta.env.VITE_ENABLE_THREE_PLAYER,
    true,
  ),
  defaultGraphicsQuality: graphicsQuality(
    import.meta.env.VITE_DEFAULT_GRAPHICS_QUALITY,
  ),
} as const;
