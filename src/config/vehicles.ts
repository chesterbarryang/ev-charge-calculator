import { VehicleDatabase } from "../types";

export const BASELINE_VEHICLES: VehicleDatabase = {
  "jetour": {
    brand: "Jetour",
    models: {
      "t1_idm": { name: "T1 i-DM", capacityKwh: 26.7, chemistry: "LFP", supportedCharging: ["AC", "DC"], defaultLoss: "1.10" }
    }
  },
  "vinfast": {
    brand: "VinFast",
    models: {
      "vf3": { name: "VF 3", capacityKwh: 18.64, chemistry: "LFP", supportedCharging: ["DC"], defaultLoss: "1.05" },
      "vf5": { name: "VF 5 Plus", capacityKwh: 37.23, chemistry: "LFP", supportedCharging: ["AC", "DC"], defaultLoss: "1.10" }
    }
  },
  "byd": {
    brand: "BYD",
    models: {
      "atto3_std": { name: "Atto 3 Standard", capacityKwh: 49.92, chemistry: "LFP", supportedCharging: ["AC", "DC"], defaultLoss: "1.10" },
      "atto3_ext": { name: "Atto 3 Extended", capacityKwh: 60.48, chemistry: "LFP", supportedCharging: ["AC", "DC"], defaultLoss: "1.10" },
      "dolphin_std": { name: "Dolphin Standard", capacityKwh: 44.9, chemistry: "LFP", supportedCharging: ["AC", "DC"], defaultLoss: "1.10" },
      "seal_design": { name: "Seal Premium RWD", capacityKwh: 82.5, chemistry: "LFP", supportedCharging: ["AC", "DC"], defaultLoss: "1.08" }
    }
  },
  "tesla": {
    brand: "Tesla",
    models: {
      "model3_rwd": { name: "Model 3 RWD", capacityKwh: 57.5, chemistry: "LFP", supportedCharging: ["AC", "DC"], defaultLoss: "1.08" },
      "modely_rwd": { name: "Model Y RWD", capacityKwh: 60.0, chemistry: "LFP", supportedCharging: ["AC", "DC"], defaultLoss: "1.08" },
      "modely_lr": { name: "Model Y Long Range", capacityKwh: 75.0, chemistry: "NMC", supportedCharging: ["AC", "DC"], defaultLoss: "1.06" }
    }
  },
  "xiaomi": {
    brand: "Xiaomi",
    models: {
      "su7_std": { name: "SU7 Standard", capacityKwh: 73.6, chemistry: "LFP", supportedCharging: ["AC", "DC"], defaultLoss: "1.08" },
      "su7_max": { name: "SU7 Max", capacityKwh: 101.0, chemistry: "NMC (Ternary)", supportedCharging: ["AC", "DC"], defaultLoss: "1.05" }
    }
  },
  "wuling": {
    brand: "Wuling",
    models: {
      "binggo_std": { name: "Binggo Standard", capacityKwh: 31.9, chemistry: "LFP", supportedCharging: ["AC", "DC"], defaultLoss: "1.10" },
      "macaron_ev": { name: "Air EV Long Range", capacityKwh: 26.7, chemistry: "LFP", supportedCharging: ["AC"], defaultLoss: "1.12" }
    }
  }
};

export function getMergedVehicles(): VehicleDatabase {
  if (typeof window === "undefined") return BASELINE_VEHICLES;
  const customData = localStorage.getItem("ev_custom_vehicles");
  if (!customData) return BASELINE_VEHICLES;

  try {
    const parsedCustom = JSON.parse(customData);
    const merged = { ...BASELINE_VEHICLES };

    Object.keys(parsedCustom).forEach(brandKey => {
      if (merged[brandKey]) {
        // Merge models under same brand
        merged[brandKey] = {
          ...merged[brandKey],
          models: {
            ...merged[brandKey].models,
            ...parsedCustom[brandKey].models
          }
        };
      } else {
        merged[brandKey] = parsedCustom[brandKey];
      }
    });

    return merged;
  } catch (e) {
    console.error("Custom vehicles registry parsing error, rolling back to baseline.", e);
    return BASELINE_VEHICLES;
  }
}
