import { AppState } from './state.js';
import { getMergedVehicles } from './config/vehicles.js';
import { getMergedNetworks } from './config/networks.js';
import { executeChargingMath } from './utils/calculator.js';
import * as alarmEngine from './utils/audioAlarm.js';

const brandSelect = document.getElementById('vehicle-brand');
const currentSocInput = document.getElementById('current-soc');
const sliderCurrent = document.getElementById('slider-current');
const targetValueInput = document.getElementById('target-value');
const sliderTarget = document.getElementById('slider-target');
const targetInputLabel = document.getElementById('target-input-label');
const networkSelect = document.getElementById('charger-network');
const chargerSpeedSelect = document.getElementById('charger-type');
const rateInput = document.getElementById('rate');
const efficiencySelect = document.getElementById('efficiency');
const plugTimeInput = document.getElementById('plug-time');
const errorMsg = document.getElementById('error-msg');
const lfpBanner = document.getElementById('lfp-guidance-banner');
const btnTimerToggle = document.getElementById('btn-timer-toggle');
const silentPlayer = document.getElementById('silent-bg-player');

const resultEnergy = document.getElementById('result-energy');
const labelCostOrSoc = document.getElementById('label-cost-or-soc');
const resultCostOrSoc = document.getElementById('result-cost-or-soc');
const resultTime = document.getElementById('result-time');
const resultClock = document.getElementById('result-clock');

let timerCountdownInterval = null;
let audioCtx = null;

window.addEventListener('DOMContentLoaded', () => {
    initTime();
    setupStaticEventListeners();
    syncUIPresets();
    renderVehicleDropdown();
    renderNetworkSpeeds();
    calculateSession();
});

