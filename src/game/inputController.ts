import type { PlayerInput } from '../types/game';
import {
  mobileBoostConfig,
  mobileCruiseConfig,
  type MobileBoostState,
} from '../config/mobileControls.config';
import { clampAnalogInput } from './analogInput';
import {
  mobileCruiseGear,
  mobileCruiseThrottle,
  stoppedMobileCruiseTarget,
  updateCruiseTarget,
  type MobileCruiseTarget,
  type MobileReverseState,
} from './mobileCruise';

export type InputAction =
  'forward' | 'backward' | 'left' | 'right' | 'boost' | 'interact';

export interface InputSources {
  keyboardThrottle: number;
  keyboardTurn: number;
  pointerThrottle: number;
  pointerTurn: number;
  touchThrottle: number;
  joystickThrottle: number;
  joystickTurn: number;
  autoThrottle: number;
  mobileCruiseThrottle: number;
  mobileCruiseVerticalIntent: number;
}

export interface AutoThrottleState {
  enabled: boolean;
  targetThrottle: number;
}

export type AutoThrottleStatus = 'off' | 'active' | 'suspended';

export interface InputDiagnostics extends InputSources {
  throttle: number;
  turn: number;
  boost: boolean;
  interact: boolean;
  autoThrottleStatus: AutoThrottleStatus;
  pointerActive: boolean;
  mobileBoost: MobileBoostState;
  mobileCruise: MobileCruiseTarget;
}

export interface InputLatencyDiagnostics {
  sequence: number;
  eventToStoredMilliseconds: number | null;
  eventToNextAnimationFrameMilliseconds: number | null;
  inputConsumptionLatencyMilliseconds: number | null;
  inputToFirstPositionMilliseconds: number | null;
  inputToFirstVisualMilliseconds: number | null;
  consumptionToFirstPositionMilliseconds: number | null;
  consumptionToFirstVisualMilliseconds: number | null;
}

export interface MobileBoostAvailability {
  fuel: number;
  condition: number;
}

export type MobileCruiseMode = 'off' | 'target-speed' | 'arcade';

const keyActions: Readonly<Record<string, InputAction>> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'boost',
  ShiftRight: 'boost',
  KeyE: 'interact',
  Space: 'interact',
};

function digitalAxis(
  actions: ReadonlySet<InputAction>,
  positive: InputAction,
  negative: InputAction,
): number {
  return Number(actions.has(positive)) - Number(actions.has(negative));
}

export class InputController {
  private readonly keyboardActions = new Set<InputAction>();
  private readonly pointerActions = new Set<InputAction>();
  private readonly pointerReleaseTimers = new Map<
    InputAction,
    ReturnType<typeof setTimeout>
  >();
  private readonly listeners = new Set<() => void>();
  private touchThrottle = 0;
  private joystickThrottle = 0;
  private joystickTurn = 0;
  private autoThrottle: AutoThrottleState = {
    enabled: false,
    targetThrottle: 0.72,
  };
  private autoThrottleScale = 1;
  private mobileCruiseEnabled = false;
  private mobileCruiseMode: MobileCruiseMode = 'off';
  private arcadeTargetJustLatched = false;
  private overlaySuspended = false;
  private mobileCruiseVerticalIntent = 0;
  private mobileCruiseThrottle = 0;
  private mobileCruiseTarget: MobileCruiseTarget = {
    ...stoppedMobileCruiseTarget,
  };
  private reverseIntentMilliseconds = 0;
  private mobileReverseState: MobileReverseState = 'forward';
  private lastCruiseNotificationAt = 0;
  private lastNotifiedCruiseTarget = 0;
  private readonly activePointerIds = new Set<number>();
  private mobileBoostActiveUntil = 0;
  private mobileBoostCooldownUntil = 0;
  private mobileBoostRecoveryUntil = 0;
  private mobileBoostTimer: ReturnType<typeof setTimeout> | null = null;
  private mobileBoostState: MobileBoostState = {
    active: false,
    remainingMilliseconds: 0,
    cooldownRemainingMilliseconds: 0,
  };
  private inputLatencySequence = 0;
  private inputLatencySample: {
    sequence: number;
    eventTimestamp: number;
    storedTimestamp: number;
    animationFrameTimestamp: number | null;
    consumedTimestamp: number | null;
    firstPositionTimestamp: number | null;
    firstVisualTimestamp: number | null;
  } | null = null;

