import { describe, expect, it } from 'vitest';
import { missionById } from '../src/data/missions';
import {
  getRecommendedMission,
  missionBlockExplanation,
} from '../src/game/missionRecommendations';

const sanSalvador: [number, number] = [-89.191111, 13.6975];
const repeater: [number, number] = [-89.3175451, 13.6820687];
const santaAna: [number, number] = [-89.556667, 13.994722];

describe('recomendación de historia', () => {
  it('recomienda la primera misión y permite iniciarla en San Salvador', () => {
    expect(getRecommendedMission([], null, sanSalvador)).toMatchObject({
      missionId: 'la-transmision',
      reason: 'chapter-next',
      startLocationId: 'san-salvador',
      canStartNow: true,
    });
  });

  it('recomienda la siguiente misión principal y navega cuando está lejos', () => {
    const nearby = getRecommendedMission(['la-transmision'], null, repeater);
    const far = getRecommendedMission(['la-transmision'], null, santaAna);
    expect(nearby).toMatchObject({
      missionId: 'camino-hacia-santa-ana',
      canStartNow: true,
    });
    expect(far).toMatchObject({
      missionId: 'camino-hacia-santa-ana',
      canStartNow: false,
    });
    expect(far!.distanceToStartMeters).toBeGreaterThan(20_000);
  });

  it('una misión activa siempre tiene prioridad', () => {
    expect(
      getRecommendedMission(
        ['la-transmision'],
        'senales-en-suchitoto',
        sanSalvador,
      ),
    ).toMatchObject({
      missionId: 'senales-en-suchitoto',
      reason: 'resume',
    });
  });

  it('la opcional no reemplaza la historia principal', () => {
    expect(getRecommendedMission([], null, sanSalvador)?.missionId).toBe(
      'la-transmision',
    );
    expect(
      getRecommendedMission(
        [
          'la-transmision',
          'camino-hacia-santa-ana',
          'estacion-abandonada',
          'reparacion-de-emergencia',
          'llegada-a-santa-ana',
          'secreto-de-coatepeque',
        ],
        null,
        sanSalvador,
      ),
    ).toMatchObject({
      missionId: 'senales-en-suchitoto',
      reason: 'optional',
    });
  });

  it('explica por qué una misión permanece bloqueada', () => {
    const mission = missionById.get('estacion-abandonada')!;
    expect(missionBlockExplanation(mission, [], sanSalvador)).toBe(
      'Completa primero: Camino bloqueado',
    );
    expect(
      missionBlockExplanation(
        missionById.get('camino-hacia-santa-ana')!,
        ['la-transmision'],
        santaAna,
      ),
    ).toContain('Viaja a Repetidor de Las Delicias');
  });
});