function initTime() {
    const now = new Date();
    plugTimeInput.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

function setupStaticEventListeners() {
    // 1. VEHICLE SWITCHER LOGIC
    brandSelect.addEventListener('change', () => {
        // Step A: Save the current screen parameters to the OUTGOING vehicle profile before switching
        AppState.saveProfile({
            network: networkSelect.value,
            rate: parseFloat(rateInput.value),
            efficiency: efficiencySelect.value
        });

        // Step B: Update active vehicle pointers
        const vehiclesDb = getMergedVehicles();
        AppState.vehicleBrand = brandSelect.value;
        AppState.vehicleModel = Object.keys(vehiclesDb[brandSelect.value].models)[0];
        
        // Step C: Fetch the saved configurations for the NEWLY selected vehicle
        const restoredSettings = AppState.getActiveSettings();
        
        // Step D: Update internal state tracking
        AppState.network = restoredSettings.network;
        AppState.rate = restoredSettings.rate;
        AppState.efficiency = restoredSettings.efficiency;

        // Step E: Force the UI to physically reflect the restored parameters
        networkSelect.value = AppState.network;
        rateInput.value = AppState.rate;
        efficiencySelect.value = AppState.efficiency;

        // Step F: Rebuild dependent dropdowns (like available speeds) and recalculate
        renderNetworkSpeeds();
        calculateSession();
    });

    // 2. NETWORK SWITCHER LOGIC
    networkSelect.addEventListener('change', () => {
        const networksDb = getMergedNetworks();
        AppState.network = networkSelect.value;
        
        // Safely pull the default rate for the newly chosen network
        const safeNetwork = networksDb[AppState.network] || networksDb['home'];
        AppState.rate = safeNetwork.defaultRate || 13.00;
        rateInput.value = AppState.rate; // Sync UI
        
        // Save these choices immediately to the active vehicle's profile
        AppState.saveProfile({ 
            network: AppState.network, 
            rate: AppState.rate, 
            efficiency: efficiencySelect.value 
        });
        
        renderNetworkSpeeds();
        calculateSession();
    });

    // 3. SLIDER AND INPUT LOGIC
    currentSocInput.addEventListener('input', (e) => {
        if (AppState.isTimerRunning) return;
        sliderCurrent.value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
        calculateSession();
    });

    sliderCurrent.addEventListener('input', (e) => {
        if (AppState.isTimerRunning) return;
        currentSocInput.value = e.target.value;
        calculateSession();
    });

    // 4. RATE AND EFFICIENCY PROFILE UPDATERS
    rateInput.addEventListener('input', () => { 
        AppState.rate = parseFloat(rateInput.value) || 0; 
        AppState.saveProfile({ 
            network: networkSelect.value, 
            rate: AppState.rate, 
            efficiency: efficiencySelect.value 
        });
        calculateSession(); 
    });

    efficiencySelect.addEventListener('change', () => { 
        AppState.efficiency = efficiencySelect.value; 
        AppState.saveProfile({ 
            network: networkSelect.value, 
            rate: parseFloat(rateInput.value), 
            efficiency: AppState.efficiency 
        });
        calculateSession(); 
    });

    // 5. STANDARD RECALCULATION TRIGGERS
    chargerSpeedSelect.addEventListener('change', () => calculateSession());
    plugTimeInput.addEventListener('input', () => calculateSession());
}

function renderVehicleDropdown() {
    brandSelect.innerHTML = '';
    const vehiclesDb = getMergedVehicles();
    Object.keys(vehiclesDb).forEach(brandKey => {
        Object.keys(vehiclesDb[brandKey].models).forEach(modelKey => {
            const opt = document.createElement('option');
            opt.value = brandKey;
            opt.textContent = `${vehiclesDb[brandKey].brand} ${vehiclesDb[brandKey].models[modelKey].name}`;
            if(brandKey === AppState.vehicleBrand && modelKey === AppState.vehicleModel) opt.selected = true;
            brandSelect.appendChild(opt);
        });
    });
}

window.setMode = function(mode) {
    if (AppState.isTimerRunning) return;
    AppState.mode = mode;
    
    // UI Visual Toggles
    document.getElementById('btn-soc').className = mode === 'soc' ? "flex-1 py-2 text-sm rounded-lg bg-emerald-500 text-slate-950 font-semibold transition" : "flex-1 py-2 text-sm rounded-lg text-slate-400 transition";
    document.getElementById('btn-budget').className = mode === 'budget' ? "flex-1 py-2 text-sm rounded-lg bg-emerald-500 text-slate-950 font-semibold transition" : "flex-1 py-2 text-sm rounded-lg text-slate-400 transition";
    
    const activeTargetInput = document.getElementById('target-value');
    const activeSliderTarget = document.getElementById('slider-target');

    if(mode === 'soc') {
        targetInputLabel.textContent = "Target SoC (%)";
        activeTargetInput.value = AppState.targetSoc;
        activeSliderTarget.min = 0;
        activeSliderTarget.max = 100;
        activeSliderTarget.value = AppState.targetSoc;
        activeSliderTarget.classList.remove('hidden'); // Show slider for SoC
    } else {
        targetInputLabel.textContent = "Target Budget (₱)";
        activeTargetInput.value = AppState.targetBudget;
        activeSliderTarget.classList.add('hidden'); // HIDE slider for Budget (Original Design)
    }
    calculateSession();
};

function bindDynamicInputListeners() {
    const cleanEvent = targetValueInput.cloneNode(true);
    targetValueInput.parentNode.replaceChild(cleanEvent, targetValueInput);
    const activeTargetInput = document.getElementById('target-value');
    
    activeTargetInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        if (AppState.mode === 'soc') {
            AppState.targetSoc = Math.min(100, val);
            sliderTarget.value = AppState.targetSoc;
        } else {
            AppState.targetBudget = val;
        }
        calculateSession();
    });

    const cleanSlider = sliderTarget.cloneNode(true);
    sliderTarget.parentNode.replaceChild(cleanSlider, sliderTarget);
    const activeSliderTarget = document.getElementById('slider-target');

    activeSliderTarget.addEventListener('input', (e) => {
        AppState.targetSoc = parseInt(e.target.value);
        activeTargetInput.value = AppState.targetSoc;
        calculateSession();
    });
}

