import { useEffect } from 'react';
import { narrativeEventById } from '../../data/chapter1';
import { useGameStore } from '../../store/gameStore';

const AUTO_CLOSE_MILLISECONDS = 12_000;

export function RadioMessageOverlay() {
  const eventId = useGameStore((state) => state.activeRadioEventId);
  const dismiss = useGameStore((state) => state.dismissRadioEvent);
  const requestStoryLog = useGameStore((state) => state.requestStoryLog);
  const event = eventId ? narrativeEventById.get(eventId) : null;

  useEffect(() => {
    if (!event) return;
    const timer = window.setTimeout(dismiss, AUTO_CLOSE_MILLISECONDS);
    return () => window.clearTimeout(timer);
  }, [dismiss, event]);

  if (!event || event.presentation !== 'radio') return null;

  return (
    <div className="radio-overlay" aria-live="polite">
      <aside className="radio-message" role="status">
        <header>
          <span aria-hidden="true">◉</span>
          <div>
            <small>{event.channelLabel}</small>
            <strong>{event.title}</strong>
          </div>
          <button
            type="button"
            aria-label="Cerrar transmisión"
            onClick={dismiss}
          >
            ×
          </button>
        </header>
        <span className="radio-message__speaker">{event.speaker}</span>
        <p>{event.message}</p>
        {event.objectiveSummary && (
          <p className="radio-message__objective">
            <strong>Objetivo:</strong>{' '}
            {event.objectiveSummary.replace(/^Objetivo:\s*/i, '')}
          </p>
        )}
        <footer>
          <button
            type="button"
            onClick={() => {
              requestStoryLog('transmissions');
              dismiss();
            }}
          >
            Bitácora
          </button>
          <button type="button" onClick={dismiss}>
            Cerrar
          </button>
        </footer>
      </aside>
    </div>
  );
}
