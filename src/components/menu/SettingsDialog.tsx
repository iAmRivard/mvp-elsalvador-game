import type { GraphicsQuality } from '../../config/game.config';
import type { RoadAssistMode } from '../../config/roadHandling.config';
import type { SteeringSensitivity } from '../../config/travel.config';
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

const steeringOptions: readonly {
  value: SteeringSensitivity;
  label: string;
}[] = [
  { value: 'low', label: 'Suave' },
  { value: 'medium', label: 'Equilibrada' },
  { value: 'high', label: 'Directa' },
];

const roadAssistOptions: readonly {
  value: RoadAssistMode;
  label: string;
}[] = [
  { value: 'off', label: 'Libre' },
  { value: 'soft', label: 'Suave' },
  { value: 'strong', label: 'Firme' },
];

export function SettingsDialog({
  open,
  onClose,
  allowTutorial = false,
}: SettingsDialogProps) {
  const graphicsQuality = useSettingsStore((state) => state.graphicsQuality);
  const reduceMotion = useSettingsStore((state) => state.reduceMotion);
  const ambientFog = useSettingsStore((state) => state.ambientFog);
  const steeringSensitivity = useSettingsStore(
    (state) => state.steeringSensitivity,
  );
  const roadAssistMode = useSettingsStore((state) => state.roadAssistMode);
  const audioMasterVolume = useSettingsStore(
    (state) => state.audioMasterVolume,
  );
  const audioEffectsVolume = useSettingsStore(
    (state) => state.audioEffectsVolume,
  );
  const audioMuted = useSettingsStore((state) => state.audioMuted);
  const reduceAudioEffects = useSettingsStore(
    (state) => state.reduceAudioEffects,
  );
  const setGraphicsQuality = useSettingsStore(
    (state) => state.setGraphicsQuality,
  );
  const setReduceMotion = useSettingsStore((state) => state.setReduceMotion);
  const setAmbientFog = useSettingsStore((state) => state.setAmbientFog);
  const setSteeringSensitivity = useSettingsStore(
    (state) => state.setSteeringSensitivity,
  );
  const setRoadAssistMode = useSettingsStore(
    (state) => state.setRoadAssistMode,
  );
  const setAudioMasterVolume = useSettingsStore(
    (state) => state.setAudioMasterVolume,
  );
  const setAudioEffectsVolume = useSettingsStore(
    (state) => state.setAudioEffectsVolume,
  );
  const setAudioMuted = useSettingsStore((state) => state.setAudioMuted);
  const setReduceAudioEffects = useSettingsStore(
    (state) => state.setReduceAudioEffects,
  );
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

        <fieldset className="steering-options">
          <legend>Sensibilidad de dirección</legend>
          <div>
            {steeringOptions.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="steering-sensitivity"
                  value={option.value}
                  checked={steeringSensitivity === option.value}
                  onChange={() => setSteeringSensitivity(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="steering-options road-assist-options">
          <legend>Asistencia de carretera</legend>
          <div>
            {roadAssistOptions.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="road-assist-mode"
                  value={option.value}
                  checked={roadAssistMode === option.value}
                  onChange={() => setRoadAssistMode(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="audio-options">
          <legend>Audio</legend>
          <label>
            <span>
              <strong>Volumen general</strong>
              <output>{Math.round(audioMasterVolume * 100)}%</output>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={audioMasterVolume}
              aria-label="Volumen general"
              onChange={(event) =>
                setAudioMasterVolume(event.currentTarget.valueAsNumber)
              }
            />
          </label>
          <label>
            <span>
              <strong>Volumen de efectos</strong>
              <output>{Math.round(audioEffectsVolume * 100)}%</output>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={audioEffectsVolume}
              aria-label="Volumen de efectos"
              onChange={(event) =>
                setAudioEffectsVolume(event.currentTarget.valueAsNumber)
              }
            />
          </label>
        </fieldset>

        <div className="settings-toggles">
          <label>
            <span>
              <strong>Silenciar audio</strong>
              <small>
                Mantiene tus niveles para cuando vuelvas a activarlo.
              </small>
            </span>
            <input
              type="checkbox"
              checked={audioMuted}
              onChange={(event) => setAudioMuted(event.target.checked)}
            />
          </label>
          <label>
            <span>
              <strong>Reducir efectos sonoros</strong>
              <small>Atenúa turbo, frenado, terreno y estática.</small>
            </span>
            <input
              type="checkbox"
              checked={reduceAudioEffects}
              onChange={(event) => setReduceAudioEffects(event.target.checked)}
            />
          </label>
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
