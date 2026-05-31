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

    save() {
        localStorage.setItem('ev_saved_brand', this.vehicleBrand);
        localStorage.setItem('ev_saved_model', this.vehicleModel);
        localStorage.setItem('ev_saved_network', this.network);
        localStorage.setItem('ev_saved_rate', this.rate);
        localStorage.setItem('ev_saved_efficiency', this.efficiency);
    }
};
