import { useGameStore } from '../../store/gameStore';

const recoveryCopy = {
  fuel: {
    title: 'Sin combustible',
    description: 'El vehículo no puede continuar desde esta posición.',
  },
  condition: {
    title: 'Vehículo averiado',
    description:
      'La condición del vehículo llegó a 0%. Regresa al último punto seguro para continuar.',
  },
  'timed-objective': {
    title: 'La señal se perdió',
    description:
      'No llegaste a la estación antes de que terminara la transmisión. Puedes volver al checkpoint anterior a la elección y probar otra ruta.',
  },
  'out-of-bounds': {
    title: 'Fuera del área segura',
    description: 'La expedición necesita volver a una posición válida.',
  },
} as const;

export function VehicleRecoveryDialog() {
  const reason = useGameStore((state) => state.recoveryReason);
  const activeMissionId = useGameStore((state) => state.activeMissionId);
  const retryFromCheckpoint = useGameStore(
    (state) => state.retryFromCheckpoint,
  );
  const recoverAtSafe = useGameStore(
    (state) => state.recoverAtLastSafeCheckpoint,
  );
  if (!reason) return null;
  const copy = recoveryCopy[reason];

  return (
    <div className="confirm-dialog-backdrop recovery-dialog-backdrop">
      <section
        className="confirm-dialog recovery-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="recovery-title"
        aria-describedby="recovery-description"
      >
        <span className="paused-label">JUEGO EN PAUSA</span>
        <span className="confirm-dialog__eyebrow">Recuperación</span>
        <h2 id="recovery-title">{copy.title}</h2>
        <p id="recovery-description">{copy.description}</p>
        <div>
          <button
            type="button"
            onClick={() =>
              reason === 'condition'
                ? recoverAtSafe(false)
                : retryFromCheckpoint()
            }
          >
            {reason === 'condition'
              ? 'Recuperar vehículo'
              : 'Reintentar checkpoint'}
          </button>
          {reason !== 'condition' && (
            <button type="button" onClick={() => recoverAtSafe(false)}>
              Último lugar seguro
            </button>
          )}
          {activeMissionId && (
            <button
              type="button"
              className="confirm-dialog__danger"
              onClick={() => recoverAtSafe(true)}
            >
              Abandonar misión
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
