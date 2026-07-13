import { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';

export function LevelUpToast() {
  const level = useGameStore((state) => state.lastLevelUp);
  const dismiss = useGameStore((state) => state.dismissLevelUp);

  useEffect(() => {
    if (!level) return;
    const timeout = window.setTimeout(dismiss, 6_000);
    return () => window.clearTimeout(timeout);
  }, [dismiss, level]);

  if (!level) return null;
  return (
    <aside className="level-toast" role="status" aria-live="polite">
      <span aria-hidden="true">↑</span>
      <div>
        <small>Progreso alcanzado</small>
        <strong>Nivel {level}</strong>
      </div>
      <button
        type="button"
        aria-label="Cerrar subida de nivel"
        onClick={dismiss}
      >
        ×
      </button>
    </aside>
  );
}
