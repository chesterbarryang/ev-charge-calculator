# EV Smart Charging Dashboard & Platform Engine

A performance-calibrated, client-side progressive application engine engineered to optimize and project multi-vehicle electric vehicle (EV) charging metrics. The dashboard supports standard state-of-charge tracking (Forward Engine) and precise cash allocation budgeting (Reverse Engine) for both local residential and decoupled commercial infrastructure grids in the Philippines.

---

## 🎯 System Objectives

### Core Mission
To deliver accurate, deterministic, offline-capable time and cost estimations for EV charging sessions while maintaining a zero-dependency, lightning-fast execution footprint tailored for mobile deployment environments.

### Long-Term Architectural Vision
1. **Dynamic Scaling:** Empower end-users to register any primary global EV brand and model via UI-driven runtime maintenance without mutating source configuration packages.
2. **Grid/Network Decentralization:** Fully decouple billing operators (e.g., EVro, Shell Recharge, Soluri) into standalone entities supporting independent billing tiers, connection overheads, and hardware variants.
3. **Hardware & Physics Calibrations:** Enforce strict chemical and physical boundaries natively (e.g., distinguishing direct-to-cell DC efficiency mechanics from thermal-heavy AC transformation paths).

---

## 🛠️ Validation & Architectural Guardrails

When updating logic or adding features, any developer (human or LLM) must rigorously preserve these four foundational mechanisms:

### 1. Zero-HTML Layout Destruction (Event Listener Persistence)
* **Rule:** Do not re-render reactive UI text inputs or range selectors using dynamic string parsing models like `container.innerHTML = '...'`.
* **Reasoning:** Wiping out DOM blocks breaks instantiated JS execution paths and strips active hardware macro bindings. Use persistent structural DOM hooks and adjust values or visibility vectors cleanly via `.value`, `.textContent`, or Class manipulation loops (`.classList.toggle`).

### 2. Mobile Battery Sleeper Bypass (Android Background Thread Lock)
* **Rule:** Maintain the hidden, loop-enabled HTML5 base64 audio block (`#silent-bg-player`) and ensure its activation sequence runs sequentially inside user-triggered touch boundaries.
* **Reasoning:** Chromium and Safari threads on mobile platforms sleep aggressively when the screen locks. Running a silent audio canvas creates a high-priority media subsystem anchor, enabling our native `setInterval` timers to continue running while the device is in a pocket.

### 3. Unified Hybrid-Persistence Strategy
* **Rule:** Keep configuration registries split into a static, read-only baseline dictionary object combined with an override merge processor tracking local browser memory (`localStorage`).
* **Reasoning:** Client-side environments running on standard hosting frameworks (like GitHub Pages) lack server-side write permissions. Merging localized overrides with the baseline arrays achieves dynamic extensibility without requiring database components.

### 4. Cohesive Memory Profile Synchronization
* **Rule:** Every parameter manipulation (Network, Cost, Loss Overhead) must instantly persist under the specific vehicle profile identifier key matching the schema pattern `brandBrand_modelKey`. 
* **Reasoning:** Switching profiles must execute as a seamless transaction, saving the previous configuration states while restoring the active metrics of the newly targeted vehicle cleanly onto the UI.

---

## 📁 System Blueprint & Directory Layout

