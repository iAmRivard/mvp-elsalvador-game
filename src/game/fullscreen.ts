type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export function fullscreenSupported(
  documentValue: Document = document,
): boolean {
  const element = documentValue.documentElement as FullscreenElement;
  return (
    typeof element.requestFullscreen === 'function' ||
    typeof element.webkitRequestFullscreen === 'function'
  );
}

export function fullscreenActive(documentValue: Document = document): boolean {
  const value = documentValue as FullscreenDocument;
  return Boolean(
    documentValue.fullscreenElement || value.webkitFullscreenElement,
  );
}

export async function requestGameFullscreen(
  documentValue: Document = document,
): Promise<boolean> {
  const element = documentValue.documentElement as FullscreenElement;
  try {
    if (element.requestFullscreen) await element.requestFullscreen();
    else if (element.webkitRequestFullscreen) {
      await element.webkitRequestFullscreen();
    } else return false;
    return true;
  } catch {
    return false;
  }
}

export async function exitGameFullscreen(
  documentValue: Document = document,
): Promise<boolean> {
  const value = documentValue as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
  };
  try {
    if (documentValue.exitFullscreen) await documentValue.exitFullscreen();
    else if (value.webkitExitFullscreen) await value.webkitExitFullscreen();
    else return false;
    return true;
  } catch {
    return false;
  }
}
