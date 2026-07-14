export function clampAnalogInput(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

export function applyDeadZone(value: number, deadZone: number): number {
  const safeValue = clampAnalogInput(value);
  const safeDeadZone = Number.isFinite(deadZone)
    ? Math.max(0, Math.min(0.5, deadZone))
    : 0;
  const magnitude = Math.abs(safeValue);
  if (magnitude <= safeDeadZone) return 0;

  const normalized = (magnitude - safeDeadZone) / (1 - safeDeadZone);
  return Math.sign(safeValue) * normalized;
}

export function applyResponseCurve(value: number, exponent: number): number {
  const safeValue = clampAnalogInput(value);
  const safeExponent = Number.isFinite(exponent) ? Math.max(0.5, exponent) : 1;
  return Math.sign(safeValue) * Math.pow(Math.abs(safeValue), safeExponent);
}
