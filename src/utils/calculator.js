export function executeChargingMath({ mode, currentSoc, targetValue, capacityKwh, chargerSpeed, rate, lossMultiplier, isDcConnection }) {
    const activeLoss = isDcConnection ? Math.min(lossMultiplier, 1.05) : lossMultiplier;

    if (mode === 'soc') {
        const deltaSoC = (targetValue - currentSoc) / 100;
        const netEnergyNeeded = deltaSoC * capacityKwh;
        const totalDispensedEnergy = netEnergyNeeded * activeLoss;
        const totalCost = Math.round(totalDispensedEnergy * rate * 100) / 100;
        const estimatedHours = totalDispensedEnergy / chargerSpeed;

        return { netEnergy: netEnergyNeeded, costOrSocText: `₱${totalCost.toLocaleString('en-US', {minimumFractionDigits: 2})}`, estimatedHours, cappedCost: null };
    } else {
        const totalDispensedEnergyAllowed = targetValue / rate;
        const netEnergyToBattery = totalDispensedEnergyAllowed / activeLoss;
        const addedSoCPercent = (netEnergyToBattery / capacityKwh) * 100;
        let projectedFinalSoC = currentSoc + addedSoCPercent;

        let trueDispensedEnergy = totalDispensedEnergyAllowed;
        let estimatedHours = totalDispensedEnergyAllowed / chargerSpeed;
        let cappedCost = null;

        if (projectedFinalSoC > 100) {
            projectedFinalSoC = 100;
            const maxPossibleDelta = (100 - currentSoc) / 100;
            const maxNetEnergy = maxPossibleDelta * capacityKwh;
            
            trueDispensedEnergy = maxNetEnergy * activeLoss;
            estimatedHours = trueDispensedEnergy / chargerSpeed;
            cappedCost = Math.round(trueDispensedEnergy * rate * 100) / 100;
        }

        const finalNetEnergyAdded = trueDispensedEnergy / activeLoss;
        return { netEnergy: finalNetEnergyAdded, costOrSocText: `${projectedFinalSoC.toFixed(1)}%`, estimatedHours, cappedCost };
    }
}
