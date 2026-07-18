import type { TransformStyleFunction } from 'maplibre-gl';
import { mapSourceConfig } from '../config/map.config';

interface PrimarySourceOverride {
  sourceId: string;
  archiveUrl: string;
}

function absoluteStyleUrl(value: string, baseUrl: string): string {
  return new URL(value, baseUrl).href
    .replaceAll('%7B', '{')
    .replaceAll('%7D', '}');
}

export function createStyleResourceTransform(
  baseUrl: string,
  primarySource?: PrimarySourceOverride,
): TransformStyleFunction {
  return (_previousStyle, nextStyle) => {
    const style = { ...nextStyle };

    if (typeof style.sprite === 'string') {
      style.sprite = absoluteStyleUrl(style.sprite, baseUrl);
    } else if (style.sprite) {
      style.sprite = style.sprite.map((sprite) => ({
        ...sprite,
        url: absoluteStyleUrl(sprite.url, baseUrl),
      }));
    }

    if (style.glyphs) {
      style.glyphs = absoluteStyleUrl(style.glyphs, baseUrl);
    }

    const configuredSource = primarySource
      ? style.sources?.[primarySource.sourceId]
      : undefined;
    if (primarySource && configuredSource?.type === 'vector') {
      style.sources = {
        ...style.sources,
        [primarySource.sourceId]: {
          ...configuredSource,
          url: `pmtiles://${primarySource.archiveUrl}`,
        },
      };
    }

    return style;
  };
}

export function createConfiguredStyleResourceTransform(
  baseUrl: string,
): TransformStyleFunction {
  return createStyleResourceTransform(baseUrl, {
    sourceId: mapSourceConfig.sourceId,
    archiveUrl: mapSourceConfig.archiveUrl,
  });
}
