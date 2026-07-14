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

  if (!event) return null;

  return (
    <div className="narrative-backdrop">
      <section
        className="narrative-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="narrative-title"
        aria-describedby="narrative-message"
      >
        <div className="narrative-signal" aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
        <span className="narrative-dialog__channel">{event.channel}</span>
        <h2 id="narrative-title">{event.title}</h2>
        <strong>{event.speaker}</strong>
        <p id="narrative-message">{event.message}</p>
        <button ref={actionRef} type="button" onClick={dismiss}>
          {event.actionLabel}
        </button>
      </section>
    </div>
  );
}
