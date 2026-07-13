import { useGameStore } from '../../store/gameStore';
import { experienceProgress } from '../../game/progression';

const compassPoints = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] as const;

function compassPoint(heading: number): string {
  return compassPoints[Math.round(heading / 45) % compassPoints.length];
}

export function PlayerHud() {
  const telemetry = useGameStore((state) => state.telemetry);
  const isFollowingPlayer = useGameStore((state) => state.isFollowingPlayer);
  const discoveredCount = useGameStore(
    (state) => state.discoveredLocationIds.length,
  );
  const experience = useGameStore((state) => state.experience);
  const level = useGameStore((state) => state.level);
  const energy = useGameStore((state) => state.energy);
  const maxEnergy = useGameStore((state) => state.maxEnergy);
  const progress = experienceProgress(experience);

  return (
    <>
      <aside
        className={`player-hud ${telemetry.fuel <= 20 ? 'player-hud--fuel-low' : ''} ${telemetry.fuel <= 10 ? 'player-hud--fuel-critical' : ''}`}
        aria-label="Estado del jugador"
      >
        <div className="progress-readout">
          <div className="level-badge" aria-label={`Nivel ${level}`}>
            <span>Nivel</span>
            <strong>{level}</strong>
          </div>
          <div className="experience-readout">
            <div>
              <span>Experiencia</span>
              <strong>
                {progress.experienceIntoLevel} /{' '}
                {progress.experienceForNextLevel} XP
              </strong>
            </div>
            <div
              className="experience-meter"
              role="progressbar"
              aria-label="Progreso al siguiente nivel"
              aria-valuemin={0}
              aria-valuemax={progress.experienceForNextLevel}
              aria-valuenow={progress.experienceIntoLevel}
            >
              <span style={{ width: `${progress.ratio * 100}%` }} />
            </div>
            <small>
              Energía {energy.toFixed(0)} / {maxEnergy.toFixed(0)}
            </small>
          </div>
        </div>

        <div className="player-hud__primary">
          <div>
            <span className="hud-label">Velocidad</span>
            <strong data-testid="player-speed">
              {telemetry.speedKilometersPerHour.toFixed(0)}
            </strong>
            <small>km/h</small>
          </div>
          <div
            className="heading-readout"
            aria-label={`Rumbo ${telemetry.heading.toFixed(0)} grados`}
          >
            <span className="heading-readout__arrow" aria-hidden="true">
              ↑
            </span>
            <strong>{compassPoint(telemetry.heading)}</strong>
            <small>{telemetry.heading.toFixed(0)}°</small>
          </div>
        </div>

        <div className="fuel-readout">
          <div className="fuel-readout__header">
            <span className="hud-label">Combustible</span>
            <strong>{telemetry.fuel.toFixed(1)}%</strong>
          </div>
          <div
            className="fuel-meter"
            role="meter"
            aria-label="Combustible restante"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(telemetry.fuel)}
          >
            <span style={{ width: `${telemetry.fuel}%` }} />
          </div>
          {telemetry.fuel <= 20 && (
            <small className="fuel-warning" role="status">
              {telemetry.fuel <= 10
                ? 'Combustible crítico'
                : 'Combustible bajo'}
            </small>
          )}
        </div>

        <dl className="telemetry-grid">
          <div>
            <dt>Posición</dt>
            <dd data-testid="player-position">
              {telemetry.latitude.toFixed(5)}, {telemetry.longitude.toFixed(5)}
            </dd>
          </div>
          <div>
            <dt>Recorrido</dt>
            <dd>{(telemetry.totalDistanceMeters / 1000).toFixed(2)} km</dd>
          </div>
          <div>
            <dt>Cámara</dt>
            <dd>{isFollowingPlayer ? 'Siguiendo' : 'Libre'}</dd>
          </div>
          <div>
            <dt>Descubiertos</dt>
            <dd>{discoveredCount} / 12</dd>
          </div>
        </dl>
      </aside>
    </>
  );
}
