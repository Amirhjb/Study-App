let ctx: AudioContext | null = null;

/** Se llama tras un clic del usuario para que el navegador permita el sonido. */
export function unlockAudio() {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    // Sin audio disponible: no pasa nada.
  }
}

/** Pequeña campanita generada (sin archivos de audio). */
export function chime(kind: 'focus-end' | 'break-end') {
  try {
    if (!ctx) ctx = new AudioContext();
    const notes = kind === 'focus-end' ? [880, 1175, 1568] : [660, 880];
    const t0 = ctx.currentTime + 0.02;
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = t0 + i * 0.18;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      o.connect(g).connect(ctx!.destination);
      o.start(t);
      o.stop(t + 1);
    });
  } catch {
    // ignorar
  }
}

export function notify(title: string, body: string) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, silent: true });
    }
  } catch {
    // ignorar
  }
}
