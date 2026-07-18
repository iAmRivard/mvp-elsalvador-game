import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chapterOneMissionIds } from '../src/data/chapter1';
import { missionById } from '../src/data/missions';
import { fuelStationById } from '../src/data/fuelStations';
import { initialMissionObjectiveProgress } from '../src/game/missions';
import { alignedRoadHeading } from '../src/roads/initialRoadPosition';
import {
  clearRouteRejoinRoadSource,
  setRouteRejoinRoadSource,
} from '../src/roads/routeRejoinRoadSource';
import { RoadSpatialIndex } from '../src/roads/spatialIndex';
import { useGameStore } from '../src/store/gameStore';
import { createRoadTestNetwork } from './roadTestNetwork';

const repeater = [-89.3175451, 13.6820687] as const;
const blockage = [-89.3592277, 13.7305749] as const;
let routeRejoinTestIndex: RoadSpatialIndex | null = null;

function reachRouteChoice(): void {
  useGameStore.setState({
    completedMissionIds: ['la-transmision'],
    telemetry: {
      ...useGameStore.getState().telemetry,
      longitude: repeater[0],
      latitude: repeater[1],
    },
  });
  useGameStore.getState().startMission('camino-hacia-santa-ana');
  useGameStore.getState().dismissRadioEvent();
  const player = {
    ...useGameStore.getState().telemetry,
    longitude: blockage[0],
    latitude: blockage[1],
    speedMetersPerSecond: 0,
  };
  useGameStore.getState().advanceActiveMission(player, false);
  useGameStore.getState().advanceActiveMission(player, true);
  useGameStore.getState().advanceActiveMission(player, true);
}

