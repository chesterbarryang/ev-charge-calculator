let alarmInterval: any = null;

export function playSilentStream(audioElement: HTMLAudioElement) {
  audioElement.play().catch(err => console.warn("Audio lock tracking contextual interface check:", err));
}

export function startSynthAlarm(
  audioContext: AudioContext | null,
  uiButtonElement: HTMLButtonElement,
  durationTextElement: HTMLParagraphElement | HTMLSpanElement
) {
  if (uiButtonElement) {
    uiButtonElement.textContent = "🔕 Silence Alarm Notification";
    uiButtonElement.className = "w-full bg-amber-500 text-slate-950 font-black text-sm p-4 rounded-xl animate-pulse cursor-pointer";
  }
  if (durationTextElement) {
    durationTextElement.textContent = "⚡ CHARGING COMPLETE!";
  }

  if (alarmInterval) clearInterval(alarmInterval);

  alarmInterval = setInterval(() => {
    if (!audioContext) return;
    try {
      if (audioContext.state === "suspended") {
        audioContext.resume();
      }
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioContext.currentTime); 
      gain.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4); 
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + 0.5);
    } catch (e) {
      console.warn("Could not fire synthesized alarm ping:", e);
    }
  }, 1000);
}

export function clearSynthAlarm() {
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
}
