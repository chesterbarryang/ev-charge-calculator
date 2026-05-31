const BASELINE_VEHICLES = {
    "jetour": {
        brand: "Jetour",
        models: {
            "t1_idm": { name: "T1 i-DM", capacityKwh: 26.7, chemistry: "LFP", supportedCharging: ["AC", "DC"], defaultLoss: "1.10" }
        }
    },
    "vinfast": {
        brand: "VinFast",
        models: {
            "vf3": { name: "VF 3", capacityKwh: 18.64, chemistry: "LFP", supportedCharging: ["DC"], defaultLoss: "1.05" }
        }
    }
};

export function getMergedVehicles() {
    const customData = localStorage.getItem('ev_custom_vehicles');
    if (!customData) return BASELINE_VEHICLES;
    
    try {
        const parsedCustom = JSON.parse(customData);
        return { ...BASELINE_VEHICLES, ...parsedCustom };
    } catch (e) {
        console.error("Custom vehicles registry parsing error, rolling back to baseline.", e);
        return BASELINE_VEHICLES;
    }
}
