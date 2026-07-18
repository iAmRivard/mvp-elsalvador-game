/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __BUILD_SHA__: string;

declare module '@fontsource-variable/noto-sans';

interface ImportMetaEnv {
  readonly VITE_GAME_TITLE?: string;
  readonly VITE_MAP_ARCHIVE_URL?: string;
  readonly VITE_MAP_STYLE_URL?: string;
  readonly VITE_ENABLE_TERRAIN?: string;
  readonly VITE_ENABLE_THREE_PLAYER?: string;
  readonly VITE_DEFAULT_GRAPHICS_QUALITY?: string;
  readonly VITE_ENABLE_DIAGNOSTICS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
