/**
 * ClearVoice audio stack
 *  - speakReference(): SpeechSynthesis with a warm neural-ish voice pick + fallback
 *  - synthesizeReferenceTone(): deterministic Web-Audio spoken-cadence fallback
 *  - recording store: IndexedDB blobs so attempts can be replayed word-by-word
 */

export type RefVoice = { name: string; voice: SpeechSynthesisVoice | null };

const PREFERRED = [
  'Google US English', 'Samantha', 'Microsoft Aria Online (Natural)', 'Microsoft Jenny',
  'Microsoft Aria', 'Google UK English Female', 'Allison', 'Ava', 'Karen', 'Tessa', 'Nora', 'Moira',
];

export function pickReferenceVoice(): RefVoice {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  for (const pref of PREFERRED) {
    const v = voices.find((v) => v.name === pref) ?? voices.find((v) => v.name.includes(pref.split(' ')[0]));
    if (v) return { name: v.name, voice: v };
  }
  const en = voices.find((v) => v.lang.startsWith('en-'));
  return en ? { name: en.name, voice: en } : { name: 'System English', voice: null };
}

export function speakReference(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const synth = window.speechSynthesis;
    if (!synth) return synthesizeReferenceTone(text).then(resolve, reject);
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const { voice } = pickReferenceVoice();
    if (voice) utter.voice = voice;
    utter.rate = 0.92;
    utter.pitch = 1.02;
    utter.volume = 1;
    utter.lang = voice?.lang ?? 'en-US';
    let done = false;
    utter.onend = () => { done = true; resolve(); };
    utter.onerror = () => {
      if (done) return;
      synthesizeReferenceTone(text).then(resolve, reject);
    };
    synth.speak(utter);
    // watchdog: some platforms silently never fire onend
    window.setTimeout(() => { if (!done) { done = true; synth.cancel(); synthesizeReferenceTone(text).then(resolve, reject); } }, Math.max(3200, text.length * 95));
  });
}

/** Offline-safe fallback: an elegant spoken-cadence motif (not word-accurate, never breaks). */
export function synthesizeReferenceTone(text: string): Promise<void> {
  return new Promise((resolve) => {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const words = text.split(/\s+/).filter(Boolean);
    const master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);
    const t0 = ctx.currentTime + 0.08;
    let t = t0;
    const notes = [392, 440, 523.25, 587.33, 659.25, 523.25, 440, 493.88];
    words.forEach((w, i) => {
      const dur = Math.min(0.5, 0.14 + w.length * 0.032);
      const base = notes[i % notes.length] * (i % 3 === 2 ? 0.75 : 1);
      [0, 1, 2, 3].forEach((h) => {
        const o = ctx.createOscillator();
        o.type = h === 0 ? 'sine' : h === 3 ? 'triangle' : 'sine';
        o.frequency.value = base * [1, 2, 3, 4][h];
        const g = ctx.createGain();
        const amp = [1, 0.32, 0.14, 0.05][h];
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(amp, t + 0.035);
        g.gain.setValueAtTime(amp, t + dur - 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + dur + 0.02);
      });
      t += dur + 0.085;
    });
    const total = (t - ctx.currentTime) * 1000 + 120;
    window.setTimeout(() => { ctx.close().catch(() => undefined); resolve(); }, total);
  });
}

/* ------------------------------------------------------- recordings DB */

const DB_NAME = 'clearvoice-audio';
const STORE = 'recordings';
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function saveRecording(key: string, blob: Blob): Promise<boolean> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}

export async function loadRecordingUrl(key: string): Promise<string | null> {
  try {
    const db = await openDb();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

export async function deleteRecording(key: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}
