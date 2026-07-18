import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearRouteRejoinRoadSource,
  setRouteRejoinRoadSource,
} from '../src/roads/routeRejoinRoadSource';
import { RoadSpatialIndex } from '../src/roads/spatialIndex';
import { useGameStore } from '../src/store/gameStore';
import type { RoadNetwork } from '../src/types/roads';
import { createRoadTestNetwork } from './roadTestNetwork';

let activeIndex: RoadSpatialIndex | null = null;

function installNetwork(network: RoadNetwork): void {
  activeIndex = new RoadSpatialIndex(network);
  setRouteRejoinRoadSource({
    index: activeIndex,
    edgesById: new Map(network.edges.map((edge) => [edge.id, edge])),
  });
}

function prepareOffroadState(
  longitude: number,
  latitude: number,
  overrides: Partial<ReturnType<typeof useGameStore.getState>> = {},
): void {
  useGameStore.setState((state) => ({
    onboardingState: 'completed',
    isPaused: false,
    isJournalOpen: false,
    activeNarrativeEventId: null,
    activeMissionChoiceObjectiveId: null,
    recoveryReason: null,
    telemetry: {
      ...state.telemetry,
      longitude,
      latitude,
      speedMetersPerSecond: 0,
      speedKilometersPerHour: 0,
    },
    driving: {
      ...state.driving,
      roadNetworkStatus: 'ready',
      surface: 'offroad',
    },
    ...overrides,
  }));
}

beforeEach(() => {
  useGameStore.setState(useGameStore.getInitialState(), true);
});

afterEach(() => {
  if (activeIndex) clearRouteRejoinRoadSource(activeIndex);
  activeIndex = null;
});

describe('derivación runtime de reincorporación', () => {
  it('bloquea una posición sin vías dentro de 120 metros', () => {
    installNetwork(createRoadTestNetwork());
    prepareOffroadState(-89.31, 13.71);

    expect(useGameStore.getState().getRouteRejoinEligibility()).toMatchObject({
      eligible: false,
      blockedBy: 'no-road',
    });
  });

  it('deriva el objetivo offroad legítimo desde la misión real', () => {
    prepareOffroadState(-89.025833, 13.936667, {
      activeMissionId: 'senales-en-suchitoto',
      activeMissionCompletedObjectiveIds: [],
    });

    expect(useGameStore.getState().getRouteRejoinEligibility()).toMatchObject({
      eligible: false,
      blockedBy: 'offroad-objective',
    });
  });

  it('deriva una zona restringida desde la geometría real', () => {
    prepareOffroadState(-89.546389, 13.863611);

    expect(useGameStore.getState().getRouteRejoinEligibility()).toMatchObject({
      eligible: false,
      blockedBy: 'restricted-origin',
    });
  });

  it('rechaza todas las vías cercanas cuando sus aristas están cerradas', () => {
    const network = createRoadTestNetwork();
    installNetwork(network);
    prepareOffroadState(-89.2995, 13.7008, {
      temporarilyClosedRoadEdgeIds: network.edges.map((edge) => edge.id),
    });

    expect(useGameStore.getState().getRouteRejoinEligibility()).toMatchObject({
      eligible: false,
      blockedBy: 'closed-road',
    });
  });

  it('rechaza una proyección vial que cae dentro del lago', () => {
    const network: RoadNetwork = {
      version: 1,
      generatedAt: '2026-07-17T00:00:00.000Z',
      sourceId: 'restricted-destination-test',
      bounds: [
        [-89.574, 13.863],
        [-89.571, 13.865],
      ],
      nodes: [
        { id: 0, coordinates: [-89.5725, 13.864] },
        { id: 1, coordinates: [-89.5715, 13.864] },
      ],
      edges: [
        {
          id: 0,
          from: 0,
          to: 1,
          coordinates: [
            [-89.5725, 13.864],
            [-89.5715, 13.864],
          ],
          distanceMeters: 108,
          roadClass: 'residential',
          oneWay: false,
          speedMultiplier: 0.65,
        },
      ],
    };
    installNetwork(network);
    prepareOffroadState(-89.5735, 13.864);

    expect(useGameStore.getState().getRouteRejoinEligibility()).toMatchObject({
      eligible: false,
      blockedBy: 'restricted-destination',
    });
  });
});
