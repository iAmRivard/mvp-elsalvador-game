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
    (state) => state.recommendedControlsPromptDismissed,
  );
  const setMobileControlMode = useSettingsStore(
    (state) => state.setMobileControlMode,
  );
  const setDismissed = useSettingsStore(
    (state) => state.setRecommendedControlsPromptDismissed,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia(mobileControlsQuery);
    const update = () => setMobileContext(mediaQuery.matches);
    mediaQuery.addEventListener('change', update);
    update();
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  if (!mobileContext || dismissed || controlMode !== 'joystick-pedals') {
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
        <span>Nuevo control recomendado</span>
        <h2 id="controls-migration-title">Conduce con dos pulgares</h2>
        <p>
          Ahora puedes dirigir con el joystick y mantener la marcha con crucero,
          dejando el otro pulgar libre para frenar o usar Turbo.
        </p>
        <div>
          <button
            type="button"
            onClick={() => setMobileControlMode('joystick-auto-throttle')}
          >
            Activar
          </button>
          <button type="button" onClick={() => setDismissed(true)}>
            Mantener controles actuales
          </button>
        </div>
      </section>
    </div>
  );
}
