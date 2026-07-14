import { useEffect, useRef } from 'react';
import { narrativeEventById } from '../../data/chapter1';
import { useGameStore } from '../../store/gameStore';

export function NarrativeDialog() {
  const actionRef = useRef<HTMLButtonElement>(null);
  const eventId = useGameStore((state) => state.activeNarrativeEventId);
  const dismiss = useGameStore((state) => state.dismissNarrativeEvent);
  const event = eventId ? narrativeEventById.get(eventId) : null;

  useEffect(() => {
    if (event) actionRef.current?.focus({ preventScroll: true });
  }, [event]);

  if (!event || event.presentation === 'radio') return null;

  return (
    <div className="narrative-backdrop">
      <section
        className="narrative-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="narrative-title"
        aria-describedby="narrative-message"
      >
        <span className="paused-label">JUEGO EN PAUSA</span>
        <div className="narrative-signal" aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
        <span className="narrative-dialog__channel">{event.channelLabel}</span>
        <h2 id="narrative-title">{event.title}</h2>
        <strong>{event.speaker}</strong>
        <p id="narrative-message">{event.message}</p>
        {event.objectiveSummary && (
          <p className="narrative-dialog__objective">
            <strong>Objetivo:</strong>{' '}
            {event.objectiveSummary.replace(/^Objetivo:\s*/i, '')}
          </p>
        )}
        <button ref={actionRef} type="button" onClick={dismiss}>
          {event.actionLabel ?? 'Continuar'}
        </button>
      </section>
    </div>
  );
}