function syncUIPresets() {
    rateInput.value = AppState.rate;
    efficiencySelect.value = AppState.efficiency;
    setMode(AppState.mode);
}

function renderNetworkSpeeds() {
    chargerSpeedSelect.innerHTML = '';
    const vehiclesDb = getMergedVehicles();
    const networksDb = getMergedNetworks();

    const activeVehicle = vehiclesDb[AppState.vehicleBrand].models[AppState.vehicleModel];
    const networkData = networksDb[AppState.network];

    const validSpeeds = networkData.speeds.filter(speed => activeVehicle.supportedCharging.includes(speed.type));

    validSpeeds.forEach((speed, idx) => {
        const opt = document.createElement('option');
        opt.value = speed.powerKw;
        opt.dataset.type = speed.type;
        opt.textContent = speed.label;
        if (idx === 0) opt.selected = true;
        chargerSpeedSelect.appendChild(opt);
    });
    bindDynamicInputListeners();
}

function calculateSession() {
    if (AppState.isTimerRunning) return;

    // 1. Data Retrieval
    const currentSoc = parseFloat(currentSocInput.value) || 0;
    const selectedOption = chargerSpeedSelect.options[chargerSpeedSelect.selectedIndex];
    const chargerSpeed = parseFloat(chargerSpeedSelect.value) || 3.5;
    const chargerType = selectedOption ? selectedOption.dataset.type : "AC";
    
    // 2. Defensive Lookup: Get Merged DB and Validate
    const vehiclesDb = getMergedVehicles();
    const networksDb = getMergedNetworks();
    
    // Safety check for active vehicle
    const activeVehicle = vehiclesDb[AppState.vehicleBrand]?.models[AppState.vehicleModel] 
                          || { capacityKwh: 26.7, name: "Unknown" };

    // Safety check for network
    const networkData = networksDb[AppState.network];
    const safeNetwork = networkData || networksDb['home']; // Fallback to 'home' if network undefined

    // 3. Robust Rate Calculation
    // Safely verify typeRates exists before accessing it
    let activeRate = 13.00;
    if (safeNetwork.typeRates) {
        activeRate = safeNetwork.typeRates[chargerType] || safeNetwork.typeRates.AC || safeNetwork.defaultRate || 13.00;
    } else if (safeNetwork.defaultRate) {
        activeRate = safeNetwork.defaultRate;
    }

    const rate = activeRate;
    rateInput.value = rate; // Visual sync
    const lossMultiplier = parseFloat(efficiencySelect.value) || 1.10;
    const targetVal = parseFloat(targetValueInput.value) || 0;

    // 4. UI Reset State
    errorMsg.classList.add('hidden');
    btnTimerToggle.disabled = false;
    btnTimerToggle.className = "w-full bg-emerald-500 text-slate-950 font-bold text-sm p-3.5 rounded-xl cursor-pointer hover:bg-emerald-400 transition";

    // 5. Logic Execution via Utility Engine
    if (AppState.mode === 'soc' && targetVal <= currentSoc) {
        errorMsg.classList.remove('hidden');
        resetOutputs();
        return;
    }

    const { netEnergy, costOrSocText, estimatedHours, cappedCost } = executeChargingMath({
        mode: AppState.mode,
        currentSoc,
        targetValue: targetVal,
        capacityKwh: activeVehicle.capacityKwh,
        chargerSpeed,
        rate,
        lossMultiplier,
        isDcConnection: (chargerType === "DC")
    });

    // 6. Output Rendering
    labelCostOrSoc.textContent = AppState.mode === 'soc' ? "Total Session Cost" : "Calculated Target SoC";
    if (cappedCost !== null) {
        labelCostOrSoc.innerHTML = `Target SoC <span class="text-xs text-rose-400 block font-normal">(Capped at 100%, Cost: ₱${cappedCost.toFixed(2)})</span>`;
    }

    resultEnergy.innerHTML = `${netEnergy.toFixed(2)} <span class="text-xs font-normal text-slate-400">kWh</span>`;
    resultCostOrSoc.textContent = costOrSocText;

    // 7. Time/Clock Projection
    const totalMinutes = Math.round(estimatedHours * 60);
    AppState.targetTotalSecondsLeft = totalMinutes * 60;
    
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    resultTime.textContent = `${h > 0 ? h + 'h ' : ''}${m}m`;

    const [startH, startM] = plugTimeInput.value.split(':').map(Number);
    const targetDate = new Date();
    targetDate.setHours(startH, startM + totalMinutes);
    
    let clockH = targetDate.getHours();
    const clockM = targetDate.getMinutes().toString().padStart(2, '0');
    const ampm = clockH >= 12 ? 'PM' : 'AM';
    resultClock.textContent = `${clockH % 12 || 12}:${clockM} ${ampm}`;

    // 8. LFP Banner Logic
    const finalSoCForBanner = AppState.mode === 'soc' ? targetVal : parseFloat(costOrSocText);
    if (finalSoCForBanner >= 100) {
        lfpBanner.className = "text-xs rounded-xl p-3 border font-medium bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
        lfpBanner.textContent = `✓ ${activeVehicle.name} Compliant: Full saturation keeps the BMS accurate.`;
    } else {
        lfpBanner.className = "text-xs rounded-xl p-3 border font-medium bg-amber-500/10 border-amber-500/20 text-amber-400";
        lfpBanner.textContent = `ℹ LFP Tip: Topping off to ${finalSoCForBanner.toFixed(0)}%. Charge to 100% weekly to prevent cell variance.`;
    }
}
window.toggleActiveTimer = function() {
    if (AppState.isTimerRunning) {
        clearInterval(timerCountdownInterval);
        alarmEngine.clearSynthAlarm();
        silentPlayer.pause();
        AppState.isTimerRunning = false;
        calculateSession();
    } else {
        if (AppState.targetTotalSecondsLeft <= 0) return;
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        alarmEngine.playSilentStream(silentPlayer);
        AppState.isTimerRunning = true;
        btnTimerToggle.textContent = "🛑 Cancel Session Alarm";
        btnTimerToggle.className = "w-full bg-rose-600 text-slate-100 font-bold text-sm p-3.5 rounded-xl cursor-pointer hover:bg-rose-500 transition";

        timerCountdownInterval = setInterval(() => {
            AppState.targetTotalSecondsLeft--;
            if (AppState.targetTotalSecondsLeft <= 0) {
                clearInterval(timerCountdownInterval);
                alarmEngine.startSynthAlarm(audioCtx, btnTimerToggle, resultTime);
            } else {
                const h = Math.floor(AppState.targetTotalSecondsLeft / 3600);
                const m = Math.floor((AppState.targetTotalSecondsLeft % 3600) / 60);
                const s = AppState.targetTotalSecondsLeft % 60;
                resultTime.textContent = `${h > 0 ? h + 'h ' : ''}${m}m ${s}s left`;
            }
        }, 1000);
    }
};

