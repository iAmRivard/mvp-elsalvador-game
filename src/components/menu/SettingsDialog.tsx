import type { GraphicsQuality } from '../../config/game.config';
import { useSettingsStore } from '../../store/settingsStore';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  allowTutorial?: boolean;
}

const qualityOptions: readonly {
  value: GraphicsQuality;
  label: string;
  description: string;
}[] = [
  {
    value: 'low',
    label: 'Baja',
    description: 'Máxima fluidez y vehículo 2D',
  },
  {
    value: 'medium',
    label: 'Media',
    description: 'Vehículo 3D y carga equilibrada',
  },
  {
    value: 'high',
    label: 'Alta',
    description: 'Modelos 3D más visibles y suavizado',
  },
];

export function SettingsDialog({
  open,
  onClose,
  allowTutorial = false,
}: SettingsDialogProps) {
  const graphicsQuality = useSettingsStore((state) => state.graphicsQuality);
  const reduceMotion = useSettingsStore((state) => state.reduceMotion);
  const ambientFog = useSettingsStore((state) => state.ambientFog);
  const setGraphicsQuality = useSettingsStore(
    (state) => state.setGraphicsQuality,
  );
  const setReduceMotion = useSettingsStore((state) => state.setReduceMotion);
  const setAmbientFog = useSettingsStore((state) => state.setAmbientFog);
  const setTutorialSeen = useSettingsStore((state) => state.setTutorialSeen);
  if (!open) return null;

  return (
    <div className="settings-backdrop">
      <section
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <header>
          <div>
            <span>Preferencias locales</span>
            <h2 id="settings-title">Configuración</h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar configuración"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <fieldset className="quality-options">
          <legend>Calidad gráfica</legend>
          <div>
            {qualityOptions.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="graphics-quality"
                  value={option.value}
                  checked={graphicsQuality === option.value}
                  onChange={() => setGraphicsQuality(option.value)}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="settings-toggles">
          <label>
            <span>
              <strong>Reducir movimiento</strong>
              <small>Minimiza transiciones, pulsos y cámara animada.</small>
            </span>
            <input
              type="checkbox"
              checked={reduceMotion}
              onChange={(event) => setReduceMotion(event.target.checked)}
            />
          </label>
          <label>
            <span>
              <strong>Atmósfera misteriosa</strong>
              <small>Añade una neblina decorativa ligera sobre el mapa.</small>
            </span>
            <input
              type="checkbox"
              checked={ambientFog}
              onChange={(event) => setAmbientFog(event.target.checked)}
            />
          </label>
        </div>

        <footer>
          {allowTutorial && (
            <button
              type="button"
              className="settings-dialog__tutorial"
              onClick={() => {
                setTutorialSeen(false);
                onClose();
              }}
            >
              Ver tutorial otra vez
            </button>
          )}
          <button
            type="button"
            className="settings-dialog__done"
            onClick={onClose}
          >
            Listo
          </button>
        </footer>
      </section>
    </div>
  );
}
