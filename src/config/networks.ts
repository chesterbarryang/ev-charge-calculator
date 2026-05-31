import { NetworkDatabase } from "../types";

export const BASELINE_NETWORKS: NetworkDatabase = {
  "home": {
    name: "Home Charger Profile",
    isCommercial: false,
    typeRates: { AC: 13.00, DC: 13.00 }, // Home rates are generally cheaper
    speeds: [
      { id: "ac_portable_33", powerKw: 3.3, type: "AC", label: "3.3 kW Portable AC (Level 1)" },
      { id: "ac_wallbox_74", powerKw: 7.4, type: "AC", label: "7.4 kW Single-Phase Wallbox" },
      { id: "ac_wallbox_110", powerKw: 11.0, type: "AC", label: "11.0 kW Three-Phase Wallbox" },
      { id: "dc_home_mini", powerKw: 3.0, type: "DC", label: "3.0 kW VinFast Home DC" }
    ]
  },
  "evro": {
    name: "EVro Network",
    isCommercial: true,
    typeRates: { AC: 28.50, DC: 35.00 }, // Split AC vs fast DC billing
    speeds: [
      { id: "evro_ac_calibrated", powerKw: 6.81, type: "AC", label: "6.8 kW Real-World AC (EVro)" },
      { id: "evro_dc_fast", powerKw: 50.0, type: "DC", label: "50 kW Public DC Fast Charger" }
    ]
  },
  "shell_recharge": {
    name: "Shell Recharge",
    isCommercial: true,
    typeRates: { AC: 30.00, DC: 40.00 },
    speeds: [
      { id: "shell_ac_22", powerKw: 22.0, type: "AC", label: "22 kW AC Destination Charger" },
      { id: "shell_dc_120", powerKw: 120.0, type: "DC", label: "120 kW Ultra-Fast DC Charger" }
    ]
  }
};

export function getMergedNetworks(): NetworkDatabase {
  if (typeof window === "undefined") return BASELINE_NETWORKS;
  const customData = localStorage.getItem("ev_custom_networks");
  if (!customData) return BASELINE_NETWORKS;

  try {
    const parsedCustom = JSON.parse(customData);
    return { ...BASELINE_NETWORKS, ...parsedCustom };
  } catch (e) {
    console.error("Custom infrastructure registry parsing error, rolling back.", e);
    return BASELINE_NETWORKS;
  }
}