window.setQuickRate = function(value) {
    rateInput.value = value;
    AppState.rate = value;
    AppState.save();
    calculateSession();
};

window.toggleMaintenanceModal = function(show) {
    document.getElementById('maintenance-modal').classList.toggle('hidden', !show);
};

window.commitCustomVehicle = function() {
    const brandRaw = document.getElementById('m-veh-brand').value.trim();
    const name = document.getElementById('m-veh-name').value.trim();
    const cap = parseFloat(document.getElementById('m-veh-cap').value);
    const modeType = document.getElementById('m-veh-type').value;

    if (!brandRaw || !name || isNaN(cap)) { alert("Please complete all inputs properly."); return; }

    const brandKey = brandRaw.toLowerCase().replace(/\s+/g, '');
    const modelKey = name.toLowerCase().replace(/\s+/g, '_');
    const supportedCharging = modeType === "AC_DC" ? ["AC", "DC"] : ["DC"];
    const defaultLoss = modeType === "AC_DC" ? "1.10" : "1.05";

    const customVehicles = JSON.parse(localStorage.getItem('ev_custom_vehicles') || '{}');
    if (!customVehicles[brandKey]) customVehicles[brandKey] = { brand: brandRaw, models: {} };
    
    customVehicles[brandKey].models[modelKey] = {
        name: name, capacityKwh: cap, chemistry: "LFP (User Custom)", supportedCharging, defaultLoss
    };

    localStorage.setItem('ev_custom_vehicles', JSON.stringify(customVehicles));
    alert(`Vehicle stored safely: ${brandRaw} ${name}`);
    location.reload();
};

