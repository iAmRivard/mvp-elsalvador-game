import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

const mobileControlsQuery =
  '(hover: none), (pointer: coarse), (max-width: 600px)';

export function RecommendedControlsPrompt() {
  const [mobileContext, setMobileContext] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(mobileControlsQuery).matches
      : false,
  );
  const controlMode = useSettingsStore((state) => state.controlMode);
  const dismissed = useSettingsStore(
    (state) => state.targetSpeedJoystickPromptDismissed,
  );
  const setMobileControlMode = useSettingsStore(
    (state) => state.setMobileControlMode,
  );
  const setDismissed = useSettingsStore(
    (state) => state.setTargetSpeedJoystickPromptDismissed,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia(mobileControlsQuery);
    const update = () => setMobileContext(mediaQuery.matches);
    mediaQuery.addEventListener('change', update);
    update();
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  if (!mobileContext || dismissed || controlMode === 'target-speed-joystick') {
    return null;
  }

  return (
    <div className="controls-migration-backdrop">
      <section
        className="controls-migration"
        role="dialog"
        aria-modal="true"
        aria-labelledby="controls-migration-title"
      >
        <span>Nuevo control móvil</span>
        <h2 id="controls-migration-title">Velocidad objetivo</h2>
        <p>
          Ajusta la velocidad con el joystick y suéltalo para mantener la
          marcha.
        </p>
        <div>
          <button
            type="button"
            onClick={() => setMobileControlMode('target-speed-joystick')}
          >
            Probar
          </button>
          <button type="button" onClick={() => setDismissed(true)}>
            Mantener controles actuales
          </button>
        </div>
      </section>
    </div>
  );
}
