export interface GameplayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type GameplayOcclusionKind =
  | 'hud'
  | 'joystick'
  | 'actions'
  | 'target-speed'
  | 'navigator'
  | 'radio'
  | 'overlay';

export interface GameplayOcclusion {
  id: string;
  rect: GameplayRect;
  kind: GameplayOcclusionKind;
}

export interface SafeGameplayViewportInput {
  canvas: GameplayRect;
  visibleViewport: GameplayRect;
  safeAreaInsets: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  playerFootprint: { width: number; height: number };
  occlusions: readonly GameplayOcclusion[];
  paddingPixels?: number;
}

export interface SafeGameplayViewport extends GameplayRect {
  usefulMapAreaRatio: number;
  obstructed: boolean;
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizedRect(rect: GameplayRect): GameplayRect {
  return {
    x: finite(rect.x),
    y: finite(rect.y),
    width: Math.max(0, finite(rect.width)),
    height: Math.max(0, finite(rect.height)),
  };
}

function intersectRect(
  firstRect: GameplayRect,
  secondRect: GameplayRect,
): GameplayRect | null {
  const first = normalizedRect(firstRect);
  const second = normalizedRect(secondRect);
  const x = Math.max(first.x, second.x);
  const y = Math.max(first.y, second.y);
  const right = Math.min(
    first.x + first.width,
    second.x + second.width,
  );
  const bottom = Math.min(
    first.y + first.height,
    second.y + second.height,
  );
  return right > x && bottom > y
    ? { x, y, width: right - x, height: bottom - y }
    : null;
}

function unionArea(rectangles: readonly GameplayRect[]): number {
  if (rectangles.length === 0) return 0;
  const xCoordinates = [
    ...new Set(
      rectangles.flatMap((rect) => [rect.x, rect.x + rect.width]),
    ),
  ].sort((left, right) => left - right);
  let area = 0;
  for (let index = 1; index < xCoordinates.length; index += 1) {
    const left = xCoordinates[index - 1];
    const right = xCoordinates[index];
    if (right <= left) continue;
    const intervals = rectangles
      .filter((rect) => rect.x < right && rect.x + rect.width > left)
      .map((rect) => [rect.y, rect.y + rect.height] as const)
      .sort((first, second) => first[0] - second[0]);
    if (intervals.length === 0) continue;
    let coveredHeight = 0;
    let start = intervals[0][0];
    let end = intervals[0][1];
    for (const [nextStart, nextEnd] of intervals.slice(1)) {
      if (nextStart <= end) {
        end = Math.max(end, nextEnd);
      } else {
        coveredHeight += end - start;
        start = nextStart;
        end = nextEnd;
      }
    }
    coveredHeight += end - start;
    area += (right - left) * coveredHeight;
  }
  return area;
}

export function safeGameplayViewportFor(
  input: SafeGameplayViewportInput,
): SafeGameplayViewport {
  const canvas = normalizedRect(input.canvas);
  const visible = intersectRect(canvas, input.visibleViewport) ?? canvas;
  const padding = Math.max(0, finite(input.paddingPixels ?? 10, 10));
  const safeAreaInsets = {
    top: Math.max(0, finite(input.safeAreaInsets.top)),
    right: Math.max(0, finite(input.safeAreaInsets.right)),
    bottom: Math.max(0, finite(input.safeAreaInsets.bottom)),
    left: Math.max(0, finite(input.safeAreaInsets.left)),
  };
  const base = {
    x: visible.x + safeAreaInsets.left + padding,
    y: visible.y + safeAreaInsets.top + padding,
    width: Math.max(
      0,
      visible.width -
        safeAreaInsets.left -
        safeAreaInsets.right -
        padding * 2,
    ),
    height: Math.max(
      0,
      visible.height -
        safeAreaInsets.top -
        safeAreaInsets.bottom -
        padding * 2,
    ),
  };
  const clippedOcclusions = input.occlusions.flatMap((occlusion) => {
    const clipped = intersectRect(visible, occlusion.rect);
    return clipped ? [{ ...occlusion, rect: clipped }] : [];
  });
  const visibleArea = Math.max(1, visible.width * visible.height);
  const usefulMapAreaRatio = clamp(
    1 -
      unionArea(clippedOcclusions.map((occlusion) => occlusion.rect)) /
        visibleArea,
    0,
    1,
  );
  const corridorWidth = Math.max(
    1,
    finite(input.playerFootprint.width) + padding * 2,
  );
  const corridor = {
    x: canvas.x + canvas.width / 2 - corridorWidth / 2,
    y: base.y,
    width: corridorWidth,
    height: base.height,
  };
  let top = base.y;
  let bottom = base.y + base.height;
  let obstructed = clippedOcclusions.some(
    (occlusion) =>
      occlusion.kind === 'overlay' &&
      occlusion.rect.height >= visible.height * 0.5 &&
      intersectRect(corridor, occlusion.rect) !== null,
  );
  const baseCenterY = base.y + base.height / 2;

  for (const occlusion of clippedOcclusions) {
    if (!intersectRect(corridor, occlusion.rect)) continue;
    const rect = occlusion.rect;
    const rectCenterY = rect.y + rect.height / 2;
    if (rectCenterY <= baseCenterY) {
      top = Math.max(top, rect.y + rect.height + padding);
    } else {
      bottom = Math.min(bottom, rect.y - padding);
    }
  }

  const minimumHeight = Math.max(
    80,
    finite(input.playerFootprint.height) + padding * 2,
  );
  if (bottom - top < minimumHeight || base.width < corridorWidth) {
    obstructed = true;
    top = base.y;
    bottom = base.y + base.height;
  }

  return {
    x: base.x,
    y: top,
    width: base.width,
    height: Math.max(0, bottom - top),
    usefulMapAreaRatio,
    obstructed,
  };
}

export function followCameraOffsetForSafeViewport(
  canvasRect: GameplayRect,
  safeViewport: SafeGameplayViewport,
  anchorYRatio = 0.6,
): [horizontal: number, vertical: number] {
  const canvas = normalizedRect(canvasRect);
  const ratio = clamp(finite(anchorYRatio, 0.6), 0.55, 0.65);
  const targetX = safeViewport.x + safeViewport.width / 2;
  const targetY = safeViewport.y + safeViewport.height * ratio;
  return [
    Math.round(targetX - (canvas.x + canvas.width / 2)),
    Math.round(targetY - (canvas.y + canvas.height / 2)),
  ];
}
