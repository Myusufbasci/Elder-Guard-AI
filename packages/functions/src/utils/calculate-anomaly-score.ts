import type { SensorReading } from "@elder-guard/core";

/**
 * Result of the anomaly scoring calculation.
 */
export interface AnomalyScoreResult {
  /** Score 0-100 (0 = normal, 100 = critical anomaly) */
  score: number;
  /** Score normalized to 0-1 range (for alert schema compatibility) */
  normalizedScore: number;
  /** Whether the input data was valid */
  isValid: boolean;
  /** Breakdown of score components for debugging */
  breakdown: {
    accelerationMagnitude: number;
    magnitudeDeviation: number;
    axisVariance: number;
    screenLockBonus: number;
  };
}

/**
 * Weighted mock formula for anomaly scoring.
 *
 * Formula:
 *   magnitude = √(x² + y² + z²)
 *   magnitudeDeviation = |magnitude - 9.81| (deviation from resting gravity)
 *   axisVariance = max(|x|, |y|, |z|) - min(|x|, |y|, |z|)
 *   rawScore = (magnitudeDeviation × 15) + (axisVariance × 10) + screenLockBonus
 *   score = clamp(rawScore, 0, 100)
 *
 * Expected ranges:
 *   - Phone resting flat: ~0-10 (gravity ≈ 9.81 on Z axis)
 *   - Normal walking:     ~15-35
 *   - Fall / sudden impact: ~70-100
 *
 * @param reading - Validated sensor reading from @elder-guard/core
 * @param isScreenLocked - Whether the elder's screen is locked (indicates inactivity)
 * @param screenLockDurationMinutes - How long the screen has been locked
 * @returns AnomalyScoreResult with score, validity, and breakdown
 */
export function calculateAnomalyScore(
  reading: SensorReading,
  isScreenLocked: boolean = false,
  screenLockDurationMinutes: number = 0
): AnomalyScoreResult {
  // ── Validate inputs ──
  const x = reading.value["x"];
  const y = reading.value["y"];
  const z = reading.value["z"];

  if (
    x === undefined ||
    y === undefined ||
    z === undefined ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(z)
  ) {
    return {
      score: 0,
      normalizedScore: 0,
      isValid: false,
      breakdown: {
        accelerationMagnitude: 0,
        magnitudeDeviation: 0,
        axisVariance: 0,
        screenLockBonus: 0,
      },
    };
  }

  // ── Acceleration magnitude ──
  const accelerationMagnitude = Math.sqrt(x * x + y * y + z * z);

  // ── Deviation from resting gravity (9.81 m/s²) ──
  const RESTING_GRAVITY = 9.81;
  const magnitudeDeviation = Math.abs(accelerationMagnitude - RESTING_GRAVITY);

  // ── Axis variance: spread between highest and lowest absolute axis values ──
  const absValues = [Math.abs(x), Math.abs(y), Math.abs(z)];
  const axisVariance = Math.max(...absValues) - Math.min(...absValues);

  // ── Screen lock bonus (inactivity indicator) ──
  // Prolonged screen lock + low movement is concerning (elder may be immobile)
  let screenLockBonus = 0;
  if (isScreenLocked) {
    // Base bonus for locked screen
    screenLockBonus = 5;
    // Additional bonus for prolonged lock (capped at 15 extra)
    screenLockBonus += Math.min(screenLockDurationMinutes * 0.5, 15);
  }

  // ── Compute raw score ──
  const MAGNITUDE_WEIGHT = 15;
  const VARIANCE_WEIGHT = 10;

  const rawScore =
    magnitudeDeviation * MAGNITUDE_WEIGHT +
    axisVariance * VARIANCE_WEIGHT +
    screenLockBonus;

  // ── Clamp to 0-100 ──
  const score = Math.round(Math.max(0, Math.min(100, rawScore)) * 100) / 100;
  const normalizedScore = Math.round((score / 100) * 100) / 100;

  return {
    score,
    normalizedScore,
    isValid: true,
    breakdown: {
      accelerationMagnitude:
        Math.round(accelerationMagnitude * 1000) / 1000,
      magnitudeDeviation: Math.round(magnitudeDeviation * 1000) / 1000,
      axisVariance: Math.round(axisVariance * 1000) / 1000,
      screenLockBonus: Math.round(screenLockBonus * 100) / 100,
    },
  };
}
