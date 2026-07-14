import { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';

export function GameplayToast() {
  const toast = useGameStore((state) => state.gameplayFeedback);
  const dismiss = useGameStore((state) => state.dismissGameplayFeedback);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(dismiss, 3_200);
    return () => window.clearTimeout(timer);
  }, [dismiss, toast]);

  if (!toast) return null;
  return (
    <div
      className={`gameplay-toast gameplay-toast--${toast.tone}`}
      role="status"
    >
      {toast.message}
    </div>
  );
}
