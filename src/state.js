// src/state.js
export const AppState = {
    mode: 'soc',
    vehicleBrand: localStorage.getItem('ev_saved_brand') || 'jetour',
    vehicleModel: localStorage.getItem('ev_saved_model') || 't1_idm',
    
    // Store settings indexed by a unique vehicle key
    profiles: JSON.parse(localStorage.getItem('ev_profile_configs')) || {
        "jetour_t1_idm": { network: 'evro', rate: 28.5, efficiency: '1.10' },
        "vinfast_vf3": { network: 'home', rate: 13.0, efficiency: '1.05' }
    },

    get activeKey() { return `${this.vehicleBrand}_${this.vehicleModel}`; },

    getActiveSettings() {
        return this.profiles[this.activeKey] || { network: 'home', rate: 13.0, efficiency: '1.10' };
    },

    saveProfile(settings) {
        this.profiles[this.activeKey] = settings;
        localStorage.setItem('ev_profile_configs', JSON.stringify(this.profiles));
        localStorage.setItem('ev_saved_brand', this.vehicleBrand);
        localStorage.setItem('ev_saved_model', this.vehicleModel);
    }
};
