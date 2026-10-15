/**
 * Hybrid Logical Clock (HLC) utility for LunaClair sync.
 *
 * Provides deterministic total ordering and causality tracking across offline
 * and distributed devices per ADR-018 and the BYOS Google Drive architecture.
 *
 * Timestamp format:
 *   `${physicalIso}_${counter.toString(16).padStart(4, '0')}_${deviceId}`
 * Example:
 *   `2026-10-15T12:00:00.000Z_0000_device-a1b2c3`
 */

export interface ParsedHlc {
  physical: string;
  counter: number;
  deviceId: string;
}

/**
 * Parses an HLC string into its physical, logical counter, and deviceId components.
 * Throws an Error if the string does not conform to the expected format.
 */
export function parseHlc(hlc: string): ParsedHlc {
  const match = /^([^_]+)_([0-9a-fA-F]{4,})_(.+)$/.exec(hlc);
  if (!match) {
    throw new Error(`Invalid HLC format: "${hlc}"`);
  }
  const [, physical, counterHex, deviceId] = match;
  const counter = parseInt(counterHex, 16);
  if (Number.isNaN(counter)) {
    throw new Error(`Invalid HLC counter in: "${hlc}"`);
  }
  return { physical, counter, deviceId };
}

/**
 * Returns true if the string conforms to the HLC timestamp format.
 */
export function isValidHlc(hlc: string): boolean {
  return /^([^_]+)_([0-9a-fA-F]{4,})_(.+)$/.test(hlc);
}

/**
 * Deterministically compares two HLC timestamps for total ordering:
 * 1. Physical time (higher timestamp wins)
 * 2. Logical counter (higher counter wins)
 * 3. deviceId tiebreak (lexicographical string comparison)
 *
 * Returns:
 *   < 0 if a < b
 *   > 0 if a > b
 *   0 if a === b
 */
export function compareHlc(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  try {
    const parsedA = parseHlc(a);
    const parsedB = parseHlc(b);

    const timeA = new Date(parsedA.physical).getTime();
    const timeB = new Date(parsedB.physical).getTime();

    if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA !== timeB) {
      return timeA - timeB;
    }

    if (parsedA.physical !== parsedB.physical) {
      return parsedA.physical.localeCompare(parsedB.physical);
    }

    if (parsedA.counter !== parsedB.counter) {
      return parsedA.counter - parsedB.counter;
    }

    return parsedA.deviceId.localeCompare(parsedB.deviceId);
  } catch {
    return a.localeCompare(b);
  }
}

/**
 * Hybrid Logical Clock generator maintaining monotonic causality for a specific device.
 */
export class HybridLogicalClock {
  readonly deviceId: string;
  private latestPhysical: string;
  private logicalCounter: number;
  private readonly clockSource: () => Date;

  constructor(deviceId: string, clockSource: () => Date = () => new Date()) {
    if (!deviceId || typeof deviceId !== 'string') {
      throw new Error('HybridLogicalClock deviceId must be a non-empty string');
    }
    this.deviceId = deviceId;
    this.clockSource = clockSource;
    this.latestPhysical = '';
    this.logicalCounter = 0;
  }

  /**
   * Generates a new strictly monotonic HLC timestamp for a local event.
   */
  now(): string {
    const pt = this.clockSource().toISOString();

    if (pt > this.latestPhysical) {
      this.latestPhysical = pt;
      this.logicalCounter = 0;
    } else {
      // Physical clock has not advanced or experienced backward skew
      this.logicalCounter += 1;
    }

    return this.format(this.latestPhysical, this.logicalCounter);
  }

  /**
   * Advances the local clock upon receiving a remote HLC timestamp.
   * Ensures subsequent local events causally succeed the received timestamp.
   */
  receive(remoteHlc: string): string {
    const remote = parseHlc(remoteHlc);
    const pt = this.clockSource().toISOString();

    let maxPhysical = this.latestPhysical;
    if (pt > maxPhysical) {
      maxPhysical = pt;
    }
    if (remote.physical > maxPhysical) {
      maxPhysical = remote.physical;
    }

    if (maxPhysical === this.latestPhysical && maxPhysical === remote.physical) {
      this.logicalCounter = Math.max(this.logicalCounter, remote.counter) + 1;
    } else if (maxPhysical === this.latestPhysical) {
      this.logicalCounter += 1;
    } else if (maxPhysical === remote.physical) {
      this.logicalCounter = remote.counter + 1;
    } else {
      // Physical clock pt is strictly ahead of both
      this.logicalCounter = 0;
    }

    this.latestPhysical = maxPhysical;
    return this.format(this.latestPhysical, this.logicalCounter);
  }

  private format(physical: string, counter: number): string {
    const counterHex = counter.toString(16).padStart(4, '0');
    return `${physical}_${counterHex}_${this.deviceId}`;
  }
}

/**
 * Creates an instance of HybridLogicalClock for a device.
 */
export function createHlc(
  deviceId: string,
  clockSource?: () => Date
): HybridLogicalClock {
  return new HybridLogicalClock(deviceId, clockSource);
}
