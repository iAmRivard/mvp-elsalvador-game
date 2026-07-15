import { useEffect, useState } from 'react';
import {
  exitGameFullscreen,
  fullscreenActive,
  fullscreenSupported,
  requestGameFullscreen,
} from '../../game/fullscreen';

export function FullscreenButton() {
  const [supported] = useState(() => fullscreenSupported());
  const [active, setActive] = useState(() => fullscreenActive());
  const [failed, setFailed] = useState(false);

  const toggleFullscreen = async () => {
    const success = active
      ? await exitGameFullscreen()
      : await requestGameFullscreen();
    setFailed(!success);
  };

  useEffect(() => {
    const update = () => {
      const next = fullscreenActive();
      setActive(next);
      document.documentElement.dataset.fullscreen = String(next);
    };
    document.addEventListener('fullscreenchange', update);
    document.addEventListener('webkitfullscreenchange', update);
    window.addEventListener('orientationchange', update);
    update();
    return () => {
      document.removeEventListener('fullscreenchange', update);
      document.removeEventListener('webkitfullscreenchange', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  if (!supported) {
    return (
      <small className="fullscreen-unavailable">
        Pantalla completa disponible al agregar el juego a inicio.
      </small>
    );
  }

  return (
    <button
      type="button"
      className="fullscreen-button"
      onClick={() => void toggleFullscreen()}
    >
      {active ? 'Salir de pantalla completa' : 'Jugar en pantalla completa'}
      {failed && <span role="status">No disponible en este navegador</span>}
    </button>
  );
}