\`\`\`text
/ev-charge-dashboard (Root)
│
├── index.html               # Presentation View Frame (Tailwind v4 UI Layout)
├── manifest.json            # PWA Offline/Deployment Asset Specifications
│
└── src/                     # Core Processing Application Layer
    ├── app.js               # Application Orchestrator, DOM Bindings & Events Handler
    ├── state.js             # Session State & Vehicle Profiles Synchronization Manager
    │
    ├── config/              # Static & Dynamically Extended Core Datasets
    │   ├── vehicles.js      # Global Vehicle Definitions & Profile Merging Interceptors
    │   └── networks.js      # Commercial Grid Matrix & Type-Based Rates Registries
    │
    └── utils/               # Pure Computational & Interface Hardware Engines
        ├── calculator.js    # Math Processor (Forward SoC & Reverse Budget Loops)
        └── audioAlarm.js    # Synthesizer Oscillator & Media Thread Anchor Channels
\`\`\`

---

## 🗂️ Data Engineering & Schema Model Standards

### 1. Vehicle Specifications Schema
Vehicles are registered as nested model objects containing capacity metrics, battery attributes, and physical structural traits.

\`\`\`javascript
// Located in: src/config/vehicles.js
export const VEHICLE_DATABASE = {
    "vinfast": {
        brand: "VinFast",
        models: {
            "vf3": {
                name: "VF 3",
                capacityKwh: 18.64,
                chemistry: "LFP",
                supportedCharging: ["DC"], // Enforces physical hardware route checks
                defaultLoss: "1.05"        // Compensates for external home-DC box conversions
            }
        }
    }
};
\`\`\`
* **DC-Only Mapping Edge Case:** Vehicles like the VinFast VF 3 completely lack an internal AC On-Board Charger (OBC). When calculating session paths or generating network lists, the system must omit all standard AC charging options and use a default conversion loss parameter of **~5% (1.05)** instead of standard AC overhead profiles (1.10–1.15).

### 2. Infrastructure & Network Grid Schema
Networks record billing rates partitioned by charging current technology classifications alongside terminal velocity benchmarks.

\`\`\`javascript
// Located in: src/config/networks.js
export const NETWORK_DATABASE = {
    "evro": {
        name: "EVro Network",
        isCommercial: true,
        typeRates: { 
            AC: 28.50, // Standard Destination Charging Cost
            DC: 35.00  // Commercial DC Fast Charging Cost
        },
        speeds: [
            { id: "evro_ac_calibrated", powerKw: 6.81, type: "AC", label: "6.8 kW Real-World AC" },
            { id: "evro_dc_fast", powerKw: 50.0, type: "DC", label: "50 kW Public DC Fast Charger" }
        ]
    }
};
\`\`\`

---

## 🧮 Mathematical Engine Logic (`src/utils/calculator.js`)

The calculation engine handles two core modes of execution:

### Option 1: Forward Engine (Target State of Charge)
Calculates total costs and estimated times required to reach a specific destination charge percentage.

* $\Delta \text{SoC} = \frac{\text{Target SoC} - \text{Current SoC}}{100}$
* $\text{Net Energy Needed (kWh)} = \Delta \text{SoC} \times \text{Battery Capacity}$
* $\text{Total Cost} = (\text{Net Energy} \times \text{Loss Factor}) \times \text{Rate}$
* $\text{Charging Time (Hours)} = \frac{\text{Net Energy} \times \text{Loss Factor}}{\text{Charger Speed}}$

### Option 2: Reverse Engine (Budget Amount Allocation)
Calculates the exact final state of charge achievable based on a fixed maximum currency value. It features a strict clamping threshold loop at **100% SoC Max**, calculating any remaining financial change if a user over-allocates budget bounds for their battery pack size.

* $\text{Gross Energy Allowed} = \frac{\text{Target Budget}}{\text{Rate}}$
* $\text{Net Energy to Battery} = \frac{\text{Gross Energy Allowed}}{\text{Loss Factor}}$
* $\text{Added SoC (\%)} = \frac{\text{Net Energy to Battery}}{\text{Battery Capacity}} \times 100$
* $\text{Projected Final SoC} = \text{Current SoC} + \text{Added SoC}$

---

## 🔧 Enhancement and Maintenance Protocol

When requested to introduce a new enhancement, verify the implementation path against this checklist:
1. Is the modification database-driven via `src/config/` entries rather than altering hardcoded interface properties?
2. Does the mathematical model inside `calculator.js` run as a pure function isolated from external DOM elements or state assumptions?
3. Does your new input field or toggle configuration map correctly onto the `AppState.saveProfile` framework to prevent settings from crossing over between different vehicles?
