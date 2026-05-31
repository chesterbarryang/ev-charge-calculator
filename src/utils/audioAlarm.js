let alarmInterval = null;

export function playSilentStream(audioElement) {
    audioElement.play().catch(err => console.warn("Audio lock tracking contextual interface check:", err));
}

export function startSynthAlarm(audioContext, uiButtonElement, durationTextElement) {
    uiButtonElement.textContent = "🔕 Silence Alarm Notification";
    uiButtonElement.className = "w-full bg-amber-500 text-slate-950 font-black text-sm p-4 rounded-xl animate-pulse cursor-pointer";
    durationTextElement.textContent = "⚡ CHARGING COMPLETE!";

    alarmInterval = setInterval(() => {
        if (!audioContext) return;
        let osc = audioContext.createOscillator();
        let gain = audioContext.createGain();
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, audioContext.currentTime); 
        gain.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4); 
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start();
        osc.stop(audioContext.currentTime + 0.5);
    }, 1000);
}

export function clearSynthAlarm() {
    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }
}
