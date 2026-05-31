import { ChargingSessionResult } from "../types";

interface ChargingMathParams {
  mode: "soc" | "budget";
  currentSoc: number;
  targetValue: number;
  capacityKwh: number;
  chargerSpeed: number;
  rate: number;
  lossMultiplier: number;
  isDcConnection: boolean;
}

/**
 * Executes standard or curve-throttled charging math.
 * Standard AC is treated linearly. DC fast charging incorporates a thermal / physical
 * throttle curve model once state of charge crosses 80% and 90% limits.
 */
export function executeChargingMath({
  mode,
  currentSoc,
  targetValue,
  capacityKwh,
  chargerSpeed,
  rate,
  lossMultiplier,
  isDcConnection
}: ChargingMathParams): ChargingSessionResult {
  // AC charging uses loss multiplier directly; DC charging is more efficient but has internal converter limits.
  const activeLoss = isDcConnection ? Math.min(lossMultiplier, 1.05) : lossMultiplier;

  // Helper to compute DC speed throttle ratio based on beginning/ending SoC of a segment
  function getDcThrottleMultiplier(soc: number): number {
    if (soc < 80) return 1.0;
    if (soc < 90) return 0.5; // DC speeds drop to 50% between 80% and 90%
    return 0.15; // DC speeds drop to 15% between 90% and 100%
  }

  // Calculate dynamic charging hours for a range of SoC
  function calculateChargingHours(startSoc: number, endSoc: number): {
    hours: number;
    segments: { socStart: number; socEnd: number; kw: number; durationHours: number }[];
  } {
    const delta = endSoc - startSoc;
    if (delta <= 0) return { hours: 0, segments: [] };

    const netEnergyNeeded = (delta / 100) * capacityKwh;
    const totalDispensedEnergyNeeded = netEnergyNeeded * activeLoss;

    if (!isDcConnection) {
      // Linear AC Charging
      const hours = totalDispensedEnergyNeeded / chargerSpeed;
      return {
        hours,
        segments: [{ socStart: startSoc, socEnd: endSoc, kw: chargerSpeed, durationHours: hours }]
      };
    }

    // DC Multi-segment Throttling Calculation
    let remainingSoc = delta;
    let currentTempSoc = startSoc;
    let totalHours = 0;
    const segments: { socStart: number; socEnd: number; kw: number; durationHours: number }[] = [];

    // Boundaries of curve: [startSoc, 80, 90, endSoc]
    const bounds = [80, 90, 100];
    for (const bound of bounds) {
      if (currentTempSoc >= endSoc) break;
      if (currentTempSoc < bound) {
        const nextBound = Math.min(bound, endSoc);
        const segmentDelta = nextBound - currentTempSoc;
        const segmentNetEnergy = (segmentDelta / 100) * capacityKwh;
        const segmentDispensedEnergy = segmentNetEnergy * activeLoss;

        const multiplier = getDcThrottleMultiplier(currentTempSoc);
        // Minimum power is clamped to 5kW or 15% of charger speed to avoid infinite charging
        const segmentSpeed = Math.max(chargerSpeed * multiplier, 5);
        const segmentHours = segmentDispensedEnergy / segmentSpeed;

        totalHours += segmentHours;
        segments.push({
          socStart: currentTempSoc,
          socEnd: nextBound,
          kw: segmentSpeed,
          durationHours: segmentHours
        });

        currentTempSoc = nextBound;
      }
    }

    return { hours: totalHours, segments };
  }

  if (mode === "soc") {
    // Mode A: Target SoC
    const deltaSoC = targetValue - currentSoc;
    if (deltaSoC <= 0) {
      return { netEnergy: 0, costOrSocText: "₱0.00", estimatedHours: 0, cappedCost: null, segments: [] };
    }

    const netEnergyNeeded = (deltaSoC / 100) * capacityKwh;
    const totalDispensedEnergy = netEnergyNeeded * activeLoss;
    const totalCost = Math.round(totalDispensedEnergy * rate * 100) / 100;

    const { hours: estimatedHours, segments } = calculateChargingHours(currentSoc, targetValue);

    return {
      netEnergy: netEnergyNeeded,
      costOrSocText: `₱${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      estimatedHours,
      cappedCost: null,
      segments
    };
  } else {
    // Mode B: Budget Cap
    const totalDispensedEnergyAllowed = targetValue / rate;
    const netEnergyAvailable = totalDispensedEnergyAllowed / activeLoss;
    const addedSoCPercent = (netEnergyAvailable / capacityKwh) * 100;
    let projectedFinalSoC = currentSoc + addedSoCPercent;

    let trueDispensedEnergy = totalDispensedEnergyAllowed;
    let cappedCost: number | null = null;

    if (projectedFinalSoC > 100) {
      projectedFinalSoC = 100;
      const maxPossibleDelta = 100 - currentSoc;
      const maxNetEnergy = (maxPossibleDelta / 100) * capacityKwh;
      
      trueDispensedEnergy = maxNetEnergy * activeLoss;
      cappedCost = Math.round(trueDispensedEnergy * rate * 100) / 100;
    }

    const finalNetEnergyAdded = trueDispensedEnergy / activeLoss;
    const finalSoc = Math.min(100, Math.max(currentSoc, Math.round(projectedFinalSoC * 10) / 10));

    const { hours: estimatedHours, segments } = calculateChargingHours(currentSoc, finalSoc);

    return {
      netEnergy: finalNetEnergyAdded,
      costOrSocText: `${finalSoc.toFixed(1)}%`,
      estimatedHours,
      cappedCost,
      segments
    };
  }
}
