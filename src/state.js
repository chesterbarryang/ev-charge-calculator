/**
 * Global Application State Management
 * Handles vehicle-specific preferences and persistence.
 */

export const AppState = {
    mode: 'soc',
    vehicleBrand: localStorage.getItem('ev_saved_brand') || 'jetour',
    vehicleModel: localStorage.getItem('ev_saved_model') || 't1_idm',
    network: localStorage.getItem('ev_saved_network') || 'evro',
    rate: parseFloat(localStorage.getItem('ev_saved_rate')) || 28.5,
    efficiency: localStorage.getItem('ev_saved_efficiency') || '1.10',
    targetSoc: 80,
    targetBudget: 500,
    targetTotalSecondsLeft: 0,
    isTimerRunning: false,

    // Store settings indexed by a unique vehicle key
    profiles: JSON.parse(localStorage.getItem('ev_profile_configs')) || {
        "jetour_t1_idm": { network: 'evro', rate: 28.5, efficiency: '1.10' },
        "vinfast_vf3": { network: 'home', rate: 13.0, efficiency: '1.05' }
    },

    // Generates the unique key used to look up vehicle-specific settings
    get activeKey() { 
        return `${this.vehicleBrand}_${this.vehicleModel}`; 
    },

    // Returns the saved settings for the active vehicle, or a safe fallback
    getActiveSettings() {
        return this.profiles[this.activeKey] || { 
            network: 'home', 
            rate: 13.0, 
            efficiency: '1.10' 
        };
    },

    // Persists preferences to localStorage
    saveProfile(settings) {
        this.profiles[this.activeKey] = settings;
        localStorage.setItem('ev_profile_configs', JSON.stringify(this.profiles));
        localStorage.setItem('ev_saved_brand', this.vehicleBrand);
        localStorage.setItem('ev_saved_model', this.vehicleModel);
        localStorage.setItem('ev_saved_network', settings.network);
        localStorage.setItem('ev_saved_rate', settings.rate);
        localStorage.setItem('ev_saved_efficiency', settings.efficiency);
    }
};
