import { useEffect, useState } from 'react';

function mobileRadioViewport(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(max-width: 900px)').matches ||
      window.matchMedia('(pointer: coarse)').matches)
  );
}

export function useMobileRadioViewport(): boolean {
  const [mobileViewport, setMobileViewport] = useState(mobileRadioViewport);

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

  return mobileViewport;
}
