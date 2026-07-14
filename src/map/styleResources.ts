import type { TransformStyleFunction } from 'maplibre-gl';

function absoluteStyleUrl(value: string, baseUrl: string): string {
  return new URL(value, baseUrl).href
    .replaceAll('%7B', '{')
    .replaceAll('%7D', '}');
}

export function createStyleResourceTransform(
  baseUrl: string,
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

    return style;
  };
}
