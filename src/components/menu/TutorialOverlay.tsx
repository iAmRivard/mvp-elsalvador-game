import { useState } from 'react';

interface TutorialOverlayProps {
  onComplete: () => void;
}

const tutorialSteps = [
  {
    eyebrow: 'Paso 1 de 3',
    title: 'Conduce la expedición',
    description:
      'Usa WASD o las flechas. En móvil, mantén presionada la cruceta. Shift o Turbo aumenta la velocidad.',
    symbol: '⌁',
  },
  {
    eyebrow: 'Paso 2 de 3',
    title: 'Sigue señales y objetivos',
    description:
      'El marcador dorado y la línea discontinua muestran el siguiente objetivo. Acércate para descubrir lugares.',
    symbol: '✦',
  },
  {
    eyebrow: 'Paso 3 de 3',
    title: 'Investiga y guarda',
    description:
      'Usa Espacio o Investigar cuando una señal esté cerca. Tu progreso se guarda automáticamente en este dispositivo.',
    symbol: '◇',
  },
] as const;

export function TutorialOverlay({ onComplete }: TutorialOverlayProps) {
  const [step, setStep] = useState(0);
  const current = tutorialSteps[step];
  const isLast = step === tutorialSteps.length - 1;

  return (
    <div className="tutorial-backdrop">
      <section
        className="tutorial-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
      >
        <span className="tutorial-card__symbol" aria-hidden="true">
          {current.symbol}
        </span>
        <span className="tutorial-card__eyebrow">{current.eyebrow}</span>
        <h2 id="tutorial-title">{current.title}</h2>
        <p>{current.description}</p>
        <div
          className="tutorial-progress"
          aria-label={`Paso ${step + 1} de ${tutorialSteps.length}`}
        >
          {tutorialSteps.map((item, index) => (
            <span
              key={item.title}
              className={index === step ? 'is-active' : ''}
            />
          ))}
        </div>
        <div className="tutorial-card__actions">
          <button type="button" className="tutorial-skip" onClick={onComplete}>
            Omitir
          </button>
          {step > 0 && (
            <button type="button" onClick={() => setStep((value) => value - 1)}>
              Anterior
            </button>
          )}
          <button
            type="button"
            className="tutorial-next"
            onClick={() =>
              isLast ? onComplete() : setStep((value) => value + 1)
            }
          >
            {isLast ? 'Comenzar' : 'Siguiente'}
          </button>
        </div>
      </section>
    </div>
  );
}
