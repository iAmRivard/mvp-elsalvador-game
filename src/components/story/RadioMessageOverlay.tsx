import { useEffect, useRef, useState } from 'react';
import { narrativeEventById } from '../../data/chapter1';
import { useGameStore } from '../../store/gameStore';

export const RADIO_FULL_PREVIEW_MILLISECONDS = 4_500;

function mobileRadioViewport(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(max-width: 900px)').matches ||
      window.matchMedia('(pointer: coarse)').matches)
  );
}

function RadioMessageContent() {
  const compactMessageRef = useRef<HTMLButtonElement>(null);
  const fullMessageRef = useRef<HTMLElement>(null);
  const eventId = useGameStore((state) => state.activeRadioEventId);
  const dismiss = useGameStore((state) => state.dismissRadioEvent);
  const requestStoryLog = useGameStore((state) => state.requestStoryLog);
  const event = eventId ? narrativeEventById.get(eventId) : null;
  const [mobileViewport, setMobileViewport] = useState(mobileRadioViewport);
  const [expanded, setExpanded] = useState(true);
  const renderCount = useRef(0);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const compactQuery = window.matchMedia('(max-width: 900px)');
    const pointerQuery = window.matchMedia('(pointer: coarse)');
    const update = () =>
      setMobileViewport(compactQuery.matches || pointerQuery.matches);
    compactQuery.addEventListener('change', update);
    pointerQuery.addEventListener('change', update);
    return () => {
      compactQuery.removeEventListener('change', update);
      pointerQuery.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    if (!event || !mobileViewport || !expanded) return;
    const timer = window.setTimeout(
      () => setExpanded(false),
      RADIO_FULL_PREVIEW_MILLISECONDS,
    );
    return () => window.clearTimeout(timer);
  }, [event, expanded, mobileViewport]);

  useEffect(() => {
    renderCount.current += 1;
    const message = compactMessageRef.current ?? fullMessageRef.current;
    if (message) {
      message.dataset.renderCount = String(renderCount.current);
    }
  });

  if (!event || event.presentation !== 'radio') return null;

  if (mobileViewport && !expanded) {
    return (
      <div className="radio-overlay radio-overlay--compact" aria-live="polite">
        <button
          ref={compactMessageRef}
          type="button"
          className="radio-message radio-message--compact"
          aria-label="Expandir transmisión de radio"
          onClick={() => setExpanded(true)}
        >
          <strong>📻 {event.channelLabel}</strong>
          <span>{event.title}</span>
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
          {mobileViewport && (
            <button type="button" onClick={() => setExpanded(false)}>
              Contraer
            </button>
          )}
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
  return isJournalOpen || !activeRadioEventId ? null : (
    <RadioMessageContent key={activeRadioEventId} />
  );
}
