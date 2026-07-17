import { useEffect, useRef } from 'react';
import { narrativeEventById } from '../../data/chapter1';
import { useGameStore } from '../../store/gameStore';

export const RADIO_FULL_PREVIEW_MILLISECONDS = 3_000;
export type RadioDisplayMode = 'expanded' | 'compact';

interface RadioMessageContentProps {
  displayMode: RadioDisplayMode;
  mobileViewport: boolean;
  onCompact: () => void;
  onExpandRequest: () => void;
}

function RadioMessageContent({
  displayMode,
  mobileViewport,
  onCompact,
  onExpandRequest,
}: RadioMessageContentProps) {
  const compactMessageRef = useRef<HTMLButtonElement>(null);
  const fullMessageRef = useRef<HTMLElement>(null);
  const eventId = useGameStore((state) => state.activeRadioEventId);
  const dismiss = useGameStore((state) => state.dismissRadioEvent);
  const requestStoryLog = useGameStore((state) => state.requestStoryLog);
  const event = eventId ? narrativeEventById.get(eventId) : null;
  const renderCount = useRef(0);

  useEffect(() => {
    if (
      !event ||
      event.presentation !== 'radio' ||
      !mobileViewport ||
      displayMode !== 'expanded'
    ) {
      return;
    }
    const timer = window.setTimeout(
      onCompact,
      RADIO_FULL_PREVIEW_MILLISECONDS,
    );
    return () => window.clearTimeout(timer);
  }, [displayMode, event, mobileViewport, onCompact]);

  useEffect(() => {
    renderCount.current += 1;
    const message = compactMessageRef.current ?? fullMessageRef.current;
    if (message) {
      message.dataset.renderCount = String(renderCount.current);
    }
  });

  if (!event || event.presentation !== 'radio') return null;

  if (mobileViewport && displayMode === 'compact') {
    return (
      <div className="radio-overlay radio-overlay--compact" aria-live="polite">
        <button
          ref={compactMessageRef}
          type="button"
          className="radio-message radio-message--compact"
          aria-label="Expandir transmisión de radio"
          onClick={onExpandRequest}
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
            <button type="button" onClick={onCompact}>
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

interface RadioMessageOverlayProps {
  displayMode: RadioDisplayMode;
  mobileViewport: boolean;
  onCompact: () => void;
  onExpandRequest: () => void;
}

export function RadioMessageOverlay({
  displayMode,
  mobileViewport,
  onCompact,
  onExpandRequest,
}: RadioMessageOverlayProps) {
  const isJournalOpen = useGameStore((state) => state.isJournalOpen);
  const activeRadioEventId = useGameStore((state) => state.activeRadioEventId);
  return isJournalOpen || !activeRadioEventId ? null : (
    <RadioMessageContent
      key={activeRadioEventId}
      displayMode={displayMode}
      mobileViewport={mobileViewport}
      onCompact={onCompact}
      onExpandRequest={onExpandRequest}
    />
  );
}
