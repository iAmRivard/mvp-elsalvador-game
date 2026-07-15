import { useEffect, useRef } from 'react';
import { narrativeEventById } from '../../data/chapter1';
import { useGameStore } from '../../store/gameStore';

const DRIVING_AUTO_CLOSE_MILLISECONDS = 10_000;

function RadioMessageContent() {
  const compactMessageRef = useRef<HTMLButtonElement>(null);
  const fullMessageRef = useRef<HTMLElement>(null);
  const eventId = useGameStore((state) => state.activeRadioEventId);
  const presentationMode = useGameStore((state) => state.presentationMode);
  const speedKilometersPerHour = useGameStore(
    (state) => state.telemetry.speedKilometersPerHour,
  );
  const dismiss = useGameStore((state) => state.dismissRadioEvent);
  const requestStoryLog = useGameStore((state) => state.requestStoryLog);
  const event = eventId ? narrativeEventById.get(eventId) : null;
  const renderCount = useRef(0);
  const compact =
    Math.abs(speedKilometersPerHour) >= 5 && presentationMode !== 'stopped';

  useEffect(() => {
    if (!event || !compact) return;
    const timer = window.setTimeout(dismiss, DRIVING_AUTO_CLOSE_MILLISECONDS);
    return () => window.clearTimeout(timer);
  }, [compact, dismiss, event]);

  useEffect(() => {
    renderCount.current += 1;
    const message = compactMessageRef.current ?? fullMessageRef.current;
    if (message) {
      message.dataset.renderCount = String(renderCount.current);
    }
  });

  if (!event || event.presentation !== 'radio') return null;

  if (compact) {
    return (
      <div className="radio-overlay radio-overlay--compact" aria-live="polite">
        <button
          ref={compactMessageRef}
          type="button"
          className="radio-message radio-message--compact"
          aria-label="Abrir transmisión en la bitácora"
          onClick={() => {
            requestStoryLog('transmissions');
            dismiss();
          }}
        >
          <strong>📻 RADIO · {event.channelLabel}</strong>
          <span>{event.message}</span>
          {event.objectiveSummary && (
            <small>
              {event.objectiveSummary.replace(/^Objetivo:\s*/i, '')}
            </small>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="radio-overlay" aria-live="polite">
      <aside ref={fullMessageRef} className="radio-message" role="status">
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

export function RadioMessageOverlay() {
  const isJournalOpen = useGameStore((state) => state.isJournalOpen);
  const activeRadioEventId = useGameStore((state) => state.activeRadioEventId);
  return isJournalOpen || !activeRadioEventId ? null : <RadioMessageContent />;
}