  bindKeyboard(
    target: Window,
    onTogglePause: () => void,
    onRecalculateRoute: () => void = () => undefined,
  ): () => void {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        if (!event.repeat) onTogglePause();
        event.preventDefault();
        return;
      }
      if (
        event.code === 'KeyR' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        if (!event.repeat) onRecalculateRoute();
        event.preventDefault();
        return;
      }

      const action = keyActions[event.code];
      if (!action || event.metaKey || event.ctrlKey || event.altKey) return;
      const sizeBefore = this.keyboardActions.size;
      this.keyboardActions.add(action);
      if (action === 'backward') {
        this.disableAutoThrottle();
        this.cancelActiveMobileBoostPreservingCooldown();
      }
      if (this.keyboardActions.size !== sizeBefore) this.notify();
      event.preventDefault();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const action = keyActions[event.code];
      if (!action) return;
      if (this.keyboardActions.delete(action)) this.notify();
      event.preventDefault();
    };

    const clearKeyboard = () => {
      if (this.keyboardActions.size === 0) return;
      this.keyboardActions.clear();
      this.notify();
    };
    const clearInterruptedInput = () => {
      if (this.overlaySuspended) this.clearTransientInput(true);
      else this.clearAllInput();
    };
    target.addEventListener('keydown', handleKeyDown, { passive: false });
    target.addEventListener('keyup', handleKeyUp, { passive: false });
    target.addEventListener('blur', clearInterruptedInput);

    return () => {
      target.removeEventListener('keydown', handleKeyDown);
      target.removeEventListener('keyup', handleKeyUp);
      target.removeEventListener('blur', clearInterruptedInput);
      clearKeyboard();
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  recordInputStored(eventTimestamp: number): number {
    if (
      this.inputLatencySample &&
      (this.inputLatencySample.consumedTimestamp === null ||
        (this.inputLatencySample.firstPositionTimestamp !== null &&
          this.inputLatencySample.firstVisualTimestamp === null))
    ) {
      return this.inputLatencySample.sequence;
    }
    const storedTimestamp = performance.now();
    const normalizedEventTimestamp =
      Number.isFinite(eventTimestamp) &&
      Math.abs(storedTimestamp - eventTimestamp) <= 60_000
        ? eventTimestamp
        : storedTimestamp;
    const sequence = ++this.inputLatencySequence;
    this.inputLatencySample = {
      sequence,
      eventTimestamp: normalizedEventTimestamp,
      storedTimestamp,
      animationFrameTimestamp: null,
      consumedTimestamp: null,
      firstPositionTimestamp: null,
      firstVisualTimestamp: null,
    };
    return sequence;
  }

  markInputAnimationFrame(sequence: number, timestamp: number): void {
    if (
      this.inputLatencySample?.sequence !== sequence ||
      this.inputLatencySample.animationFrameTimestamp !== null
    ) {
      return;
    }
    this.inputLatencySample.animationFrameTimestamp = timestamp;
  }

  markInputConsumed(timestamp: number): void {
    if (
      !this.inputLatencySample ||
      this.inputLatencySample.consumedTimestamp !== null
    ) {
      return;
    }
    this.inputLatencySample.consumedTimestamp = timestamp;
  }

  markInputPositionChanged(timestamp: number): void {
    if (
      !this.inputLatencySample ||
      this.inputLatencySample.consumedTimestamp === null ||
      this.inputLatencySample.firstPositionTimestamp !== null
    ) {
      return;
    }
    this.inputLatencySample.firstPositionTimestamp = timestamp;
  }

  markInputVisualFrame(timestamp: number): void {
    if (
      !this.inputLatencySample ||
      this.inputLatencySample.firstPositionTimestamp === null ||
      this.inputLatencySample.firstVisualTimestamp !== null
    ) {
      return;
    }
    this.inputLatencySample.firstVisualTimestamp = timestamp;
  }

  getInputLatencyDiagnostics(): InputLatencyDiagnostics {
    const sample = this.inputLatencySample;
    if (!sample) {
      return {
        sequence: 0,
        eventToStoredMilliseconds: null,
        eventToNextAnimationFrameMilliseconds: null,
        inputConsumptionLatencyMilliseconds: null,
        inputToFirstPositionMilliseconds: null,
        inputToFirstVisualMilliseconds: null,
        consumptionToFirstPositionMilliseconds: null,
        consumptionToFirstVisualMilliseconds: null,
      };
    }
    return {
      sequence: sample.sequence,
      eventToStoredMilliseconds: Math.max(
        0,
        sample.storedTimestamp - sample.eventTimestamp,
      ),
      eventToNextAnimationFrameMilliseconds:
        sample.animationFrameTimestamp === null
          ? null
          : Math.max(
              0,
              sample.animationFrameTimestamp - sample.eventTimestamp,
            ),
      inputConsumptionLatencyMilliseconds:
        sample.consumedTimestamp === null
          ? null
          : Math.max(0, sample.consumedTimestamp - sample.eventTimestamp),
      inputToFirstPositionMilliseconds:
        sample.firstPositionTimestamp === null
          ? null
          : Math.max(0, sample.firstPositionTimestamp - sample.eventTimestamp),
      inputToFirstVisualMilliseconds:
        sample.firstVisualTimestamp === null
          ? null
          : Math.max(0, sample.firstVisualTimestamp - sample.eventTimestamp),
      consumptionToFirstPositionMilliseconds:
        sample.consumedTimestamp === null ||
        sample.firstPositionTimestamp === null
          ? null
          : Math.max(
              0,
              sample.firstPositionTimestamp - sample.consumedTimestamp,
            ),
      consumptionToFirstVisualMilliseconds:
        sample.consumedTimestamp === null || sample.firstVisualTimestamp === null
          ? null
          : Math.max(
              0,
              sample.firstVisualTimestamp - sample.consumedTimestamp,
            ),
    };
  }

  setPointerAction(action: InputAction, active: boolean): void {
    const releaseTimer = this.pointerReleaseTimers.get(action);
    if (releaseTimer) clearTimeout(releaseTimer);
    this.pointerReleaseTimers.delete(action);
    const changed = active
      ? !this.pointerActions.has(action)
      : this.pointerActions.has(action);
    if (active) this.pointerActions.add(action);
    else this.pointerActions.delete(action);
    if (active && action === 'backward') {
      this.disableAutoThrottle();
      this.cancelActiveMobileBoostPreservingCooldown();
    }
    if (changed) this.notify();
  }

  releasePointerAction(action: InputAction, delayMilliseconds = 0): void {
    const releaseTimer = this.pointerReleaseTimers.get(action);
    if (releaseTimer) clearTimeout(releaseTimer);
    if (delayMilliseconds <= 0) {
      this.pointerReleaseTimers.delete(action);
      if (this.pointerActions.delete(action)) this.notify();
      return;
    }
    this.pointerReleaseTimers.set(
      action,
      setTimeout(() => {
        const changed = this.pointerActions.delete(action);
        this.pointerReleaseTimers.delete(action);
        if (changed) this.notify();
      }, delayMilliseconds),
    );
  }

  setTouchThrottle(value: number): void {
    const next = clampAnalogInput(value);
    if (next < 0) {
      this.disableAutoThrottle();
      this.cancelActiveMobileBoostPreservingCooldown();
    }
    if (this.touchThrottle === next) return;
    this.touchThrottle = next;
    this.notify();
  }

  setJoystickTurn(value: number): void {
    const next = clampAnalogInput(value);
    if (this.joystickTurn === next) return;
    this.joystickTurn = next;
    this.notify();
  }

  setDriveJoystick(throttle: number, turn: number): void {
    const nextThrottle = clampAnalogInput(throttle);
    const nextTurn = clampAnalogInput(turn);
    if (nextThrottle < 0) {
      this.disableAutoThrottle();
      this.cancelActiveMobileBoostPreservingCooldown();
    }
    if (
      this.joystickThrottle === nextThrottle &&
      this.joystickTurn === nextTurn
    ) {
      return;
    }
    this.joystickThrottle = nextThrottle;
    this.joystickTurn = nextTurn;
    this.notify();
  }

  setMobileCruiseEnabled(enabled: boolean): void {
    this.setMobileCruiseMode(enabled ? 'target-speed' : 'off');
  }

  setMobileCruiseMode(mode: MobileCruiseMode): void {
    if (this.mobileCruiseMode === mode) return;
    this.mobileCruiseMode = mode;
    this.mobileCruiseEnabled = mode !== 'off';
    this.joystickThrottle = 0;
    this.mobileCruiseVerticalIntent = 0;
    this.mobileCruiseThrottle = 0;
    this.reverseIntentMilliseconds = 0;
    this.mobileReverseState = 'forward';
    this.arcadeTargetJustLatched = false;
    this.mobileCruiseTarget = { ...stoppedMobileCruiseTarget };
    if (mode !== 'off') this.disableAutoThrottle();
    this.notify();
  }

  setTargetSpeedJoystick(verticalIntent: number, turn: number): void {
    const nextIntent = clampAnalogInput(verticalIntent);
    const nextTurn = clampAnalogInput(turn);
    const shouldLatchArcadeTarget =
      this.mobileCruiseMode === 'arcade' &&
      this.mobileReverseState === 'forward' &&
      nextIntent > mobileCruiseConfig.reverseReleaseDeadZone &&
      this.mobileCruiseTarget.targetSpeedKilometersPerHour <= 0.5;
    if (shouldLatchArcadeTarget) {
      const targetSpeedKilometersPerHour =
        mobileCruiseConfig.arcadeInitialTargetSpeedKilometersPerHour;
      this.mobileCruiseTarget = {
        targetSpeedKilometersPerHour,
        selectedGear: mobileCruiseGear(targetSpeedKilometersPerHour),
        braking: false,
        reversing: false,
        reverseState: 'forward',
      };
      this.arcadeTargetJustLatched = true;
    }
    if (
      this.mobileCruiseVerticalIntent === nextIntent &&
      this.joystickTurn === nextTurn &&
      !shouldLatchArcadeTarget
    ) {
      return;
    }
    this.mobileCruiseVerticalIntent = nextIntent;
    this.joystickTurn = nextTurn;
    this.notify();
  }

  advanceMobileCruise(
    currentSpeedMetersPerSecond: number,
    deltaTimeSeconds: number,
  ): void {
    if (!this.mobileCruiseEnabled) return;
    if (this.overlaySuspended) {
      this.mobileCruiseThrottle = 0;
      return;
    }
    this.updateMobileBoostState();
    const previous = this.mobileCruiseTarget;
    const intent = this.mobileCruiseVerticalIntent;
    const deltaTime = Math.max(
      0,
      Number.isFinite(deltaTimeSeconds) ? deltaTimeSeconds : 0,
    );
    const preserveArcadeLatch = this.arcadeTargetJustLatched && intent > 0;
    this.arcadeTargetJustLatched = false;
    let targetSpeedKilometersPerHour = previous.reversing
      ? 0
      : preserveArcadeLatch
        ? previous.targetSpeedKilometersPerHour
        : updateCruiseTarget(
            previous.targetSpeedKilometersPerHour,
            intent,
            deltaTime,
          );
    const stopped =
      Math.abs(currentSpeedMetersPerSecond) <=
      mobileCruiseConfig.stoppedSpeedMetersPerSecond;
    const downIntent = intent < -mobileCruiseConfig.reverseIntentThreshold;
    const releasedIntent =
      Math.abs(intent) <= mobileCruiseConfig.reverseReleaseDeadZone;
    let reverseState = this.mobileReverseState;

    switch (reverseState) {
      case 'forward':
        this.reverseIntentMilliseconds = 0;
        if (downIntent) reverseState = 'braking-to-stop';
        break;
      case 'braking-to-stop':
        targetSpeedKilometersPerHour = 0;
        this.reverseIntentMilliseconds = 0;
        if (stopped) {
          reverseState = releasedIntent ? 'reverse-armed' : 'awaiting-release';
        }
        break;
      case 'awaiting-release':
        targetSpeedKilometersPerHour = 0;
        this.reverseIntentMilliseconds = 0;
        if (releasedIntent) reverseState = 'reverse-armed';
        break;
      case 'reverse-armed':
        targetSpeedKilometersPerHour = 0;
        if (intent > mobileCruiseConfig.reverseReleaseDeadZone) {
          reverseState = 'forward';
          this.reverseIntentMilliseconds = 0;
          targetSpeedKilometersPerHour = updateCruiseTarget(
            0,
            intent,
            deltaTime,
          );
        } else if (downIntent) {
          this.reverseIntentMilliseconds += deltaTime * 1_000;
          if (
            this.reverseIntentMilliseconds >=
            mobileCruiseConfig.reverseActivationDelayMilliseconds
          ) {
            reverseState = 'reversing';
          }
        } else {
          this.reverseIntentMilliseconds = 0;
        }
        break;
      case 'reversing':
        targetSpeedKilometersPerHour = 0;
        if (!downIntent) {
          reverseState = 'forward';
          this.reverseIntentMilliseconds = 0;
        }
        break;
    }

    this.mobileReverseState = reverseState;
    const reversing = reverseState === 'reversing';

    const next: MobileCruiseTarget = {
      targetSpeedKilometersPerHour,
      selectedGear: mobileCruiseGear(targetSpeedKilometersPerHour),
      braking:
        reverseState === 'braking-to-stop' ||
        (reverseState === 'forward' && intent < 0 && !stopped),
      reversing,
      reverseState,
    };
    this.mobileCruiseTarget = next;
    const effectiveTarget = this.mobileBoostState.active
      ? {
          ...next,
          targetSpeedKilometersPerHour:
            mobileCruiseConfig.boostTargetSpeedKilometersPerHour,
        }
      : next;
    const requestedThrottle = mobileCruiseThrottle(
      effectiveTarget,
      currentSpeedMetersPerSecond,
      intent,
    );
    this.mobileCruiseThrottle =
      !this.mobileBoostState.active &&
      Date.now() < this.mobileBoostRecoveryUntil &&
      intent >= 0 &&
      requestedThrottle < 0
        ? Math.max(
            requestedThrottle,
            -mobileCruiseConfig.boostRecoveryMaximumBrake,
          )
        : requestedThrottle;

    const now = performance.now();
    const immediateStateChange =
      previous.selectedGear !== next.selectedGear ||
      previous.braking !== next.braking ||
      previous.reversing !== next.reversing ||
      previous.reverseState !== next.reverseState;
    const roundedTarget = Math.round(next.targetSpeedKilometersPerHour);
    if (
      immediateStateChange ||
      (roundedTarget !== this.lastNotifiedCruiseTarget &&
        now - this.lastCruiseNotificationAt >=
          mobileCruiseConfig.diagnosticsUpdateIntervalMilliseconds)
    ) {
      this.lastCruiseNotificationAt = now;
      this.lastNotifiedCruiseTarget = roundedTarget;
      this.notify();
    }
  }

  getMobileCruiseTarget(): MobileCruiseTarget {
    return this.mobileCruiseTarget;
  }

  retryArcadeAcceleration(): void {
    const targetSpeedKilometersPerHour = Math.max(
      this.mobileCruiseTarget.targetSpeedKilometersPerHour,
      mobileCruiseConfig.arcadeInitialTargetSpeedKilometersPerHour,
    );
    this.mobileReverseState = 'forward';
    this.reverseIntentMilliseconds = 0;
    this.mobileCruiseVerticalIntent = 0;
    this.mobileCruiseTarget = {
      targetSpeedKilometersPerHour,
      selectedGear: mobileCruiseGear(targetSpeedKilometersPerHour),
      braking: false,
      reversing: false,
      reverseState: 'forward',
    };
    this.notify();
  }

  setAutoThrottle(enabled: boolean, targetThrottle = 0.72): void {
    const next = {
      enabled,
      targetThrottle: Math.max(0, clampAnalogInput(targetThrottle)),
    };
    if (
      this.autoThrottle.enabled === next.enabled &&
      this.autoThrottle.targetThrottle === next.targetThrottle
    ) {
      return;
    }
    this.autoThrottle = next;
    this.notify();
  }

  toggleAutoThrottle(targetThrottle = 0.72): boolean {
    this.setAutoThrottle(!this.autoThrottle.enabled, targetThrottle);
    return this.autoThrottle.enabled;
  }

  disableAutoThrottle(): void {
    if (!this.autoThrottle.enabled) return;
    this.autoThrottle = { ...this.autoThrottle, enabled: false };
    this.notify();
  }

  activateMobileBoost(
    availability: MobileBoostAvailability = { fuel: 1, condition: 1 },
  ): boolean {
    const state = this.mobileBoostState;
    if (
      availability.fuel <= 0 ||
      availability.condition <= 0 ||
      state.active ||
      state.cooldownRemainingMilliseconds > 0
    ) {
      return false;
    }
    const now = Date.now();
    this.mobileBoostActiveUntil = now + mobileBoostConfig.durationMilliseconds;
    this.mobileBoostCooldownUntil =
      this.mobileBoostActiveUntil + mobileBoostConfig.cooldownMilliseconds;
    this.updateMobileBoostState();
    this.startMobileBoostTicker();
    this.notify();
    return true;
  }

  cancelActiveMobileBoostPreservingCooldown(): void {
    this.updateMobileBoostState();
    if (!this.mobileBoostState.active) return;
    this.mobileBoostActiveUntil = 0;
    this.updateMobileBoostState();
    this.startMobileBoostTicker();
    this.notify();
  }

  resetMobileBoostCompletely(): void {
    if (this.clearMobileBoostState()) this.notify();
  }

  getMobileBoostState(): MobileBoostState {
    return this.mobileBoostState;
  }

  private updateMobileBoostState(): void {
    const now = Date.now();
    const wasActive = this.mobileBoostState.active;
    const remainingMilliseconds = Math.max(
      0,
      this.mobileBoostActiveUntil - now,
    );
    const active = remainingMilliseconds > 0;
    this.mobileBoostState = {
      active,
      remainingMilliseconds,
      cooldownRemainingMilliseconds: active
        ? 0
        : Math.max(0, this.mobileBoostCooldownUntil - now),
    };
    if (wasActive && !active) {
      this.mobileBoostRecoveryUntil =
        now + mobileCruiseConfig.boostRecoveryMilliseconds;
    }
  }

  setAutoThrottleScale(value: number): void {
    const next = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
    if (this.autoThrottleScale === next) return;
    this.autoThrottleScale = next;
    this.notify();
  }

  setPointerActive(pointerId: number, active: boolean): void {
    const changed = active
      ? !this.activePointerIds.has(pointerId)
      : this.activePointerIds.has(pointerId);
    if (active) this.activePointerIds.add(pointerId);
    else this.activePointerIds.delete(pointerId);
    if (changed) this.notify();
  }

  clearPointerActions(): void {
    const boostWasActive = this.mobileBoostState.active;
    this.cancelActiveMobileBoostPreservingCooldown();
    const changed =
      this.pointerActions.size > 0 ||
      this.touchThrottle !== 0 ||
      this.joystickThrottle !== 0 ||
      this.joystickTurn !== 0 ||
      this.mobileCruiseVerticalIntent !== 0 ||
      this.mobileCruiseTarget.braking ||
      this.mobileCruiseTarget.reversing ||
      this.mobileReverseState !== 'forward' ||
      this.activePointerIds.size > 0 ||
      boostWasActive;
    for (const timer of this.pointerReleaseTimers.values()) clearTimeout(timer);
    this.pointerReleaseTimers.clear();
    this.pointerActions.clear();
    this.touchThrottle = 0;
    this.joystickThrottle = 0;
    this.joystickTurn = 0;
    this.mobileCruiseVerticalIntent = 0;
    this.reverseIntentMilliseconds = 0;
    this.mobileReverseState = 'forward';
    this.arcadeTargetJustLatched = false;
    this.mobileCruiseTarget = {
      ...this.mobileCruiseTarget,
      braking: false,
      reversing: false,
      reverseState: 'forward',
    };
    this.activePointerIds.clear();
    if (changed) this.notify();
  }

  clearAllInput(): void {
    const boostWasActive = this.mobileBoostState.active;
    this.cancelActiveMobileBoostPreservingCooldown();
    const changed =
      this.keyboardActions.size > 0 ||
      this.pointerActions.size > 0 ||
      this.pointerReleaseTimers.size > 0 ||
      this.touchThrottle !== 0 ||
      this.joystickThrottle !== 0 ||
      this.joystickTurn !== 0 ||
      this.mobileCruiseVerticalIntent !== 0 ||
      this.mobileCruiseThrottle !== 0 ||
      this.mobileCruiseTarget.targetSpeedKilometersPerHour !== 0 ||
      this.autoThrottle.enabled ||
      this.activePointerIds.size > 0 ||
      boostWasActive;
    for (const timer of this.pointerReleaseTimers.values()) clearTimeout(timer);
    this.pointerReleaseTimers.clear();
    this.keyboardActions.clear();
    this.pointerActions.clear();
    this.touchThrottle = 0;
    this.joystickThrottle = 0;
    this.joystickTurn = 0;
    this.mobileCruiseVerticalIntent = 0;
    this.mobileCruiseThrottle = 0;
    this.mobileCruiseTarget = { ...stoppedMobileCruiseTarget };
    this.reverseIntentMilliseconds = 0;
    this.mobileReverseState = 'forward';
    this.arcadeTargetJustLatched = false;
    this.lastNotifiedCruiseTarget = 0;
    this.autoThrottle = { ...this.autoThrottle, enabled: false };
    this.autoThrottleScale = 1;
    this.activePointerIds.clear();
    if (changed) this.notify();
  }

  /**
   * Suspends driving input for a blocking overlay without discarding the speed
   * the player selected. Reverse always has to be armed again after it closes.
   */
  suspendForOverlay(): void {
    const preservedTarget =
      this.mobileCruiseTarget.targetSpeedKilometersPerHour;
    const changed = !this.overlaySuspended;
    this.overlaySuspended = true;
    this.clearTransientInput(true);
    this.mobileCruiseTarget = {
      targetSpeedKilometersPerHour: preservedTarget,
      selectedGear: mobileCruiseGear(preservedTarget),
      braking: false,
      reversing: false,
      reverseState: 'forward',
    };
    if (changed) this.notify();
  }

  resumeFromOverlay(): void {
    if (!this.overlaySuspended) return;
    this.clearTransientInput(true);
    this.overlaySuspended = false;
    this.notify();
  }

  private clearTransientInput(preserveCruiseTarget: boolean): void {
    const boostWasActive = this.mobileBoostState.active;
    this.cancelActiveMobileBoostPreservingCooldown();
    const changed =
      this.keyboardActions.size > 0 ||
      this.pointerActions.size > 0 ||
      this.pointerReleaseTimers.size > 0 ||
      this.touchThrottle !== 0 ||
      this.joystickThrottle !== 0 ||
      this.joystickTurn !== 0 ||
      this.mobileCruiseVerticalIntent !== 0 ||
      this.mobileCruiseThrottle !== 0 ||
      this.mobileReverseState !== 'forward' ||
      this.autoThrottle.enabled ||
      this.activePointerIds.size > 0 ||
      boostWasActive;
    for (const timer of this.pointerReleaseTimers.values()) clearTimeout(timer);
    this.pointerReleaseTimers.clear();
    this.keyboardActions.clear();
    this.pointerActions.clear();
    this.touchThrottle = 0;
    this.joystickThrottle = 0;
    this.joystickTurn = 0;
    this.mobileCruiseVerticalIntent = 0;
    this.mobileCruiseThrottle = 0;
    this.mobileReverseState = 'forward';
    this.arcadeTargetJustLatched = false;
    this.reverseIntentMilliseconds = 0;
    this.mobileCruiseTarget = preserveCruiseTarget
      ? {
          ...this.mobileCruiseTarget,
          braking: false,
          reversing: false,
          reverseState: 'forward',
        }
      : { ...stoppedMobileCruiseTarget };
    this.autoThrottle = { ...this.autoThrottle, enabled: false };
    this.autoThrottleScale = 1;
    this.activePointerIds.clear();
    if (changed) this.notify();
  }

  getInputSources(): InputSources {
    return {
      keyboardThrottle: digitalAxis(
        this.keyboardActions,
        'forward',
        'backward',
      ),
      keyboardTurn: digitalAxis(this.keyboardActions, 'right', 'left'),
      pointerThrottle: digitalAxis(this.pointerActions, 'forward', 'backward'),
      pointerTurn: digitalAxis(this.pointerActions, 'right', 'left'),
      touchThrottle: this.touchThrottle,
      joystickThrottle: this.joystickThrottle,
      joystickTurn: this.joystickTurn,
      autoThrottle: this.autoThrottle.enabled
        ? this.autoThrottle.targetThrottle * this.autoThrottleScale
        : 0,
      mobileCruiseThrottle: this.mobileCruiseEnabled
        ? this.mobileCruiseThrottle
        : 0,
      mobileCruiseVerticalIntent: this.mobileCruiseEnabled
        ? this.mobileCruiseVerticalIntent
        : 0,
    };
  }

  getAutoThrottleStatus(): AutoThrottleStatus {
    if (!this.autoThrottle.enabled) return 'off';
    const sources = this.getInputSources();
    const manualThrottle = clampAnalogInput(
      sources.keyboardThrottle +
        sources.pointerThrottle +
        sources.touchThrottle +
        sources.joystickThrottle,
    );
    return manualThrottle === 0 ? 'active' : 'suspended';
  }

  getDiagnostics(): InputDiagnostics {
    return {
      ...this.getInputSources(),
      ...this.snapshot(),
      autoThrottleStatus: this.getAutoThrottleStatus(),
      pointerActive: this.activePointerIds.size > 0,
      mobileBoost: this.getMobileBoostState(),
      mobileCruise: this.getMobileCruiseTarget(),
    };
  }

  snapshot(): PlayerInput {
    if (this.overlaySuspended) {
      return { throttle: 0, turn: 0, boost: false, interact: false };
    }
    const sources = this.getInputSources();
    const manualThrottle = clampAnalogInput(
      sources.keyboardThrottle +
        sources.pointerThrottle +
        sources.touchThrottle +
        sources.joystickThrottle,
    );
    const manualTurn = clampAnalogInput(
      sources.keyboardTurn + sources.pointerTurn + sources.joystickTurn,
    );

    return {
      throttle:
        manualThrottle === 0
          ? this.mobileCruiseEnabled
            ? sources.mobileCruiseThrottle
            : sources.autoThrottle
          : manualThrottle,
      turn: manualTurn,
      boost:
        this.keyboardActions.has('boost') ||
        this.pointerActions.has('boost') ||
        this.getMobileBoostState().active,
      interact:
        this.keyboardActions.has('interact') ||
        this.pointerActions.has('interact'),
    };
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private clearMobileBoostState(): boolean {
    const changed =
      this.mobileBoostActiveUntil > 0 ||
      this.mobileBoostCooldownUntil > 0 ||
      this.mobileBoostTimer !== null;
    if (this.mobileBoostTimer) clearTimeout(this.mobileBoostTimer);
    this.mobileBoostTimer = null;
    this.mobileBoostActiveUntil = 0;
    this.mobileBoostCooldownUntil = 0;
    this.mobileBoostRecoveryUntil = 0;
    this.mobileBoostState = {
      active: false,
      remainingMilliseconds: 0,
      cooldownRemainingMilliseconds: 0,
    };
    return changed;
  }

  private startMobileBoostTicker(): void {
    if (this.mobileBoostTimer) clearTimeout(this.mobileBoostTimer);
    const tick = () => {
      this.mobileBoostTimer = null;
      this.updateMobileBoostState();
      const state = this.mobileBoostState;
      if (!state.active && state.cooldownRemainingMilliseconds <= 0) {
        this.mobileBoostActiveUntil = 0;
        this.mobileBoostCooldownUntil = 0;
        this.notify();
        return;
      }
      this.notify();
      this.mobileBoostTimer = setTimeout(tick, 50);
    };
    this.mobileBoostTimer = setTimeout(tick, 50);
  }
}