window.commitCustomSpeedOutlet = function() {
    const networkKey = document.getElementById('m-net-target').value;
    const label = document.getElementById('m-speed-label').value.trim();
    const kw = parseFloat(document.getElementById('m-speed-kw').value);
    const currentType = document.getElementById('m-speed-type').value;

    if (!label || isNaN(kw)) { alert("Please compile all parameters carefully."); return; }

    const customNetworks = JSON.parse(localStorage.getItem('ev_custom_networks') || '{}');
    if (!customNetworks[networkKey]) customNetworks[networkKey] = { speeds: [] };
    
    const uniqueId = `custom_${label.toLowerCase().replace(/\s+/g, '_')}_${Date.now().toString().slice(-4)}`;
    customNetworks[networkKey].speeds.push({ id: uniqueId, powerKw: kw, type: currentType, label: `${label} (${kw}kW ${currentType})` });

    localStorage.setItem('ev_custom_networks', JSON.stringify(customNetworks));
    alert(`Outlet profile appended directly to ${networkKey === 'home' ? 'Home' : 'EVro'}`);
    location.reload();
};

window.clearCustomRegistries = function() {
    if (confirm("Reset and clear device storage overrides?")) {
        localStorage.removeItem('ev_custom_vehicles');
        localStorage.removeItem('ev_custom_networks');
        location.reload();
    }
};

function resetOutputs() {
    resultEnergy.innerHTML = `-- <span class="text-xs font-normal text-slate-400">kWh</span>`;
    resultCostOrSoc.textContent = `₱ --`;
    resultTime.textContent = `--`;
    resultClock.textContent = `--`;
    btnTimerToggle.className = "w-full bg-slate-800 text-slate-500 font-bold text-sm p-3.5 rounded-xl opacity-50 cursor-not-allowed";
    btnTimerToggle.disabled = true;
}

// Function to update the company dropdown picker inside the maintenance screen itself
function populateMaintenanceNetworkDropdown() {
    const targetSelect = document.getElementById('m-net-target');
    if (!targetSelect) return;
    
    targetSelect.innerHTML = '';
    const networksDb = getMergedNetworks();
    
    Object.keys(networksDb).forEach(netKey => {
        const opt = document.createElement('option');
        opt.value = netKey;
        opt.textContent = networksDb[netKey].name;
        targetSelect.appendChild(opt);
    });
}

// Intercept window toggle to ensure selection indices are built fresh
const originalToggleMaintenanceModal = window.toggleMaintenanceModal;
window.toggleMaintenanceModal = function(show) {
    if (show) {
        populateMaintenanceNetworkDropdown();
    }
    document.getElementById('maintenance-modal').classList.toggle('hidden', !show);
};

// Form Handler B: Registers a whole new independent network configuration space
window.commitCustomNetworkCompany = function() {
    const name = document.getElementById('m-net-name').value.trim();
    const rateAc = parseFloat(document.getElementById('m-net-rate-ac').value);
    const rateDc = parseFloat(document.getElementById('m-net-rate-dc').value);

    if (!name || isNaN(rateAc) || isNaN(rateDc)) { alert("Please provide company name and both AC/DC rates."); return; }

    const networkKey = name.toLowerCase().replace(/\s+/g, '_');
    const customNetworks = JSON.parse(localStorage.getItem('ev_custom_networks') || '{}');
    
    customNetworks[networkKey] = {
        name: name,
        isCommercial: true,
        typeRates: { AC: rateAc, DC: rateDc },
        speeds: []
    };

    localStorage.setItem('ev_custom_networks', JSON.stringify(customNetworks));
    alert(`Profile created for ${name} with split-rate billing.`);
    location.reload();
};

