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
    (state) => state.singleDriveJoystickPromptDismissed,
  );
  const setMobileControlMode = useSettingsStore(
    (state) => state.setMobileControlMode,
  );
  const setDismissed = useSettingsStore(
    (state) => state.setSingleDriveJoystickPromptDismissed,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia(mobileControlsQuery);
    const update = () => setMobileContext(mediaQuery.matches);
    mediaQuery.addEventListener('change', update);
    update();
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  if (!mobileContext || dismissed || controlMode === 'single-drive-joystick') {
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
        <span>Nuevo modo de conducción</span>
        <h2 id="controls-migration-title">Un joystick para conducir</h2>
        <p>Controla aceleración, freno y dirección con un solo joystick.</p>
        <div>
          <button
            type="button"
            onClick={() => setMobileControlMode('single-drive-joystick')}
          >
            Probar modo simple
          </button>
          <button type="button" onClick={() => setDismissed(true)}>
            Mantener controles actuales
          </button>
        </div>
      </section>
    </div>
  );
}
