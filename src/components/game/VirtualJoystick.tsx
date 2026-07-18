import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  driveJoystickConfig,
  type JoystickPositionMode,
} from '../../config/mobileControls.config';
import { performanceMetricsEnabled } from '../../config/diagnostics.config';
import { applyDeadZone, applyResponseCurve } from '../../game/analogInput';
import {
  arcadeDriveJoystickOutput,
  driveJoystickOutput,
  legacyDriveJoystickThrottle,
} from '../../game/driveJoystick';
import { triggerHaptic } from '../../game/haptics';
import type { InputController } from '../../game/inputController';

interface VirtualJoystickProps {
  input: InputController;
  radiusPixels: number;
  knobRadiusPixels: number;
  deadZone: number;
  responseExponent: number;
  returnDurationMilliseconds: number;
  positionMode: JoystickPositionMode;
  driveMode?: boolean;
  targetSpeedMode?: boolean;
  arcadeMode?: boolean;
  speedMetersPerSecond?: number;
  hapticsEnabled?: boolean;
  disabled?: boolean;
}

interface Point {
  x: number;
  y: number;
}

const blockedFloatingTargets = [
  '.topbar',
  '.player-hud',
  '.mission-panel',
  '.discovery-toast',
  '.mission-toast',
  '[role="dialog"]',
  '[role="menu"]',
];

function canStartFloatingJoystick(clientX: number, clientY: number): boolean {
  if (clientX > window.innerWidth * 0.55) return false;
  return !document
    .elementsFromPoint(clientX, clientY)
    .some((element) =>
      blockedFloatingTargets.some((selector) => element.matches(selector)),
    );
}