// Form Handler C: Appends custom speeds to ANY company profile matching the index registry
window.commitCustomSpeedOutlet = function() {
    const networkKey = document.getElementById('m-net-target').value;
    const label = document.getElementById('m-speed-label').value.trim();
    const kw = parseFloat(document.getElementById('m-speed-kw').value);
    const currentType = document.getElementById('m-speed-type').value;

    if (!label || isNaN(kw)) { alert("Please specify the terminal specifications completely."); return; }

    const customNetworks = JSON.parse(localStorage.getItem('ev_custom_networks') || '{}');
    const baseNetworks = getMergedNetworks();

    // If the targeted node doesn't have an active localStorage tracking mirror yet, port it from baseline database first
    if (!customNetworks[networkKey]) {
        customNetworks[networkKey] = JSON.parse(JSON.stringify(baseNetworks[networkKey]));
    }
    
    const uniqueId = `custom_${label.toLowerCase().replace(/\s+/g, '_')}_${Date.now().toString().slice(-4)}`;
    customNetworks[networkKey].speeds.push({
        id: uniqueId,
        powerKw: kw,
        type: currentType,
        label: `${label} (${kw}kW ${currentType})`
    });

    localStorage.setItem('ev_custom_networks', JSON.stringify(customNetworks));
    alert(`Terminal saved! Added ${kw} kW outlet option underneath ${baseNetworks[networkKey].name}.`);
    location.reload(); // Hard cycle to refresh cross-linked script dependencies safely
};

// Dashboard Network list builder: Replaces hardcoded options with live merged profiles
function renderNetworkDropdown() {
    const mainNetworkSelect = document.getElementById('charger-network');
    if (!mainNetworkSelect) return;

    const currentSelection = mainNetworkSelect.value || AppState.network;
    mainNetworkSelect.innerHTML = '';
    
    const networksDb = getMergedNetworks();
    Object.keys(networksDb).forEach(netKey => {
        const opt = document.createElement('option');
        opt.value = netKey;
        opt.textContent = networksDb[netKey].name;
        if (netKey === currentSelection) opt.selected = true;
        mainNetworkSelect.appendChild(opt);
    });
}

// Hook network builder into the initialization stream inside DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
    initTime();
    renderNetworkDropdown(); // Dynamically construct main panel view entries
    setupStaticEventListeners();
    syncUIPresets();
    renderVehicleDropdown();
    renderNetworkSpeeds();
    calculateSession();
});

function changeVehicleProfile() {
    // 1. Save current UI settings to the old profile before switching
    AppState.saveProfile({
        network: networkSelect.value,
        rate: parseFloat(rateInput.value),
        efficiency: efficiencySelect.value
    });

    // 2. Update brand/model
    AppState.vehicleBrand = brandSelect.value;
    // (Ensure you retrieve model logic here based on your dropdown mapping)
    
    // 3. Load the new profile settings
    const newSettings = AppState.getActiveSettings();
    networkSelect.value = newSettings.network;
    rateInput.value = newSettings.rate;
    efficiencySelect.value = newSettings.efficiency;

    // 4. Trigger UI refresh
    renderNetworkSpeeds();
    calculateSession();
}

// Ensure listeners trigger the save whenever a user changes a setting
[networkSelect, rateInput, efficiencySelect].forEach(el => {
    el.addEventListener('change', () => {
        AppState.saveProfile({
            network: networkSelect.value,
            rate: parseFloat(rateInput.value),
            efficiency: efficiencySelect.value
        });
    });
});
