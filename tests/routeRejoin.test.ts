import { describe, expect, it } from 'vitest';
import {
  routeRejoinConfig,
  routeRejoinEligibilityFor,
  type RouteRejoinCandidate,
} from '../src/game/routeRejoin';

const candidate: RouteRejoinCandidate = {
  edgeId: 17,
  coordinates: [-89.1908, 13.6963],
  distanceMeters: 42,
  heading: 90,
  oneWay: false,
  restricted: false,
};

const eligibleInput = {
  gameActive: true,
  roadNetworkReady: true,
  surface: 'offroad' as const,
  speedKilometersPerHour: 0,
  paused: false,
  journalOpen: false,
  recoveryActive: false,
  narrativeActive: false,
  choiceActive: false,
  originRestricted: false,
  insideExplicitOffroadObjective: false,
  routeStatus: 'road' as const,
  temporarilyClosedEdgeIds: [] as readonly number[],
  candidates: [candidate] as readonly RouteRejoinCandidate[],
};

describe('reincorporación segura', () => {
  it('elige una vía cercana y no bloquea mientras la ruta calcula', () => {
    expect(routeRejoinConfig.maximumDistanceMeters).toBe(120);
    expect(
      routeRejoinEligibilityFor({
        ...eligibleInput,
        routeStatus: 'calculating',
      }),
    ).toEqual({ eligible: true, blockedBy: null, candidate });
  });

  it('rechaza vías demasiado lejanas o cerradas', () => {
    expect(
      routeRejoinEligibilityFor({
        ...eligibleInput,
        candidates: [{ ...candidate, distanceMeters: 120.01 }],
      }),
    ).toMatchObject({ eligible: false, blockedBy: 'road-too-far' });
    expect(
      routeRejoinEligibilityFor({
        ...eligibleInput,
        temporarilyClosedEdgeIds: [candidate.edgeId],
      }),
    ).toMatchObject({ eligible: false, blockedBy: 'closed-road' });
  });

  it('rechaza origen o destino restringido', () => {
    expect(
      routeRejoinEligibilityFor({ ...eligibleInput, originRestricted: true }),
    ).toMatchObject({ eligible: false, blockedBy: 'restricted-origin' });
    expect(
      routeRejoinEligibilityFor({
        ...eligibleInput,
        candidates: [{ ...candidate, restricted: true }],
      }),
    ).toMatchObject({ eligible: false, blockedBy: 'restricted-destination' });
  });

  it('protege objetivos offroad legítimos y elecciones narrativas', () => {
    expect(
      routeRejoinEligibilityFor({
        ...eligibleInput,
        insideExplicitOffroadObjective: true,
      }),
    ).toMatchObject({ eligible: false, blockedBy: 'offroad-objective' });
    expect(
      routeRejoinEligibilityFor({ ...eligibleInput, choiceActive: true }),
    ).toMatchObject({ eligible: false, blockedBy: 'blocking-overlay' });
  });

  it('solo aparece detenido y realmente fuera de carretera', () => {
    expect(
      routeRejoinEligibilityFor({
        ...eligibleInput,
        speedKilometersPerHour: 1.01,
      }),
    ).toMatchObject({ eligible: false, blockedBy: 'moving' });
    expect(
      routeRejoinEligibilityFor({
        ...eligibleInput,
        surface: 'road-unclassified',
      }),
    ).toMatchObject({ eligible: false, blockedBy: 'not-offroad' });
  });
});