describe('estado de misiones y capítulo', () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  afterEach(() => {
    if (routeRejoinTestIndex) {
      clearRouteRejoinRoadSource(routeRejoinTestIndex);
      routeRejoinTestIndex = null;
    }
  });

  it('no notifica Zustand cuando la telemetría no cambió', () => {
    const state = useGameStore.getState();
    const listener = vi.fn();
    const unsubscribe = useGameStore.subscribe(listener);

    state.setTelemetry({
      longitude: state.telemetry.longitude,
      latitude: state.telemetry.latitude,
      heading: state.telemetry.heading,
      speedMetersPerSecond: state.telemetry.speedMetersPerSecond,
      fuel: state.telemetry.fuel,
      totalDistanceMeters: state.telemetry.totalDistanceMeters,
    });

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('inicia con evento narrativo, lo descarta y abandona la misión', () => {
    useGameStore.setState({ lastDiscoveredLocationId: 'san-salvador' });
    expect(useGameStore.getState().startMission('la-transmision')).toBe(true);
    expect(useGameStore.getState()).toMatchObject({
      activeMissionId: 'la-transmision',
      activeNarrativeEventId: 'radio-transmision-inicial',
      lastDiscoveredLocationId: null,
      isPaused: true,
    });

    useGameStore.getState().dismissNarrativeEvent();
    expect(useGameStore.getState().isPaused).toBe(false);
    useGameStore.getState().abandonMission();
    expect(useGameStore.getState().activeMissionId).toBeNull();
    expect(useGameStore.getState().activeMissionCompletedObjectiveIds).toEqual(
      [],
    );
  });

  it('completa La transmisión y entrega experiencia e historia', () => {
    useGameStore.getState().startMission('la-transmision');
    useGameStore.getState().dismissNarrativeEvent();
    useGameStore.getState().advanceActiveMission(
      {
        ...useGameStore.getState().telemetry,
        longitude: -89.191111,
        latitude: 13.6975,
      },
      true,
    );
    useGameStore.getState().advanceActiveMission(
      {
        ...useGameStore.getState().telemetry,
        longitude: -89.3175451,
        latitude: 13.6820687,
      },
      false,
    );
    const completion = useGameStore.getState().advanceActiveMission(
      {
        ...useGameStore.getState().telemetry,
        longitude: -89.3175451,
        latitude: 13.6820687,
      },
      true,
    );
    const state = useGameStore.getState();

    expect(completion).toEqual({
      missionId: 'la-transmision',
      fuelReward: 0,
    });
    expect(state.activeMissionId).toBeNull();
    expect(state.completedMissionIds).toContain('la-transmision');
    expect(state.experience).toBe(150);
    expect(state.unlockedStoryIds).toContain('registro-transmision-occidente');
  });

  it('entrega un registro durable como primera recompensa de interacción', () => {
    useGameStore.getState().startMission('la-transmision');
    useGameStore.getState().dismissNarrativeEvent();
    useGameStore.getState().advanceActiveMission(
      {
        ...useGameStore.getState().telemetry,
        longitude: -89.191111,
        latitude: 13.6975,
      },
      true,
    );

    const state = useGameStore.getState();
    expect(state.activeRadioEventId).toBe('radio-ruta-occidental');
    expect(state.unlockedStoryIds).toContain('radio-ruta-occidental');
    expect(state.storyLogEntries).toContainEqual(
      expect.objectContaining({
        id: 'radio:radio-ruta-occidental',
        type: 'radio',
      }),
    );
    expect(state.gameplayFeedback).toMatchObject({
      message: 'Registro de frecuencia guardado en la bitácora',
      tone: 'success',
    });

    useGameStore.getState().advanceActiveMission(state.telemetry, true);
    expect(
      useGameStore
        .getState()
        .storyLogEntries.filter(
          (entry) => entry.id === 'radio:radio-ruta-occidental',
        ),
    ).toHaveLength(1);
  });

  it('activa un cierre local y recalcula al inspeccionar el bloqueo', () => {
    useGameStore.setState({
      completedMissionIds: ['la-transmision'],
      telemetry: {
        ...useGameStore.getState().telemetry,
        longitude: -89.3175451,
        latitude: 13.6820687,
      },
    });
    expect(useGameStore.getState().startMission('camino-hacia-santa-ana')).toBe(
      true,
    );
    useGameStore.getState().dismissNarrativeEvent();
    const blockPlayer = {
      ...useGameStore.getState().telemetry,
      longitude: -89.3592277,
      latitude: 13.7305749,
    };
    useGameStore.getState().advanceActiveMission(blockPlayer, false);
    useGameStore.getState().advanceActiveMission(blockPlayer, true);

    expect(useGameStore.getState().temporarilyClosedRoadEdgeIds).toEqual([
      14_072,
    ]);
    expect(useGameStore.getState().missionRoute.recalculationRevision).toBe(1);
    expect(useGameStore.getState()).toMatchObject({
      activeRadioEventId: 'radio-bloqueo-confirmado',
      activeNarrativeEventId: null,
      isPaused: false,
    });
  });

  it('la radio normal queda registrada y no pausa la conducción', () => {
    useGameStore.setState({
      completedMissionIds: ['la-transmision'],
      telemetry: {
        ...useGameStore.getState().telemetry,
        longitude: repeater[0],
        latitude: repeater[1],
      },
    });
    expect(useGameStore.getState().startMission('camino-hacia-santa-ana')).toBe(
      true,
    );
    const state = useGameStore.getState();
    expect(state.activeRadioEventId).toBe('radio-camino-bloqueado');
    expect(state.activeNarrativeEventId).toBeNull();
    expect(state.isPaused).toBe(false);
    expect(
      state.storyLogEntries.some(
        (entry) =>
          entry.type === 'radio' &&
          entry.title === 'Advertencia en la carretera',
      ),
    ).toBe(true);
  });

  it('abre una elección real, la guarda y comienza el tiempo tras 3-2-1', () => {
    reachRouteChoice();
    expect(useGameStore.getState()).toMatchObject({
      activeMissionChoiceObjectiveId: 'elegir-ruta-secundaria',
      isPaused: true,
      missionTimerCountdownSeconds: 0,
    });
    expect(useGameStore.getState().selectMissionChoice('north')).toBe(true);
    let state = useGameStore.getState();
    expect(state.missionChoiceSelections).toEqual({
      'camino-hacia-santa-ana': 'north',
    });
    expect(state.activeMissionCompletedObjectiveIds).toContain(
      'elegir-ruta-secundaria',
    );
    expect(state.temporarilyClosedRoadEdgeIds).toContain(14_352);
    expect(state.missionTimerCountdownSeconds).toBe(3);
    expect(useGameStore.getState().selectMissionChoice('south')).toBe(false);

    useGameStore.getState().advanceActiveMission(state.telemetry, false, 1);
    state = useGameStore.getState();
    expect(state.missionTimerCountdownSeconds).toBe(2);
    expect(
      state.activeMissionObjectiveProgress['alcanzar-estacion-a-tiempo']
        .elapsedSeconds,
    ).toBe(0);
    useGameStore.getState().advanceActiveMission(state.telemetry, false, 2);
    state = useGameStore.getState();
    expect(state.missionTimerCountdownSeconds).toBe(0);
    expect(
      state.activeMissionObjectiveProgress['alcanzar-estacion-a-tiempo']
        .elapsedSeconds,
    ).toBe(0);
    useGameStore.getState().advanceActiveMission(state.telemetry, false, 1);
    expect(
      useGameStore.getState().activeMissionObjectiveProgress[
        'alcanzar-estacion-a-tiempo'
      ].elapsedSeconds,
    ).toBe(1);
    useGameStore.getState().openJournal('missions');
    useGameStore
      .getState()
      .advanceActiveMission(useGameStore.getState().telemetry, false, 2);
    expect(
      useGameStore.getState().activeMissionObjectiveProgress[
        'alcanzar-estacion-a-tiempo'
      ].elapsedSeconds,
    ).toBe(3);
    useGameStore.getState().setPaused(true);
    useGameStore
      .getState()
      .advanceActiveMission(useGameStore.getState().telemetry, false, 5);
    expect(
      useGameStore.getState().activeMissionObjectiveProgress[
        'alcanzar-estacion-a-tiempo'
      ].elapsedSeconds,
    ).toBe(3);
  });

  it('al fallar el tiempo reintenta desde antes de elegir la ruta', () => {
    reachRouteChoice();
    useGameStore.getState().selectMissionChoice('south');
    const state = useGameStore.getState();
    useGameStore.setState({
      missionTimerCountdownSeconds: 0,
      activeMissionObjectiveProgress: {
        ...state.activeMissionObjectiveProgress,
        'alcanzar-estacion-a-tiempo': {
          ...state.activeMissionObjectiveProgress['alcanzar-estacion-a-tiempo'],
          elapsedSeconds: 269.9,
          value: 269.9,
        },
      },
    });
    useGameStore
      .getState()
      .advanceActiveMission(useGameStore.getState().telemetry, false, 0.2);
    expect(useGameStore.getState().recoveryReason).toBe('timed-objective');
    expect(useGameStore.getState().retryFromCheckpoint()).toBe(true);
    expect(useGameStore.getState()).toMatchObject({
      recoveryReason: null,
      activeMissionChoiceObjectiveId: null,
      missionTimerCountdownSeconds: 0,
      missionChoiceSelections: {},
    });
    expect(useGameStore.getState().activeMissionCompletedObjectiveIds).toEqual([
      'llegar-al-bloqueo',
      'inspeccionar-bloqueo',
    ]);
    expect(
      useGameStore.getState().activeMissionObjectiveProgress[
        'alcanzar-estacion-a-tiempo'
      ].elapsedSeconds,
    ).toBe(0);
  });

  it('daña el vehículo al comenzar y consume la pieza al repararlo', () => {
    useGameStore.setState({
      completedMissionIds: chapterOneMissionIds.slice(0, 3),
      telemetry: {
        ...useGameStore.getState().telemetry,
        longitude: -89.447361,
        latitude: 13.8408999,
      },
      inventory: [{ itemId: 'rele-encendido', quantity: 1 }],
    });
    expect(
      useGameStore.getState().startMission('reparacion-de-emergencia'),
    ).toBe(true);
    expect(useGameStore.getState().vehicle.condition).toBe(55);
    expect(useGameStore.getState().lastCheckpoint.vehicle.condition).toBe(55);
    useGameStore.getState().dismissNarrativeEvent();

    const completion = useGameStore.getState().advanceActiveMission(
      {
        ...useGameStore.getState().telemetry,
        longitude: -89.447361,
        latitude: 13.8408999,
      },
      true,
    );

    expect(completion?.missionId).toBe('reparacion-de-emergencia');
    expect(useGameStore.getState().vehicle.condition).toBe(100);
    expect(useGameStore.getState().inventory).toEqual([]);
    expect(useGameStore.getState().energy).toBe(90);
  });

  it('marca el capítulo, crea checkpoint y revela Cerro Verde al final', () => {
    const mission = missionById.get('secreto-de-coatepeque')!;
    useGameStore.setState({
      completedMissionIds: chapterOneMissionIds.slice(0, 5),
      activeMissionId: mission.id,
      activeMissionCompletedObjectiveIds: [
        'llegar-a-coatepeque',
        'mirador-norte',
        'ribera-este',
        'ribera-sur',
      ],
      activeMissionObjectiveProgress: initialMissionObjectiveProgress(mission),
      telemetry: {
        ...useGameStore.getState().telemetry,
        longitude: -89.5741276,
        latitude: 13.9043351,
        fuel: 50,
      },
      vehicle: {
        ...useGameStore.getState().vehicle,
        fuel: 50,
      },
    });

    const completion = useGameStore
      .getState()
      .advanceActiveMission(useGameStore.getState().telemetry, true);
    const state = useGameStore.getState();

    expect(completion?.missionId).toBe('secreto-de-coatepeque');
    expect(state.completedChapterIds).toContain('chapter-1');
    expect(state.unlockedLocationIds).toContain('cerro-verde');
    expect(state.lastCheckpoint.reason).toBe('chapter');
    expect(state.lastSafeCheckpoint.reason).toBe('chapter');
    expect(state.activeNarrativeEventId).toBe('final-senal-occidente');
    expect(state.isPaused).toBe(true);
  });

  it('tracks manual route recalculation without persisting graph data', () => {
    expect(useGameStore.getState().missionRoute.recalculationRevision).toBe(0);
    useGameStore.getState().requestMissionRouteRecalculation();
    expect(useGameStore.getState().missionRoute.recalculationRevision).toBe(1);

    useGameStore.getState().setMissionRoute({
      status: 'road',
      distanceMeters: 52_000,
      estimatedGameDurationSeconds: 520,
      coordinateCount: 240,
      activeEdgeIds: [4, 9],
      instructions: [],
      nextInstruction: null,
      distanceToNextInstructionMeters: null,
      offRoute: false,
    });
    expect(useGameStore.getState().missionRoute).toMatchObject({
      status: 'road',
      coordinateCount: 240,
      activeEdgeIds: [4, 9],
      recalculationRevision: 1,
    });
  });

  it('reincorpora de forma atómica sin perder misión ni recursos', () => {
    const network = createRoadTestNetwork();
    const index = new RoadSpatialIndex(network);
    routeRejoinTestIndex = index;
    const edgesById = new Map(network.edges.map((edge) => [edge.id, edge]));
    setRouteRejoinRoadSource({ index, edgesById });
    useGameStore.getState().startMission('la-transmision');
    useGameStore.getState().dismissNarrativeEvent();
    useGameStore.getState().addInventoryItem('bidon-combustible', 1);
    useGameStore.setState((state) => ({
      onboardingState: 'completed',
      telemetry: {
        ...state.telemetry,
        longitude: -89.2995,
        latitude: 13.7008,
        heading: 260,
        speedMetersPerSecond: 0,
        speedKilometersPerHour: 0,
        totalDistanceMeters: 321,
      },
      driving: {
        ...state.driving,
        roadNetworkStatus: 'ready',
        surface: 'offroad',
      },
      missionRoute: { ...state.missionRoute, status: 'calculating' },
      isFollowingPlayer: false,
    }));
    const before = useGameStore.getState();
    const eligibility = before.getRouteRejoinEligibility();
    expect(eligibility.eligible).toBe(true);
    if (!eligibility.eligible)
      throw new Error('Expected a safe road candidate');

    expect(before.rejoinPlayerToRoad(999_999)).toBe(false);
    expect(useGameStore.getState().telemetry).toBe(before.telemetry);
    expect(useGameStore.getState().lastCheckpoint).toBe(before.lastCheckpoint);

    clearRouteRejoinRoadSource(index);
    expect(before.rejoinPlayerToRoad(eligibility.candidate.edgeId)).toBe(false);
    expect(useGameStore.getState().telemetry).toBe(before.telemetry);
    setRouteRejoinRoadSource({ index, edgesById });

    expect(before.rejoinPlayerToRoad(eligibility.candidate.edgeId)).toBe(true);

    const state = useGameStore.getState();
    expect(state.telemetry).toMatchObject({
      longitude: eligibility.candidate.coordinates[0],
      latitude: eligibility.candidate.coordinates[1],
      heading: alignedRoadHeading(
        before.telemetry.heading,
        eligibility.candidate.heading,
        eligibility.candidate.oneWay,
      ),
      speedMetersPerSecond: 0,
      fuel: before.telemetry.fuel,
      totalDistanceMeters: 321,
    });
    expect(state.vehicle).toEqual(before.vehicle);
    expect(state.inventory).toEqual(before.inventory);
    expect(state.activeMissionId).toBe(before.activeMissionId);
    expect(state.activeMissionCompletedObjectiveIds).toEqual(
      before.activeMissionCompletedObjectiveIds,
    );
    expect(state.playerRuntimeRevision).toBe(before.playerRuntimeRevision + 1);
    expect(state.missionRoute.recalculationRevision).toBe(
      before.missionRoute.recalculationRevision + 1,
    );
    expect(state.isFollowingPlayer).toBe(true);
    expect(state.lastCheckpoint.reason).toBe('rejoin');
    expect(state.lastSafeCheckpoint.reason).toBe('rejoin');
    expect(state.gameplayFeedback).toMatchObject({
      message: 'Vehículo reincorporado a la ruta',
      tone: 'success',
    });
  });

  it('prioriza una estación temporal sin borrar la misión activa', () => {
    useGameStore.getState().startMission('la-transmision');
    const revision = useGameStore.getState().missionRoute.recalculationRevision;

    expect(
      useGameStore
        .getState()
        .markFuelStationRoute('abastecimiento-las-delicias'),
    ).toBe(true);
    expect(useGameStore.getState()).toMatchObject({
      activeMissionId: 'la-transmision',
      navigationTarget: {
        kind: 'fuel-station',
        id: 'abastecimiento-las-delicias',
      },
    });
    expect(useGameStore.getState().missionRoute.recalculationRevision).toBe(
      revision + 1,
    );

    useGameStore.getState().clearNavigationTarget();
    expect(useGameStore.getState().activeMissionId).toBe('la-transmision');
    expect(useGameStore.getState().navigationTarget).toBeNull();
  });

  it('recarga 45% detenida, crea checkpoint seguro y restaura la misión', () => {
    const station = fuelStationById.get('abastecimiento-las-delicias')!;
    useGameStore.setState((state) => ({
      activeMissionId: 'la-transmision',
      telemetry: {
        ...state.telemetry,
        longitude: station.coordinates[0],
        latitude: station.coordinates[1],
        speedMetersPerSecond: 0,
        speedKilometersPerHour: 0,
        fuel: 20,
      },
      vehicle: { ...state.vehicle, fuel: 20 },
    }));
    useGameStore.getState().markFuelStationRoute(station.id);

    expect(useGameStore.getState().refuelAtStation(station.id)).toBe(true);
    expect(useGameStore.getState()).toMatchObject({
      activeMissionId: 'la-transmision',
      navigationTarget: null,
      telemetry: { fuel: 65 },
      vehicle: { fuel: 65 },
      lastCheckpoint: { reason: 'fuel-station' },
      lastSafeCheckpoint: { reason: 'fuel-station' },
    });
  });

  it('exige detenerse para recargar', () => {
    const station = fuelStationById.get('abastecimiento-las-delicias')!;
    useGameStore.setState((state) => ({
      telemetry: {
        ...state.telemetry,
        longitude: station.coordinates[0],
        latitude: station.coordinates[1],
        speedMetersPerSecond: 1,
        speedKilometersPerHour: 3.6,
        fuel: 20,
      },
      vehicle: { ...state.vehicle, fuel: 20 },
    }));

    expect(useGameStore.getState().refuelAtStation(station.id)).toBe(false);
    expect(useGameStore.getState().telemetry.fuel).toBe(20);
    expect(useGameStore.getState().gameplayFeedback?.message).toBe(
      'Detén el vehículo para recargar',
    );
  });

  it('usa un bidón desde el softlock de 0% y reanuda la partida', () => {
    useGameStore.setState((state) => ({
      telemetry: { ...state.telemetry, fuel: 0 },
      vehicle: { ...state.vehicle, fuel: 0 },
      inventory: [{ itemId: 'bidon-combustible', quantity: 1 }],
      recoveryReason: 'fuel',
      isPaused: true,
    }));

    expect(useGameStore.getState().useFuelCanister()).toBe(true);
    expect(useGameStore.getState()).toMatchObject({
      telemetry: { fuel: 30 },
      vehicle: { fuel: 30 },
      inventory: [],
      recoveryReason: null,
      isPaused: false,
    });
  });

  it('restaura vehículo, inventario y misión desde el último checkpoint', () => {
    const store = useGameStore.getState();
    store.startMission('la-transmision');
    store.dismissNarrativeEvent();
    store.addInventoryItem('bidon-combustible', 2);
    store.createCheckpoint('objective');

    useGameStore.getState().consumeInventoryItem('bidon-combustible', 1);
    useGameStore.getState().setRoadNetworkStatus('ready');
    useGameStore.getState().applyDrivingWear(4_100, 'offroad', false);
    expect(useGameStore.getState()).toMatchObject({
      recoveryReason: 'condition',
      isPaused: true,
    });

    expect(useGameStore.getState().retryFromCheckpoint()).toBe(true);
    expect(useGameStore.getState().vehicle.condition).toBe(100);
    expect(useGameStore.getState().inventory).toEqual([
      { itemId: 'bidon-combustible', quantity: 2 },
    ]);
    expect(useGameStore.getState().activeMissionId).toBe('la-transmision');
    expect(useGameStore.getState().recoveryReason).toBeNull();
    expect(useGameStore.getState().isPaused).toBe(false);
  });

  it('permite abandonar la misión y volver al último lugar seguro', () => {
    useGameStore.getState().startMission('la-transmision');
    useGameStore.getState().dismissNarrativeEvent();
    useGameStore.getState().setTelemetry({
      ...useGameStore.getState().telemetry,
      fuel: 0,
    });

    expect(useGameStore.getState().recoveryReason).toBe('fuel');
    useGameStore.getState().togglePaused();
    expect(useGameStore.getState().isPaused).toBe(true);

    expect(useGameStore.getState().recoverAtLastSafeCheckpoint(true)).toBe(
      true,
    );
    expect(useGameStore.getState().activeMissionId).toBeNull();
    expect(useGameStore.getState().telemetry.fuel).toBe(75);
    expect(useGameStore.getState().recoveryReason).toBeNull();
  });

  it('aplica reparación de emergencia si el checkpoint seguro también está averiado', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      experience: 650,
      recoveryReason: 'condition',
      isPaused: true,
      vehicle: { ...state.vehicle, condition: 0 },
      lastSafeCheckpoint: {
        ...state.lastSafeCheckpoint,
        vehicle: { ...state.lastSafeCheckpoint.vehicle, condition: 0 },
        inventory: [{ itemId: 'bidon-combustible', quantity: 2 }],
      },
    });

    expect(useGameStore.getState().recoverAtLastSafeCheckpoint()).toBe(true);
    expect(useGameStore.getState()).toMatchObject({
      experience: 650,
      vehicle: { condition: 35 },
      inventory: [{ itemId: 'bidon-combustible', quantity: 2 }],
      recoveryReason: null,
      isPaused: false,
    });
  });

  it('activa recuperación al encontrar el límite jugable', () => {
    useGameStore.getState().setDrivingEnvironment({
      surface: 'offroad',
      speedMultiplier: 0.25,
      fuelMultiplier: 1.75,
      roadDistanceMeters: null,
      movementBlockedBy: 'out-of-bounds',
    });

    expect(useGameStore.getState()).toMatchObject({
      recoveryReason: 'out-of-bounds',
      isPaused: true,
    });
  });

  it('aplica la durabilidad al desgaste y a los impactos', () => {
    useGameStore.getState().setRoadNetworkStatus('ready');
    useGameStore.getState().applyDrivingWear(0, 'offroad', true, 1);
    const fullImpactDamage = 100 - useGameStore.getState().vehicle.condition;

    useGameStore.setState((state) => ({
      vehicle: { ...state.vehicle, condition: 100 },
    }));
    useGameStore.getState().applyDrivingWear(0, 'offroad', true, 0.5);
    const durableImpactDamage = 100 - useGameStore.getState().vehicle.condition;

    expect(durableImpactDamage).toBeCloseTo(fullImpactDamage * 0.5, 8);
  });
});
