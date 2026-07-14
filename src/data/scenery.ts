export type SceneryKind = 'tree' | 'post' | 'barrier' | 'light' | 'station';

export interface SceneryInstance {
  kind: SceneryKind;
  coordinates: [longitude: number, latitude: number];
  heading: number;
}

function corridorInstances(
  kind: 'tree' | 'post',
  start: [number, number],
  end: [number, number],
  count: number,
  heading: number,
): SceneryInstance[] {
  return Array.from({ length: count }, (_, index) => {
    const progress = (index + 1) / (count + 1);
    const side = index % 2 === 0 ? 1 : -1;
    return {
      kind,
      coordinates: [
        start[0] + (end[0] - start[0]) * progress + side * 0.000055,
        start[1] + (end[1] - start[1]) * progress - side * 0.000035,
      ],
      heading,
    };
  });
}

export const chapterScenery: readonly SceneryInstance[] = [
  ...corridorInstances('post', [-89.191, 13.697], [-89.3175, 13.6821], 12, 96),
  ...corridorInstances(
    'tree',
    [-89.3175, 13.6821],
    [-89.4474, 13.8409],
    16,
    325,
  ),
  ...corridorInstances(
    'post',
    [-89.4474, 13.8409],
    [-89.557, 13.9946],
    12,
    330,
  ),
  ...corridorInstances(
    'tree',
    [-89.5741, 13.9043],
    [-89.5083, 13.8722],
    10,
    80,
  ),
  {
    kind: 'barrier',
    coordinates: [-89.3592277, 13.7305749],
    heading: 8,
  },
  {
    kind: 'barrier',
    coordinates: [-89.3590706, 13.7306249],
    heading: 8,
  },
  {
    kind: 'station',
    coordinates: [-89.3175451, 13.6820687],
    heading: 98,
  },
  {
    kind: 'station',
    coordinates: [-89.447361, 13.8408999],
    heading: 40,
  },
  {
    kind: 'light',
    coordinates: [-89.31775, 13.68215],
    heading: 0,
  },
  {
    kind: 'light',
    coordinates: [-89.44714, 13.84102],
    heading: 0,
  },
  {
    kind: 'light',
    coordinates: [-89.556959, 13.994583],
    heading: 0,
  },
] as const;
