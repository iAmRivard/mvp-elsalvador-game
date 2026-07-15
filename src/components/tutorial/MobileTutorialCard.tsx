import { useRef, useState, type PointerEvent } from 'react';

interface MobileTutorialCardProps {
  step: number;
  totalSteps: number;
  title: string;
  description: string;
  available: boolean;
  onSkip: () => void;
}

interface CardPosition {
  x: number;
  y: number;
}

interface DragState extends CardPosition {
  pointerX: number;
  pointerY: number;
  width: number;
  height: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function MobileTutorialCard({
  step,
  totalSteps,
  title,
  description,
  available,
  onSkip,
}: MobileTutorialCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [position, setPosition] = useState<CardPosition | null>(null);

  const startDrag = (event: PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    const rectangle = cardRef.current?.getBoundingClientRect();
    if (!rectangle) return;
    dragRef.current = {
      x: rectangle.left,
      y: rectangle.top,
      pointerX: event.clientX,
      pointerY: event.clientY,
      width: rectangle.width,
      height: rectangle.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const drag = (event: PointerEvent<HTMLElement>) => {
    const active = dragRef.current;
    if (!active) return;
    const isLandscape = window.innerWidth > window.innerHeight;
    const controlsClearance = isLandscape ? 8 : 154;
    const maximumX = Math.max(8, window.innerWidth - active.width - 8);
    const maximumY = Math.max(
      56,
      window.innerHeight - active.height - controlsClearance,
    );
    setPosition({
      x: clamp(active.x + event.clientX - active.pointerX, 8, maximumX),
      y: clamp(active.y + event.clientY - active.pointerY, 56, maximumY),
    });
  };

  const stopDrag = (event: PointerEvent<HTMLElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <aside
      ref={cardRef}
      className={`mobile-tutorial-card${position ? ' mobile-tutorial-card--moved' : ''}`}
      aria-labelledby="mobile-tutorial-title"
      aria-live="polite"
      data-tutorial-card="mobile"
      data-tutorial-available={available}
      style={position ? { left: position.x, top: position.y } : undefined}
    >
      <header
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <span>
          Paso {step} de {totalSteps}
        </span>
        <span className="mobile-tutorial-card__grip" aria-hidden="true">
          ⋮⋮
        </span>
        <button type="button" onClick={onSkip}>
          Omitir
        </button>
      </header>
      <h2 id="mobile-tutorial-title">{title}</h2>
      <p>{description}</p>
      <small className="mobile-tutorial-card__action-hint">
        {available
          ? 'Realiza la acción para continuar'
          : 'Continúa la misión para habilitar esta acción'}
      </small>
    </aside>
  );
}
