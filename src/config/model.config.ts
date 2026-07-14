function localModelPath(path: string): string {
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    !path.endsWith('.glb')
  ) {
    throw new Error(`Ruta de modelo local inválida: ${path}`);
  }
  return path;
}

export const modelConfig = {
  playerVehicleUrl: localModelPath('/models/expedition-vehicle.glb'),
  interactiveSignalUrl: localModelPath('/models/suchitoto-signal.glb'),
} as const;
