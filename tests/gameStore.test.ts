import { beforeEach, describe, expect, it } from 'vitest';
import { chapterOneMissionIds } from '../src/data/chapter1';
import { missionById } from '../src/data/missions';
import { initialMissionObjectiveProgress } from '../src/game/missions';
import { useGameStore } from '../src/store/gameStore';

describe('estado de misiones y capítulo', () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  it('inicia con evento narrativo, lo descarta y abandona la misión', () => {
    expect(useGameStore.getState().startMission('la-transmision')).toBe(true);
    expect(useGameStore.getState()).toMatchObject({
      activeMissionId: 'la-transmision',
      activeNarrativeEventId: 'radio-transmision-inicial',
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
      activeNarrativeEventId: 'radio-bloqueo-confirmado',
      isPaused: true,
    });
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

  it('restaura vehículo, inventario y misión desde el último checkpoint', () => {
    const store = useGameStore.getState();
    store.startMission('la-transmision');
    store.dismissNarrativeEvent();
    store.addInventoryItem('bidon-combustible', 2);
    store.createCheckpoint('objective');

    useGameStore.getState().consumeInventoryItem('bidon-combustible', 1);
    useGameStore.getState().applyDrivingWear(3_000, 'offroad', false);
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
    expect(useGameStore.getState().telemetry.fuel).toBe(100);
    expect(useGameStore.getState().recoveryReason).toBeNull();
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
});