export function VirtualJoystick({
  input,
  radiusPixels,
  knobRadiusPixels,
  deadZone,
  responseExponent,
  returnDurationMilliseconds,
  positionMode,
  driveMode = false,
  targetSpeedMode = false,
  arcadeMode = false,
  speedMetersPerSecond = 0,
  hapticsEnabled = false,
  disabled = false,
}: VirtualJoystickProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const centerRef = useRef<Point>({ x: 0, y: 0 });
  const driveThrottleRef = useRef(0);
  const reverseHapticRef = useRef(false);
  const [floatingCenter, setFloatingCenter] = useState<Point | null>(null);

  const reset = useCallback(() => {
    const pointerId = pointerIdRef.current;
    pointerIdRef.current = null;
    if (pointerId !== null) {
      input.setPointerActive(pointerId, false);
      const surface = surfaceRef.current;
      if (surface?.hasPointerCapture(pointerId)) {
        surface.releasePointerCapture(pointerId);
      }
    }
    driveThrottleRef.current = 0;
    reverseHapticRef.current = false;
    if (targetSpeedMode) input.setTargetSpeedJoystick(0, 0);
    else if (driveMode) input.setDriveJoystick(0, 0);
    else input.setJoystickTurn(0);
    if (knobRef.current) {
      knobRef.current.style.transitionDuration = `${returnDurationMilliseconds}ms`;
      knobRef.current.style.transform = 'translate3d(0, 0, 0)';
    }
    if (positionMode === 'floating') setFloatingCenter(null);
  }, [
    driveMode,
    input,
    positionMode,
    returnDurationMilliseconds,
    targetSpeedMode,
  ]);

  useEffect(() => {
    const handleOrientationChange = () => reset();
    window.addEventListener('orientationchange', handleOrientationChange);
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      reset();
    };
  }, [reset]);

  useEffect(() => {
    const reversing =
      driveMode &&
      !targetSpeedMode &&
      driveThrottleRef.current <= driveJoystickConfig.brakeThreshold &&
      Math.abs(speedMetersPerSecond) <= 0.35;
    if (reversing && !reverseHapticRef.current) {
      triggerHaptic('reverse', hapticsEnabled);
    }
    reverseHapticRef.current = reversing;
  }, [driveMode, hapticsEnabled, speedMetersPerSecond, targetSpeedMode]);

  const start = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (pointerIdRef.current !== null) return;
    if (
      positionMode === 'floating' &&
      !canStartFloatingJoystick(event.clientX, event.clientY)
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerIdRef.current = event.pointerId;
    input.setPointerActive(event.pointerId, true);
    const bounds = event.currentTarget.getBoundingClientRect();
    centerRef.current =
      positionMode === 'floating'
        ? { x: event.clientX, y: event.clientY }
        : {
            x: bounds.left + bounds.width / 2,
            y: bounds.top + bounds.height / 2,
          };
    if (positionMode === 'floating') {
      setFloatingCenter({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
    }
    if (knobRef.current) knobRef.current.style.transitionDuration = '0ms';
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (pointerIdRef.current !== event.pointerId) return;
    const processingStartedAt = performance.now();
    event.preventDefault();
    event.stopPropagation();
    const deltaX = event.clientX - centerRef.current.x;
    const deltaY = event.clientY - centerRef.current.y;
    const distance = Math.hypot(deltaX, deltaY);
    const scale = distance > radiusPixels ? radiusPixels / distance : 1;
    const visualX = deltaX * scale;
    const visualY = deltaY * scale;
    if (knobRef.current) {
      knobRef.current.style.transform = `translate3d(${String(visualX)}px, ${String(visualY)}px, 0)`;
    }
    if (driveMode) {
      const output = arcadeMode
        ? arcadeDriveJoystickOutput(
            visualX / radiusPixels,
            visualY / radiusPixels,
            Math.hypot(visualX, visualY),
          )
        : driveJoystickOutput(
            visualX / radiusPixels,
            visualY / radiusPixels,
          );
      if (targetSpeedMode) {
        driveThrottleRef.current = output.verticalIntent;
        input.setTargetSpeedJoystick(
          output.verticalIntent,
          output.turn,
          arcadeMode &&
            'startRequested' in output &&
            output.startRequested === true,
        );
      } else {
        const throttle = legacyDriveJoystickThrottle(visualY / radiusPixels);
        driveThrottleRef.current = throttle;
        input.setDriveJoystick(throttle, output.turn);
      }
    } else {
      const normalized = applyDeadZone(visualX / radiusPixels, deadZone);
      input.setJoystickTurn(applyResponseCurve(normalized, responseExponent));
    }
    const sequence = input.recordInputStored(event.timeStamp);
    if (performanceMetricsEnabled) {
      window.requestAnimationFrame(() => {
        input.markInputAnimationFrame(sequence, performance.now());
        const diagnostics = input.getInputLatencyDiagnostics();
        if (
          surfaceRef.current &&
          diagnostics.eventToNextAnimationFrameMilliseconds !== null
        ) {
          surfaceRef.current.dataset.inputNextAnimationFrameLatencyMs =
            diagnostics.eventToNextAnimationFrameMilliseconds.toFixed(3);
        }
      });
    }
    if (surfaceRef.current) {
      surfaceRef.current.dataset.processingMs = (
        performance.now() - processingStartedAt
      ).toFixed(3);
    }
  };

  const release = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    reset();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const style = {
    '--joystick-radius': `${String(radiusPixels)}px`,
    '--joystick-knob-radius': `${String(knobRadiusPixels)}px`,
    '--joystick-return-ms': `${String(returnDurationMilliseconds)}ms`,
  } as CSSProperties;
  const baseStyle =
    positionMode === 'floating' && floatingCenter
      ? ({
          left: floatingCenter.x,
          top: floatingCenter.y,
        } satisfies CSSProperties)
      : undefined;

  return (
    <div
      ref={surfaceRef}
      className={`virtual-joystick virtual-joystick--${positionMode} ${driveMode ? 'virtual-joystick--drive' : ''} ${targetSpeedMode ? 'virtual-joystick--target-speed' : ''} ${floatingCenter ? 'virtual-joystick--active' : ''}`}
      style={style}
      aria-label={
        arcadeMode
          ? 'Joystick de conducción arcade'
          : targetSpeedMode
          ? 'Joystick de velocidad objetivo'
          : driveMode
            ? 'Joystick de conducción'
            : 'Joystick de dirección'
      }
      aria-disabled={disabled || undefined}
      data-disabled={disabled ? 'true' : undefined}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      {(positionMode === 'fixed' || floatingCenter) && (
        <div className="virtual-joystick__base" style={baseStyle}>
          <span aria-hidden="true" />
          <div ref={knobRef} className="virtual-joystick__knob" />
        </div>
      )}
    </div>
  );
}
