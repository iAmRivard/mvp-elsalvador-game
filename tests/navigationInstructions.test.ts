import { describe, expect, it } from 'vitest';
import {
  formatNavigationInstruction,
  generateNavigationInstructions,
  navigationProgress,
} from '../src/map/navigationInstructions';
import type { RoadCoordinates } from '../src/types/roads';

describe('turn-by-turn navigation instructions', () => {
  it('keeps a straight route concise', () => {
    const route: RoadCoordinates[] = [
      [-89.3, 13.7],
      [-89.299, 13.7],
      [-89.298, 13.7],
    ];
    const instructions = generateNavigationInstructions(route);

    expect(instructions.map((instruction) => instruction.type)).toEqual([
      'continue',
      'arrive',
    ]);
    expect(
      formatNavigationInstruction(
        instructions[0],
        instructions[0].distanceFromPreviousMeters,
      ),
    ).toMatch(/^Continúa recto por/);
  });

  it('classifies right, left, slight and U turns from heading changes', () => {
    const routes: Array<{
      route: RoadCoordinates[];
      expected: string;
    }> = [
      {
        route: [
          [-89.3, 13.7],
          [-89.3, 13.701],
          [-89.299, 13.701],
        ],
        expected: 'turn-right',
      },
      {
        route: [
          [-89.3, 13.7],
          [-89.3, 13.701],
          [-89.301, 13.701],
        ],
        expected: 'turn-left',
      },
      {
        route: [
          [-89.3, 13.7],
          [-89.3, 13.701],
          [-89.2995, 13.702],
        ],
        expected: 'slight-right',
      },
      {
        route: [
          [-89.3, 13.7],
          [-89.3, 13.701],
          [-89.3001, 13.7],
        ],
        expected: 'u-turn',
      },
    ];

    for (const { route, expected } of routes) {
      expect(generateNavigationInstructions(route)[1]?.type).toBe(expected);
    }
  });

  it('filters small curved geometry and nearby duplicate maneuvers', () => {
    const route: RoadCoordinates[] = [
      [-89.3, 13.7],
      [-89.2997, 13.70002],
      [-89.2994, 13.70006],
      [-89.2991, 13.70012],
      [-89.2988, 13.7002],
    ];

    expect(generateNavigationInstructions(route)).toHaveLength(2);
  });

  it('tracks the next maneuver and marks off-route positions', () => {
    const route: RoadCoordinates[] = [
      [-89.3, 13.7],
      [-89.3, 13.701],
      [-89.299, 13.701],
      [-89.298, 13.701],
    ];
    const instructions = generateNavigationInstructions(route);
    const onRoute = navigationProgress([-89.3, 13.7005], route, instructions);
    const offRoute = navigationProgress([-89.29, 13.71], route, instructions);

    expect(onRoute.nextInstruction?.type).toBe('turn-right');
    expect(onRoute.distanceToNextInstructionMeters).toBeGreaterThan(0);
    expect(onRoute.offRoute).toBe(false);
    expect(onRoute.immediateCoordinates.length).toBeGreaterThan(1);
    expect(offRoute.offRoute).toBe(true);
  });

  it('derives heading, maneuver and immediate segment from one route segment', () => {
    const route: RoadCoordinates[] = [
      [-89.3, 13.7],
      [-89.3, 13.701],
      [-89.301, 13.701],
    ];
    const instructions = generateNavigationInstructions(route);
    const progress = navigationProgress(
      [-89.2995, 13.7005],
      route,
      instructions,
      0,
      0,
    );

    expect(progress.activeNavigation?.routeSegmentIndex).toBe(0);
    expect(progress.activeNavigation?.requiresRejoin).toBe(true);
    expect(progress.activeNavigation?.maneuverType).toBe('turn-left');
    expect(progress.rejoinCoordinates).toHaveLength(2);
    expect(progress.immediateCoordinates[0][0]).toBeCloseTo(-89.3, 4);
  });
});
