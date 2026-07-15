import { useState } from 'react';

export const INSTALL_HINT_DISMISSED_KEY =
  'el-salvador-rutas-perdidas:install-hint-dismissed';

function standalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function InstallExperienceHint() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return (
        !standalone() &&
        window.localStorage.getItem(INSTALL_HINT_DISMISSED_KEY) !== 'true'
      );
    } catch {
      return !standalone();
    }
  });

  if (!visible) return null;
  return (
    <aside className="install-hint" role="note">
      <span>
        Para tener más espacio, agrega el juego a tu pantalla de inicio.
      </span>
      <button
        type="button"
        aria-label="Ocultar sugerencia de instalación"
        onClick={() => {
          try {
            window.localStorage.setItem(INSTALL_HINT_DISMISSED_KEY, 'true');
          } catch {
            // La sugerencia puede cerrarse aunque el almacenamiento esté bloqueado.
          }
          setVisible(false);
        }}
      >
        ×
      </button>
    </aside>
  );
}
