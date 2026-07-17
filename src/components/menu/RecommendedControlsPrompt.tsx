import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';
import { onboardingIsActive } from '../../types/onboarding';

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
    (state) => state.arcadeDrivingPromptDismissed,
  );
  const setMobileControlMode = useSettingsStore(
    (state) => state.setMobileControlMode,
  );
  const setDismissed = useSettingsStore(
    (state) => state.setArcadeDrivingPromptDismissed,
  );
  const blockedByGameplayOverlay = useGameStore((state) =>
    Boolean(
      state.isPaused ||
        state.isJournalOpen ||
        state.recoveryReason ||
        state.activeNarrativeEventId ||
        state.activeRadioEventId ||
        state.activeMissionChoiceObjectiveId ||
        onboardingIsActive(state.onboardingState),
    ),
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia(mobileControlsQuery);
    const update = () => setMobileContext(mediaQuery.matches);
    mediaQuery.addEventListener('change', update);
    update();
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  if (
    !mobileContext ||
    dismissed ||
    controlMode === 'arcade-driving' ||
    blockedByGameplayOverlay
  ) {
    return null;
  }

  return (
    <aside
      className="controls-migration"
      role="status"
      aria-label="Nuevo control móvil"
      data-controls-migration="arcade"
    >
      <span>Nuevo control móvil</span>
      <h2>Conducción Arcade</h2>
      <p>
        Desliza hacia arriba para arrancar al instante y suelta para mantener
        la marcha.
      </p>
      <div>
        <button
          type="button"
          onClick={() => setMobileControlMode('arcade-driving')}
        >
          Probar
        </button>
        <button type="button" onClick={() => setDismissed(true)}>
          Mantener controles actuales
        </button>
      </div>
    </aside>
  );
}
