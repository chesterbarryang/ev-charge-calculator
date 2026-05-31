export interface VehicleModel {
  name: string;
  capacityKwh: number;
  chemistry: string;
  supportedCharging: ("AC" | "DC")[];
  defaultLoss: string; // e.g. "1.10"
}

export interface VehicleBrand {
  brand: string;
  models: Record<string, VehicleModel>;
}

export type VehicleDatabase = Record<string, VehicleBrand>;

export interface ChargerSpeedOption {
  id: string;
  powerKw: number;
  type: "AC" | "DC";
  label: string;
}

export interface NetworkProfile {
  name: string;
  isCommercial: boolean;
  typeRates: { AC: number; DC: number };
  speeds: ChargerSpeedOption[];
}

export type NetworkDatabase = Record<string, NetworkProfile>;

export type AppMode = "soc" | "budget";

export interface ChargingSessionResult {
  netEnergy: number;
  costOrSocText: string;
  estimatedHours: number;
  cappedCost: number | null;
  segments?: { socStart: number; socEnd: number; kw: number; durationHours: number }[];
}

export interface SessionHistoryItem {
  id: string;
  timestamp: string;
  vehicleBrand: string;
  vehicleBrandDisplay: string;
  vehicleModel: string;
  vehicleModelDisplay: string;
  mode: AppMode;
  startSoc: number;
  targetValue: number;
  resultSoc: string;
  energyKwh: number;
  costPhp: string;
  durationMinutes: number;
  gridNetwork: string;
}
