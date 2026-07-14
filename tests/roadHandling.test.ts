import { describe, expect, it } from 'vitest';
import {
  roadConditionMultipliers,
  roadFuelMultipliers,
  roadSpeedMultipliers,
  roadSurfaceLabels,
} from '../src/config/roadHandling.config';
import { fuelConsumptionConfig } from '../src/config/travel.config';
import { restrictedAreaTypeAt } from '../src/data/restrictedAreas';
import { stepPlayerDetailed } from '../src/game/movement';
import { roadResultForEdge } from '../src/roads/spatialIndex';
import type { PlayerInput, PlayerRuntime } from '../src/types/game';
import type { RoadContact } from '../src/types/roads';
import { createRoadTestNetwork } from './roadTestNetwork';

const idleInput: PlayerInput = {
  throttle: 0,
  turn: 0,
  boost: false,
  interact: false,
};

function roadContact(player: PlayerRuntime, edgeIndex = 0): RoadContact {
  const edge = createRoadTestNetwork().edges[edgeIndex];
  const nearest = roadResultForEdge([player.longitude, player.latitude], edge);
  if (!nearest) throw new Error('Test edge has no geometry.');
  return { edge, nearest };
}

describe('road handling', () => {
  it('defines the requested speed and fuel multipliers for every surface', () => {
    expect(roadSpeedMultipliers).toMatchObject({
      motorway: 1.25,
      primary: 1,
      track: 0.5,
      'dirt-road': 0.5,
      offroad: 0.25,
    });
    expect(roadFuelMultipliers).toMatchObject({
      primary: 1,
      track: 1.35,
      'dirt-road': 1.35,
      offroad: 1.75,
    });
    expect(roadConditionMultipliers).toMatchObject({
      primary: 1,
      'dirt-road': 1.25,
      offroad: 1.75,
    });
    expect(roadSurfaceLabels['dirt-road']).toBe('Camino de tierra');
    expect(roadSurfaceLabels.offroad).toBe('Fuera de carretera');
  });

  it('treats a visible unpaved edge as dirt road instead of offroad', () => {
    const player: PlayerRuntime = {
      longitude: -89.2995,
      latitude: 13.7,
      heading: 90,
      speedMetersPerSecond: 5,
      fuel: 100,
      totalDistanceMeters: 0,
    };
    const contact = roadContact(player);
    contact.edge.surface = 'dirt-road';
    const result = stepPlayerDetailed(
      player,
      { ...idleInput, throttle: 1 },
      0.05,
      { roadNetworkEnabled: true, roadContact: contact },
    );

    expect(result.environment.surface).toBe('dirt-road');
    expect(result.environment.speedMultiplier).toBe(0.5);
    expect(result.environment.fuelMultiplier).toBe(1.35);
  });

  it('brakes toward the offroad limit and consumes 75 percent more fuel', () => {
    const player: PlayerRuntime = {
      longitude: -89.31,
      latitude: 13.71,
      heading: 0,
      speedMetersPerSecond: 20,
      fuel: 100,
      totalDistanceMeters: 0,
    };
    const result = stepPlayerDetailed(
      player,
      { ...idleInput, throttle: 1 },
      0.05,
      { roadNetworkEnabled: true, roadContact: null },
    );
    expect(result.environment.surface).toBe('offroad');
    expect(result.environment.speedMultiplier).toBe(0.25);
    expect(result.environment.fuelMultiplier).toBe(1.75);
    expect(result.player.speedMetersPerSecond).toBeCloseTo(19.3, 8);
    expect(result.player.fuel).toBeCloseTo(
      100 -
        result.player.totalDistanceMeters *
          fuelConsumptionConfig.percentPerGeographicMeter *
          1.75,
      10,
    );
  });

  it('turns and pulls gradually toward a nearby road in soft mode', () => {
    const player: PlayerRuntime = {
      longitude: -89.2995,
      latitude: 13.7001,
      heading: 45,
      speedMetersPerSecond: 10,
      fuel: 100,
      totalDistanceMeters: 0,
    };
    const contact = roadContact(player);
    const free = stepPlayerDetailed(player, idleInput, 0.05, {
      roadNetworkEnabled: true,
      roadContact: contact,
      roadAssistMode: 'off',
    });
    const assisted = stepPlayerDetailed(player, idleInput, 0.05, {
      roadNetworkEnabled: true,
      roadContact: contact,
      roadAssistMode: 'soft',
    });

    expect(assisted.player.heading).toBeGreaterThan(free.player.heading);
    expect(assisted.player.heading).toBeLessThan(90);
    expect(Math.abs(assisted.player.latitude - 13.7)).toBeLessThan(
      Math.abs(free.player.latitude - 13.7),
    );
    expect(assisted.player.latitude).not.toBe(13.7);
  });

  it('keeps road penalties active when steering assistance is disabled', () => {
    const player: PlayerRuntime = {
      longitude: -89.299,
      latitude: 13.70002,
      heading: 0,
      speedMetersPerSecond: 8,
      fuel: 100,
      totalDistanceMeters: 0,
    };
    const contact = roadContact(player, 2);
    const result = stepPlayerDetailed(
      player,
      { ...idleInput, throttle: 1 },
      0.05,
      {
        roadNetworkEnabled: true,
        roadContact: contact,
        roadAssistMode: 'off',
      },
    );

    expect(result.environment.surface).toBe('residential');
    expect(result.environment.speedMultiplier).toBe(0.65);
    expect(result.player.heading).toBe(0);
  });

  it('stops before entering Lake Coatepeque without consuming fuel or distance', () => {
    const player: PlayerRuntime = {
      longitude: -89.55,
      latitude: 13.89453,
      heading: 180,
      speedMetersPerSecond: 20,
      fuel: 50,
      totalDistanceMeters: 200,
    };
    expect(
      restrictedAreaTypeAt([player.longitude, player.latitude]),
    ).toBeNull();
    const result = stepPlayerDetailed(
      player,
      { ...idleInput, throttle: 1 },
      0.05,
      { restrictedAreaTypeAt },
    );

    expect(result.environment.movementBlockedBy).toBe('water');
    expect(result.player).toMatchObject({
      longitude: player.longitude,
      latitude: player.latitude,
      speedMetersPerSecond: 0,
      fuel: player.fuel,
      totalDistanceMeters: player.totalDistanceMeters,
    });
  });

  it('allows an old save inside a restricted polygon to move toward recovery', () => {
    const player: PlayerRuntime = {
      longitude: -89.55,
      latitude: 13.86,
      heading: 0,
      speedMetersPerSecond: 5,
      fuel: 50,
      totalDistanceMeters: 0,
    };
    expect(restrictedAreaTypeAt([player.longitude, player.latitude])).toBe(
      'water',
    );
    const result = stepPlayerDetailed(player, idleInput, 0.05, {
      restrictedAreaTypeAt,
    });
    expect(result.environment.movementBlockedBy).toBeNull();
    expect(result.player.latitude).toBeGreaterThan(player.latitude);
  });
});
