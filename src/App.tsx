import { useState, useEffect, useRef } from "react";
import {
  Battery, Zap, Settings, Clock, Plus, RotateCcw, Trash2, Volume2,
  VolumeX, Info, Coins, Download, Upload, CheckCircle2, AlertTriangle, Play, Square, History, X, ChevronRight
} from "lucide-react";
import { getMergedVehicles } from "./config/vehicles";
import { getMergedNetworks } from "./config/networks";
import { executeChargingMath } from "./utils/calculator";
import * as alarmEngine from "./utils/audioAlarm";
import {
  VehicleDatabase, NetworkDatabase, AppMode, SessionHistoryItem, ChargingSessionResult
} from "./types";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  // --- Standard Data Bases ---
  const [vehicles, setVehicles] = useState<VehicleDatabase>(getMergedVehicles());
  const [networks, setNetworks] = useState<NetworkDatabase>(getMergedNetworks());

  // --- Core Application State ---
  const [mode, setMode] = useState<AppMode>(() => {
    return (localStorage.getItem("ev_saved_mode") as AppMode) || "soc";
  });
  const [vehicleBrand, setVehicleBrand] = useState<string>(() => {
    return localStorage.getItem("ev_saved_brand") || "jetour";
  });
  const [vehicleModel, setVehicleModel] = useState<string>(() => {
    return localStorage.getItem("ev_saved_model") || "t1_idm";
  });
  const [network, setNetwork] = useState<string>(() => {
    return localStorage.getItem("ev_saved_network") || "evro";
  });
  const [rate, setRate] = useState<number>(() => {
    return parseFloat(localStorage.getItem("ev_saved_rate") || "28.5");
  });
  const [efficiency, setEfficiency] = useState<string>(() => {
    return localStorage.getItem("ev_saved_efficiency") || "1.10";
  });

  const [currentSoc, setCurrentSoc] = useState<number>(20);
  const [targetSoc, setTargetSoc] = useState<number>(80);
  const [targetBudget, setTargetBudget] = useState<number>(500);

  const [plugTime, setPlugTime] = useState<string>(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  });

  // --- Specific Charging Power Selection ---
  const [chargerSpeed, setChargerSpeed] = useState<number>(6.81);
  const [chargerType, setChargerType] = useState<"AC" | "DC">("AC");

  // --- Real-Time Countdown State ---
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [isAlarmSounding, setIsAlarmSounding] = useState<boolean>(false);

  // --- Modals, UI Toggles, & History Log ---
  const [showMaintenance, setShowMaintenance] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<SessionHistoryItem[]>(() => {
    const raw = localStorage.getItem("ev_session_history");
    return raw ? JSON.parse(raw) : [];
  });

  // --- Maintenance Registration Form Values ---
  const [formVehBrand, setFormVehBrand] = useState<string>("");
  const [formVehName, setFormVehName] = useState<string>("");
  const [formVehCap, setFormVehCap] = useState<string>("");
  const [formVehType, setFormVehType] = useState<"AC_DC" | "DC">("AC_DC");

  const [formNetName, setFormNetName] = useState<string>("");
  const [formNetRateAc, setFormNetRateAc] = useState<string>("");
  const [formNetRateDc, setFormNetRateDc] = useState<string>("");

  const [formTerminalCompany, setFormTerminalCompany] = useState<string>("home");
  const [formTerminalLabel, setFormTerminalLabel] = useState<string>("");
  const [formTerminalKw, setFormTerminalKw] = useState<string>("");
  const [formTerminalType, setFormTerminalType] = useState<"AC" | "DC">("AC");

  // --- Audio / Web API references ---
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const countdownIntervalRef = useRef<any>(null);

  // --- 1. Load Custom Registries / Profile Configs ---
  const getProfilesConfig = () => {
    const config = localStorage.getItem("ev_profile_configs");
    return config ? JSON.parse(config) : {
      "jetour_t1_idm": { network: "evro", rate: 28.5, efficiency: "1.10" },
      "vinfast_vf3": { network: "home", rate: 13.0, efficiency: "1.05" }
    };
  };

  // --- 2. Initialize current local clock ---
  const handleResetTimeToNow = () => {
    const now = new Date();
    setPlugTime(`${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`);
  };

  // --- 3. Dynamic Filtering based on Vehicle Support ---
  const activeVehicle = vehicles[vehicleBrand]?.models[vehicleModel] || {
    name: "Unknown Charger Profile",
    capacityKwh: 26.7,
    chemistry: "LFP",
    supportedCharging: ["AC"],
    defaultLoss: "1.10"
  };

  const currentNetworkData = networks[network] || networks["home"];
  const validSpeeds = currentNetworkData.speeds.filter(s =>
    activeVehicle.supportedCharging.includes(s.type)
  );

  // Auto-align vehicle-specific settings and active charger power
  useEffect(() => {
    // Sync current charger speed to first available valid power
    if (validSpeeds.length > 0) {
      const match = validSpeeds[0];
      setChargerSpeed(match.powerKw);
      setChargerType(match.type);
    }
  }, [vehicleBrand, vehicleModel, network]);

  // Persist current mode
  useEffect(() => {
    localStorage.setItem("ev_saved_mode", mode);
  }, [mode]);

  // --- 4. Main Charging Computational Engine ---
  const calculationResult: ChargingSessionResult = executeChargingMath({
    mode,
    currentSoc,
    targetValue: mode === "soc" ? targetSoc : targetBudget,
    capacityKwh: activeVehicle.capacityKwh,
    chargerSpeed,
    rate,
    lossMultiplier: parseFloat(efficiency),
    isDcConnection: chargerType === "DC"
  });

  // Check validity limit
  const isInputBroken = mode === "soc" && targetSoc <= currentSoc;

  // Track projected Ready At and estimated Countdown
  const totalMinutesLeft = isInputBroken ? 0 : Math.round(calculationResult.estimatedHours * 60);
  
  // Update theoretical base seconds when calculations shift and timer is NOT running
  useEffect(() => {
    if (!isTimerRunning) {
      setSecondsRemaining(totalMinutesLeft * 60);
    }
  }, [totalMinutesLeft, isTimerRunning]);

  // --- 5. Interactive Switcher: Loading Vehicle-Specific Settings ---
  const handleVehicleChange = (brandKey: string, modelKey: string) => {
    if (isTimerRunning) return;

    // Step A: Save current settings to the OUTGOING vehicle profiles mapping
    const outboundKey = `${vehicleBrand}_${vehicleModel}`;
    const profiles = getProfilesConfig();
    profiles[outboundKey] = { network, rate, efficiency };
    localStorage.setItem("ev_profile_configs", JSON.stringify(profiles));

    // Step B: Set brand and model to the state
    setVehicleBrand(brandKey);
    setVehicleModel(modelKey);
    localStorage.setItem("ev_saved_brand", brandKey);
    localStorage.setItem("ev_saved_model", modelKey);

    // Step C: Look up and restore saved profiles for the INCOMING vehicle
    const targetKey = `${brandKey}_${modelKey}`;
    const restored = profiles[targetKey] || { network: "home", rate: 13.0, efficiency: "1.10" };

    setNetwork(restored.network);
    setRate(restored.rate);
    setEfficiency(restored.efficiency);

    localStorage.setItem("ev_saved_network", restored.network);
    localStorage.setItem("ev_saved_rate", restored.rate.toString());
    localStorage.setItem("ev_saved_efficiency", restored.efficiency);
  };

  // Handle manual rate tweaks or quick shortcuts
  const handleRateUpdate = (newRate: number) => {
    setRate(newRate);
    localStorage.setItem("ev_saved_rate", newRate.toString());
    
    // Save to active vehicle profile space too
    const activeKey = `${vehicleBrand}_${vehicleModel}`;
    const profiles = getProfilesConfig();
    profiles[activeKey] = { network, rate: newRate, efficiency };
    localStorage.setItem("ev_profile_configs", JSON.stringify(profiles));
  };

  // Handle manual network changes
  const handleNetworkChange = (networkKey: string) => {
    setNetwork(networkKey);
    localStorage.setItem("ev_saved_network", networkKey);

    // Default rate for network lookup
    const chosenNet = networks[networkKey] || networks["home"];
    const backupChargeType = validSpeeds[0]?.type || "AC";
    const defaultNetworkRate = chosenNet.typeRates[backupChargeType] || chosenNet.typeRates.AC || 13.00;
    
    setRate(defaultNetworkRate);
    localStorage.setItem("ev_saved_rate", defaultNetworkRate.toString());

    // Save profile record
    const activeKey = `${vehicleBrand}_${vehicleModel}`;
    const profiles = getProfilesConfig();
    profiles[activeKey] = { network: networkKey, rate: defaultNetworkRate, efficiency };
    localStorage.setItem("ev_profile_configs", JSON.stringify(profiles));
  };

  // Handle efficiency updates
  const handleEfficiencyChange = (newEff: string) => {
    setEfficiency(newEff);
    localStorage.setItem("ev_saved_efficiency", newEff);

    // Save profile record
    const activeKey = `${vehicleBrand}_${vehicleModel}`;
    const profiles = getProfilesConfig();
    profiles[activeKey] = { network, rate, efficiency: newEff };
    localStorage.setItem("ev_profile_configs", JSON.stringify(profiles));
  };

  // --- 6. Countdown Alarm Management ---
  const handleToggleTimer = () => {
    if (isAlarmSounding) {
      // Silence alarm directly
      alarmEngine.clearSynthAlarm();
      setIsAlarmSounding(false);
      setIsTimerRunning(false);
      setSecondsRemaining(totalMinutesLeft * 60);
      return;
    }

    if (isTimerRunning) {
      // Clear interval
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      alarmEngine.clearSynthAlarm();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsTimerRunning(false);
      setSecondsRemaining(totalMinutesLeft * 60);
    } else {
      if (secondsRemaining <= 0) return;
      
      // Initialize Audio context on first direct user gesture
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      if (audioRef.current) {
        alarmEngine.playSilentStream(audioRef.current);
      }

      setIsTimerRunning(true);

      countdownIntervalRef.current = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
            setIsAlarmSounding(true);
            
            // Firing the synth alarm beeps
            if (audioContextRef.current) {
              const dummyBtn = document.createElement("button");
              const dummyTxt = document.createElement("p");
              alarmEngine.startSynthAlarm(audioContextRef.current, dummyBtn as any, dummyTxt as any);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  // Clean interval timer on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Compute clocks display formatted target Date
  const getProjectedTargetTime = () => {
    const [h, m] = plugTime.split(":").map(Number);
    const date = new Date();
    date.setHours(h);
    date.setMinutes(m + totalMinutesLeft);

    let formatH = date.getHours();
    const formatM = date.getMinutes().toString().padStart(2, "0");
    const ampm = formatH >= 12 ? "PM" : "AM";
    const TwelveH = formatH % 12 || 12;
    return `${TwelveH}:${formatM} ${ampm}`;
  };

  // Format countdown seconds left to H M S
  const formatCountdown = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? h + "h " : ""}${m}m ${s}s left`;
  };

  // --- 7. History Log Actions ---
  const handleLogActiveSession = () => {
    if (isInputBroken || totalMinutesLeft <= 0) return;

    const brandDisplay = vehicles[vehicleBrand]?.brand || vehicleBrand;
    const modelDisplay = activeVehicle.name;
    const finalSocResult = mode === "soc" ? `${targetSoc}%` : calculationResult.costOrSocText;
    const finalCostResult = mode === "soc" ? calculationResult.costOrSocText : `₱${targetBudget.toFixed(2)}`;

    const newItem: SessionHistoryItem = {
      id: "sh_" + Date.now(),
      timestamp: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      vehicleBrand,
      vehicleBrandDisplay: brandDisplay,
      vehicleModel,
      vehicleModelDisplay: modelDisplay,
      mode,
      startSoc: currentSoc,
      targetValue: mode === "soc" ? targetSoc : targetBudget,
      resultSoc: finalSocResult,
      energyKwh: calculationResult.netEnergy,
      costPhp: finalCostResult,
      durationMinutes: totalMinutesLeft,
      gridNetwork: networks[network]?.name || network
    };

    const newHistory = [newItem, ...historyList].slice(0, 30); // Cap at latest 30 sessions
    setHistoryList(newHistory);
    localStorage.setItem("ev_session_history", JSON.stringify(newHistory));
  };

  const handleClearHistory = () => {
    if (window.confirm("Do you want to wipe all stored charging records?")) {
      setHistoryList([]);
      localStorage.removeItem("ev_session_history");
    }
  };

  const handleRemoveHistoryItem = (id: string) => {
    const newHistory = historyList.filter(item => item.id !== id);
    setHistoryList(newHistory);
    localStorage.setItem("ev_session_history", JSON.stringify(newHistory));
  };

  // --- 8. Maintenance Registries ---
  const handleSaveCustomVehicle = () => {
    if (!formVehBrand.trim() || !formVehName.trim() || !formVehCap) {
      alert("Please specify Brand, Model, and Battery Capacity.");
      return;
    }

    const brandRaw = formVehBrand.trim();
    const name = formVehName.trim();
    const cap = parseFloat(formVehCap);

    if (isNaN(cap) || cap <= 0) {
      alert("Battery Pack Capacity must be a positive number.");
      return;
    }

    const brandKey = brandRaw.toLowerCase().replace(/\s+/g, "");
    const modelKey = name.toLowerCase().replace(/\s+/g, "_");
    const supportedCharging = formVehType === "AC_DC" ? ["AC" as const, "DC" as const] : ["DC" as const];
    const defaultLoss = formVehType === "AC_DC" ? "1.10" : "1.05";

    const customVehicles = JSON.parse(localStorage.getItem("ev_custom_vehicles") || "{}");
    if (!customVehicles[brandKey]) customVehicles[brandKey] = { brand: brandRaw, models: {} };

    customVehicles[brandKey].models[modelKey] = {
      name,
      capacityKwh: cap,
      chemistry: "LFP (User Custom)",
      supportedCharging,
      defaultLoss
    };

    localStorage.setItem("ev_custom_vehicles", JSON.stringify(customVehicles));

    // Dynamic refesh state
    const merged = getMergedVehicles();
    setVehicles(merged);
    
    // Auto-select
    handleVehicleChange(brandKey, modelKey);

    // Reset forms
    setFormVehBrand("");
    setFormVehName("");
    setFormVehCap("");
    alert(`Successfully registered custom EV Profile: ${brandRaw} ${name}`);
  };

  const handleSaveCustomNetwork = () => {
    if (!formNetName.trim() || !formNetRateAc || !formNetRateDc) {
      alert("Please provide the company name and both AC/DC utility prices.");
      return;
    }

    const name = formNetName.trim();
    const acRate = parseFloat(formNetRateAc);
    const dcRate = parseFloat(formNetRateDc);

    if (isNaN(acRate) || acRate <= 0 || isNaN(dcRate) || dcRate <= 0) {
      alert("Charging rates must be valid numbers greater than 0.");
      return;
    }

    const networkKey = name.toLowerCase().replace(/\s+/g, "_");
    const customNetworks = JSON.parse(localStorage.getItem("ev_custom_networks") || "{}");

    customNetworks[networkKey] = {
      name,
      isCommercial: true,
      typeRates: { AC: acRate, DC: dcRate },
      speeds: []
    };

    localStorage.setItem("ev_custom_networks", JSON.stringify(customNetworks));

    // Refresh state
    const merged = getMergedNetworks();
    setNetworks(merged);
    setNetwork(networkKey);

    // Reset forms
    setFormNetName("");
    setFormNetRateAc("");
    setFormNetRateDc("");
    alert(`Custom Company added dynamically: ${name}`);
  };

  const handleSaveTerminalOutlet = () => {
    if (!formTerminalLabel.trim() || !formTerminalKw) {
      alert("Please specify Terminal Location/Label and active Power rating.");
      return;
    }

    const label = formTerminalLabel.trim();
    const power = parseFloat(formTerminalKw);

    if (isNaN(power) || power <= 0) {
      alert("Power level must be a valid number.");
      return;
    }

    const customNetworks = JSON.parse(localStorage.getItem("ev_custom_networks") || "{}");
    const baseNetworks = getMergedNetworks();

    // Copy original network node to local storage first, if not customized yet
    if (!customNetworks[formTerminalCompany]) {
      customNetworks[formTerminalCompany] = JSON.parse(JSON.stringify(baseNetworks[formTerminalCompany]));
    }

    const uniqueId = `custom_${label.toLowerCase().replace(/\s+/g, "_")}_${Date.now().toString().slice(-4)}`;
    customNetworks[formTerminalCompany].speeds.push({
      id: uniqueId,
      powerKw: power,
      type: formTerminalType,
      label: `${label} (${power}kW ${formTerminalType})`
    });

    localStorage.setItem("ev_custom_networks", JSON.stringify(customNetworks));

    // Refresh networks lists
    const merged = getMergedNetworks();
    setNetworks(merged);

    // Reset forms
    setFormTerminalLabel("");
    setFormTerminalKw("");
    alert(`Success: Port Terminal registered to ${baseNetworks[formTerminalCompany]?.name || formTerminalCompany}`);
  };

  const handleResetRegistryData = () => {
    if (window.confirm("WARNING: This will wipe all recorded custom vehicles, commercial charging networks and speed ports. Proceed?")) {
      localStorage.removeItem("ev_custom_vehicles");
      localStorage.removeItem("ev_custom_networks");
      localStorage.removeItem("ev_profile_configs");
      
      // Reset component instances
      setVehicles(getMergedVehicles());
      setNetworks(getMergedNetworks());
      setVehicleBrand("jetour");
      setVehicleModel("t1_idm");
      setNetwork("evro");
      setRate(28.5);
      setEfficiency("1.10");
      alert("All registries returned to factory settings!");
    }
  };

  // Target values bounds based on mode
  const resolvedTargetSoC = mode === "soc" ? targetSoc : parseFloat(calculationResult.costOrSocText) || 0;

  // Render list of vehicle brands recursively
  const getFlatVehicles = () => {
    const list: { brandKey: string; modelKey: string; name: string }[] = [];
    Object.keys(vehicles).forEach(brandKey => {
      const brandObj = vehicles[brandKey];
      Object.keys(brandObj.models).forEach(modelKey => {
        list.push({
          brandKey,
          modelKey,
          name: `${brandObj.brand} ${brandObj.models[modelKey].name}`
        });
      });
    });
    return list;
  };

  return (
    <div className="min-h-screen text-slate-100 p-3 md:p-6 pb-20 font-sans flex flex-col justify-between" id="app_root_node">
      {/* Background preventers */}
      <audio
        ref={audioRef}
        id="silent-bg-player"
        loop
        src="data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA=="
      />

      <div className="max-w-xl mx-auto w-full space-y-6">
        {/* HEADER SECTION */}
        <header className="border-b border-slate-800/80 pb-4 space-y-3" id="app_header">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-emerald-400 bg-linear-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent">
                EV Dashboard
              </h1>
              <p className="text-xs text-slate-400">
                Modular Smart Charging Calculation Engine
              </p>
            </div>
            
            {/* Battery chemistry indication pill */}
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 text-xs font-semibold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {activeVehicle.chemistry} Battery Chemistry
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Selected Vehicle Register
            </label>
            <select
              id="vehicle-brand"
              value={`${vehicleBrand}_${vehicleModel}`}
              onChange={(e) => {
                const [brand, model] = e.target.value.split("_");
                handleVehicleChange(brand, model);
              }}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-sm rounded-xl block w-full p-3 font-semibold outline-hidden focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
            >
              {getFlatVehicles().map(item => (
                <option key={`${item.brandKey}_${item.modelKey}`} value={`${item.brandKey}_${item.modelKey}`}>
                  🚗 {item.name} ({vehicles[item.brandKey].models[item.modelKey].capacityKwh} kWh)
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* MODE SELECTOR */}
        <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800" id="calculation_modes">
          <button
            onClick={() => setMode("soc")}
            className={`flex-1 py-2 text-xs md:text-sm rounded-lg font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
              mode === "soc"
                ? "bg-emerald-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Battery className="w-4 h-4" />
            Mode 1: Target SoC (%)
          </button>
          
          <button
            onClick={() => setMode("budget")}
            className={`flex-1 py-2 text-xs md:text-sm rounded-lg font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
              mode === "budget"
                ? "bg-emerald-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Coins className="w-4 h-4" />
            Mode 2: Budget Capped (₱)
          </button>
        </div>

        {/* INPUT LAYOUT WITH EMBEDDED ANIMATED BATTERY DISPLAY */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          
          {/* Main Controls Panel */}
          <div className="md:col-span-8 bg-slate-900 border border-slate-800/80 rounded-2xl p-5 space-y-5 shadow-xl">
            {/* Beginning SoC Section */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-slate-300">
                  Beginning SoC
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={currentSoc}
                    disabled={isTimerRunning}
                    onChange={(e) => {
                      const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                      setCurrentSoc(val);
                    }}
                    className="w-16 bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-center text-sm outline-hidden text-emerald-400 font-bold focus:border-emerald-500 disabled:opacity-50"
                  />
                  <span className="text-slate-500 text-sm font-semibold">%</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={currentSoc}
                disabled={isTimerRunning}
                onChange={(e) => {
                  setCurrentSoc(parseInt(e.target.value));
                }}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-40"
              />
            </div>

            <hr className="border-slate-800/40" />

            {/* Target Value Section */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-slate-300">
                  {mode === "soc" ? "Target SoC" : "Target Budget Allowance"}
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 text-sm font-bold">
                    {mode === "soc" ? "" : "₱"}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max={mode === "soc" ? 100 : 99999}
                    value={mode === "soc" ? targetSoc : targetBudget}
                    disabled={isTimerRunning}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      if (mode === "soc") {
                        setTargetSoc(Math.min(100, Math.max(0, val)));
                      } else {
                        setTargetBudget(val);
                      }
                    }}
                    className="w-24 bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-center text-sm outline-hidden text-emerald-400 font-bold focus:border-emerald-500 disabled:opacity-50"
                  />
                  <span className="text-slate-500 text-sm font-semibold">
                    {mode === "soc" ? "%" : ""}
                  </span>
                </div>
              </div>

              {mode === "soc" && (
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={targetSoc}
                  disabled={isTimerRunning}
                  onChange={(e) => {
                    setTargetSoc(parseInt(e.target.value));
                  }}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-40"
                />
              )}
            </div>

            {/* Guidance Advisory messages */}
            <div className="transition-all duration-300">
              {isInputBroken ? (
                <div className="text-xs rounded-xl p-3 border font-medium bg-rose-500/10 border-rose-500/20 text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  Beginning charge meets or exceeds requested target State of Charge.
                </div>
              ) : resolvedTargetSoC >= 100 ? (
                <div className="text-xs rounded-xl p-3 border font-medium bg-emerald-500/10 border-emerald-500/20 text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 text-emerald-400 h-4 shrink-0" />
                  Full 100% Top-Off: Ideal for cell-balancing and keeping BMS status accurate.
                </div>
              ) : (
                <div className="text-xs rounded-xl p-3 border font-medium bg-amber-500/10 border-amber-500/20 text-amber-400 flex items-center gap-2">
                  <Info className="w-4 text-amber-400 h-4 shrink-0" />
                  Weekly Recency Advised: Topping off to {resolvedTargetSoC.toFixed(0)}%. Charge to 100% periodically to prevent cell deviation.
                </div>
              )}
            </div>
          </div>

          {/* ANIMATED BATTERY VISUALIZER PANEL */}
          <div className="md:col-span-4 bg-slate-900 border border-slate-800/85 rounded-2xl p-5 shadow-xl flex flex-col justify-between items-center relative overflow-hidden">
            <span className="absolute top-2 left-3 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
              Live Cell Vis
            </span>
            
            {/* Actual Battery Body Frame */}
            <div className="w-16 h-32 border-4 border-slate-700 rounded-xl relative flex flex-col justify-end p-1 mt-4">
              {/* Battery cap */}
              <div className="absolute -top-3 left-1/2 -ml-2.5 w-5 h-2 bg-slate-700 rounded-t-sm" />
              
              {/* Beginning SoC fill (darker blue) */}
              <div
                className="w-full bg-slate-700/60 transition-all duration-500 rounded-sm"
                style={{ height: `${currentSoc}%` }}
              />

              {/* Added target fill (Glowing Emerald) */}
              {!isInputBroken && resolvedTargetSoC > currentSoc && (
                <div
                  className="w-full bg-emerald-500 rounded-sm shadow-[0_0_12px_rgba(16,185,129,0.5)] transition-all duration-500 absolute bottom-1 left-1 right-1"
                  style={{
                    height: `${resolvedTargetSoC - currentSoc}%`,
                    bottom: `calc(4px + ${currentSoc * 1.15}px)`
                  }}
                />
              )}

              {/* Centered pulse core lightning */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {isTimerRunning ? (
                  <Zap className="text-emerald-300 w-8 h-8 drop-shadow-[0_0_10px_rgba(110,231,183,0.8)] animate-bounce" />
                ) : (
                  <Zap className="text-slate-600 w-5 h-5 opacity-40" />
                )}
              </div>
            </div>

            {/* Readout metrics */}
            <div className="w-full text-center space-y-1 mt-3">
              <p className="text-xs font-bold text-slate-400">
                Cell Levels
              </p>
              <div className="flex justify-center items-center gap-2">
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-sm font-mono">{currentSoc}%</span>
                <ChevronRight className="w-3 h-3 text-slate-500" />
                <span className="text-xs bg-emerald-900/40 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-sm font-mono font-bold">
                  {resolvedTargetSoC.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* INPUT INFRASTRUCTURE & RATES CARD */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl" id="station_settings">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Charging Network Grid
              </label>
              <select
                value={network}
                onChange={(e) => handleNetworkChange(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl block w-full p-3 font-semibold outline-hidden focus:border-emerald-500 cursor-pointer"
              >
                {Object.keys(networks).map(netKey => (
                  <option key={netKey} value={netKey}>
                    🏁 {networks[netKey].name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Active Station Power Outlet
              </label>
              <select
                value={chargerSpeed}
                onChange={(e) => {
                  const kw = parseFloat(e.target.value);
                  setChargerSpeed(kw);
                  // Find type matching selecting speed
                  const matched = validSpeeds.find(item => item.powerKw === kw);
                  if (matched) setChargerType(matched.type);
                }}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl block w-full p-3 font-semibold outline-hidden focus:border-emerald-500 cursor-pointer text-ellipsis overflow-hidden"
              >
                {validSpeeds.map(speedItem => (
                  <option key={speedItem.id} value={speedItem.powerKw}>
                    ⚡ ({speedItem.type}) {speedItem.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Unit Utility Cost (₱/kWh)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500 text-sm font-bold">
                  ₱
                </span>
                <input
                  type="number"
                  step="0.1"
                  value={rate}
                  onChange={(e) => handleRateUpdate(parseFloat(e.target.value) || 0)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl block w-full pl-8 p-3 outline-hidden focus:border-emerald-500 font-bold"
                />
              </div>

              {/* Utility shortcuts */}
              <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                <button
                  onClick={() => handleRateUpdate(13.0)}
                  className="text-[9px] bg-slate-950 border border-slate-800 text-slate-400 rounded py-1 px-0.5 hover:text-emerald-400 font-bold transition duration-150 cursor-pointer"
                >
                  Home (13.0)
                </button>
                <button
                  onClick={() => handleRateUpdate(28.5)}
                  className="text-[9px] bg-slate-950 border border-slate-800 text-slate-400 rounded py-1 px-0.5 hover:text-emerald-400 font-bold transition duration-150 cursor-pointer"
                >
                  EVro AC (28.5)
                </button>
                <button
                  onClick={() => handleRateUpdate(35.0)}
                  className="text-[9px] bg-slate-950 border border-slate-800 text-slate-400 rounded py-1 px-0.5 hover:text-emerald-400 font-bold transition duration-150 cursor-pointer"
                >
                  EVro DC (35.0)
                </button>
                <button
                  onClick={() => handleRateUpdate(40.0)}
                  className="text-[9px] bg-slate-950 border border-slate-800 text-slate-400 rounded py-1 px-0.5 hover:text-emerald-400 font-bold transition duration-150 cursor-pointer"
                >
                  Shell (40.0)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Converter Efficiency Multiplier
              </label>
              <select
                value={efficiency}
                onChange={(e) => handleEfficiencyChange(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl block w-full p-3 font-semibold outline-hidden focus:border-emerald-500 cursor-pointer"
              >
                <option value="1.0">0% Direct conversion loss</option>
                <option value="1.05">5% Efficiency Loss</option>
                <option value="1.10">10% Default standard AC</option>
                <option value="1.15">15% High heat/cable loss</option>
              </select>
            </div>
          </div>
        </div>

        {/* TIME INPUT CARD */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Session Init Plug-In Time
            </label>
            <button
              onClick={handleResetTimeToNow}
              className="text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1 hover:bg-emerald-500/20 transition cursor-pointer"
            >
              Reset to Now ⏰
            </button>
          </div>
          <input
            type="time"
            value={plugTime}
            onChange={(e) => setPlugTime(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 font-black text-sm rounded-xl block w-full p-3 outline-hidden focus:border-emerald-500"
          />
        </div>

        {/* MATHEMATICAL COMPUTATIONS DISPLAY */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl" id="computed_displays">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                Net Energy Transferred
              </p>
              <p className="text-lg md:text-xl font-bold tracking-tight text-white font-mono">
                {isInputBroken ? "0.00" : calculationResult.netEnergy.toFixed(2)}{" "}
                <span className="text-xs font-normal text-slate-500">kWh</span>
              </p>
            </div>

            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                {mode === "soc" ? "Calculated Cost Session" : "Resulting State of Charge"}
              </p>
              <p className="text-lg md:text-xl font-extrabold tracking-tight text-emerald-400 font-mono">
                {isInputBroken ? "₱0.00" : calculationResult.costOrSocText}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/50 text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                Estimated Duration
              </p>
              <p className="text-lg md:text-xl font-bold tracking-tight text-white font-mono">
                {isInputBroken
                  ? "--"
                  : isTimerRunning
                  ? formatCountdown(secondsRemaining)
                  : `${Math.floor(totalMinutesLeft / 60)}h ${totalMinutesLeft % 60}m`}
              </p>
            </div>

            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/50 text-center">
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
                ⏰ Ready Completion Time
              </p>
              <p className="text-lg md:text-xl font-black tracking-tight text-emerald-400 font-mono">
                {isInputBroken ? "--" : getProjectedTargetTime()}
              </p>
            </div>
          </div>

          {/* DYNAMIC SHREDDED FAST-CHARGE WARNINGS & CHART DETECTOR */}
          {chargerType === "DC" && resolvedTargetSoC > 80 && !isInputBroken && (
            <div className="rounded-xl p-3 bg-blue-500/5 border border-blue-500/10 text-xs text-blue-300/90 leading-relaxed flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <span className="font-bold text-blue-200">DC Thermal Throttling Multiplier:</span> Estimates dynamically adjusted to account for non-linear power reduction (speed throttles to 50% above 80% SoC, and 15% above 90% SoC).
              </div>
            </div>
          )}

          {/* TIMER AND LOG ACTIONS CONTROL CENTER */}
          <div className="pt-2 space-y-3">
            <div className="flex gap-2.5">
              <button
                disabled={isInputBroken || totalMinutesLeft <= 0}
                onClick={handleToggleTimer}
                style={{ contentVisibility: "auto" }}
                className={`flex-1 font-black text-sm p-3.5 rounded-xl transition duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                  isInputBroken || totalMinutesLeft <= 0
                    ? "bg-slate-800 text-slate-500 opacity-50 cursor-not-allowed"
                    : isAlarmSounding
                    ? "bg-amber-500 text-slate-950 animate-pulse"
                    : isTimerRunning
                    ? "bg-rose-600 text-white hover:bg-rose-500"
                    : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                }`}
              >
                {isAlarmSounding ? (
                  <>
                    <VolumeX className="w-5 h-5 animate-bounce" />
                    Silence Charging Alarm
                  </>
                ) : isTimerRunning ? (
                  <>
                    <Square className="w-4.5 h-4.5 fill-white" />
                    Cancel Active Countdown
                  </>
                ) : (
                  <>
                    <Play className="w-4.5 h-4.5 fill-slate-950" />
                    ⏱️ Start Session Alarm Clock
                  </>
                )}
              </button>

              <button
                disabled={isInputBroken || totalMinutesLeft <= 0 || isTimerRunning}
                onClick={handleLogActiveSession}
                className={`p-3.5 px-4 rounded-xl border bg-slate-950 hover:bg-slate-900 border-slate-800 transition duration-150 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
                title="Log this calculated session to local records"
              >
                <History className="w-4 h-4 text-slate-400" />
                Log Session
              </button>
            </div>
          </div>
        </div>

        {/* INTERACTIVE COMPREHENSIVE HISTORICAL SESSION LOGS */}
        {historyList.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-400" />
                Historic Charging Session Logs
              </h3>
              <button
                onClick={handleClearHistory}
                className="text-[10px] text-rose-400 flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All Logs
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {historyList.map(item => (
                <div
                  key={item.id}
                  className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 flex justify-between items-center gap-2 text-xs hover:border-slate-700/60 transition group"
                >
                  <div className="space-y-1">
                    <p className="font-bold text-slate-200">
                      🚗 {item.vehicleBrandDisplay} {item.vehicleModelDisplay}
                    </p>
                    <div className="flex flex-wrap gap-x-2 text-[10px] text-slate-500">
                      <span>⚡ {item.gridNetwork}</span>
                      <span>•</span>
                      <span>🟢 Level: {item.startSoc}% → {item.resultSoc}</span>
                      <span>•</span>
                      <span>⏳ Duration: {item.durationMinutes}m</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-extrabold text-emerald-400 font-mono">
                        {item.costPhp}
                      </p>
                      <p className="text-[10px] text-slate-500 font-semibold font-mono">
                        {item.energyKwh.toFixed(2)} kWh
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveHistoryItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 p-1 rounded-md transition cursor-pointer"
                      title="Wipe specific session record"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REGISTRY MAINTENANCE TOGGLE ACTUATOR */}
        <div className="text-center pt-2">
          <button
            onClick={() => setShowMaintenance(true)}
            className="text-xs text-slate-500 underline decoration-slate-600 decoration-dotted underline-offset-3 hover:text-emerald-400 transition cursor-pointer flex items-center gap-1.5 mx-auto font-medium"
          >
            <Settings className="w-3.5 h-3.5" />
            Open Database Registry Maintenance Facility
          </button>
        </div>
      </div>

      {/* REGISTRY MAINTENANCE DIALOG MODAL */}
      <AnimatePresence>
        {showMaintenance && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl relative"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h2 className="text-base font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Settings className="w-4.5 h-4.5" />
                  Registry Maintenance
                </h2>
                <button
                  onClick={() => setShowMaintenance(false)}
                  className="text-slate-400 hover:text-slate-200 transition p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form A: Register Custom Vehicle */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                  🛒 Register Custom Vehicle Model
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={formVehBrand}
                    onChange={(e) => setFormVehBrand(e.target.value)}
                    placeholder="Brand (e.g. BYD)"
                    className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs outline-hidden text-slate-200 focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    value={formVehName}
                    onChange={(e) => setFormVehName(e.target.value)}
                    placeholder="Model (e.g. Seal)"
                    className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs outline-hidden text-slate-200 focus:border-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={formVehCap}
                    onChange={(e) => setFormVehCap(e.target.value)}
                    placeholder="Capacity (kWh)"
                    className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs outline-hidden text-slate-200 focus:border-emerald-500"
                  />
                  <select
                    value={formVehType}
                    onChange={(e) => setFormVehType(e.target.value as any)}
                    className="bg-slate-950 border border-slate-800 text-slate-400 text-xs rounded-xl p-2.5 outline-hidden focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="AC_DC">AC & DC Charge</option>
                    <option value="DC">Strict DC Only</option>
                  </select>
                </div>
                <button
                  onClick={handleSaveCustomVehicle}
                  className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold p-2.5 rounded-xl hover:bg-emerald-500/20 transition cursor-pointer"
                >
                  Save New Vehicle Profile
                </button>
              </div>

              <hr className="border-slate-800/80" />

              {/* Form B: Add Custom Company Grid */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                  🏢 Register Independent Grid Carrier
                </h3>
                <input
                  type="text"
                  value={formNetName}
                  onChange={(e) => setFormNetName(e.target.value)}
                  placeholder="Utility Network Company Name"
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 w-full text-xs outline-hidden text-slate-200 focus:border-emerald-500"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={formNetRateAc}
                    onChange={(e) => setFormNetRateAc(e.target.value)}
                    step="0.1"
                    placeholder="AC Price (₱/kWh)"
                    className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs outline-hidden text-slate-200 focus:border-emerald-500"
                  />
                  <input
                    type="number"
                    value={formNetRateDc}
                    onChange={(e) => setFormNetRateDc(e.target.value)}
                    step="0.1"
                    placeholder="DC Price (₱/kWh)"
                    className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs outline-hidden text-slate-200 focus:border-emerald-500"
                  />
                </div>
                <button
                  onClick={handleSaveCustomNetwork}
                  className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold p-2.5 rounded-xl hover:bg-emerald-500/20 transition cursor-pointer"
                >
                  Create Custom Network Company
                </button>
              </div>

              <hr className="border-slate-800/80" />

              {/* Form C: Add Charging speed outlet station to companies */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                  ⛽ Add Terminal Outlets to Company Profile
                </h3>
                <select
                  value={formTerminalCompany}
                  onChange={(e) => setFormTerminalCompany(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl p-2.5 w-full outline-hidden focus:border-emerald-500 cursor-pointer"
                >
                  {Object.keys(networks).map(netKey => (
                    <option key={netKey} value={netKey}>
                      {networks[netKey].name}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={formTerminalLabel}
                    onChange={(e) => setFormTerminalLabel(e.target.value)}
                    placeholder="Terminal Name (e.g. CCS2 High)"
                    className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs outline-hidden text-slate-200 focus:border-emerald-500"
                  />
                  <input
                    type="number"
                    value={formTerminalKw}
                    onChange={(e) => setFormTerminalKw(e.target.value)}
                    step="0.1"
                    placeholder="Output Power (kW)"
                    className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs outline-hidden text-slate-200 focus:border-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={formTerminalType}
                    onChange={(e) => setFormTerminalType(e.target.value as any)}
                    className="bg-slate-950 border border-slate-800 text-slate-400 text-xs rounded-xl p-2.5 w-full outline-hidden focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="AC">AC Current</option>
                    <option value="DC">DC Current</option>
                  </select>
                  <button
                    onClick={handleSaveTerminalOutlet}
                    className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold p-2.5 rounded-xl hover:bg-emerald-500/20 transition cursor-pointer"
                  >
                    Save Speed Outlet
                  </button>
                </div>
              </div>

              {/* reset override overrides options */}
              <div className="pt-3 border-t border-slate-800 flex justify-between items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetRegistryData}
                  className="text-[10px] text-rose-400 bg-rose-500/5 px-2.5 py-1.5 rounded-md border border-rose-500/15 hover:bg-rose-500/10 transition cursor-pointer"
                >
                  ⚠️ Reset registries overrides
                </button>
                <button
                  onClick={() => setShowMaintenance(false)}
                  className="text-[10px] bg-slate-950 border border-slate-800 text-slate-400 rounded-md px-3 py-1.5 hover:text-white transition cursor-pointer font-bold"
                >
                  Close Modal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
