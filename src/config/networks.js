const BASELINE_NETWORKS = {
    "home": {
        name: "Home Charger Profile",
        isCommercial: false,
        defaultRate: 13.00,
        speeds: [
            { id: "dc_home_mini", powerKw: 3.0, type: "DC", label: "3.0 kW VinFast Home DC" },
            { id: "ac_portable_33", powerKw: 3.3, type: "AC", label: "3.3 kW Portable AC" },
            { id: "ac_wallbox_74", powerKw: 7.4, type: "AC", label: "7.4 kW Single-Phase Wallbox" }
        ]
    },
    "evro": {
        name: "EVro Network",
        isCommercial: true,
        defaultRate: 28.50,
        speeds: [
            { id: "evro_ac_calibrated", powerKw: 6.81, type: "AC", label: "6.8 kW Real-World AC (EVro)" },
            { id: "evro_dc_fast", powerKw: 50.0, type: "DC", label: "50 kW Public DC Fast Charger" }
        ]
    }
};

export function getMergedNetworks() {
    const customData = localStorage.getItem('ev_custom_networks');
    if (!customData) return BASELINE_NETWORKS;
    
    try {
        const parsedCustom = JSON.parse(customData);
        return { ...BASELINE_NETWORKS, ...parsedCustom };
    } catch (e) {
        console.error("Custom infrastructure registry parsing error, rolling back.", e);
        return BASELINE_NETWORKS;
    }
}
