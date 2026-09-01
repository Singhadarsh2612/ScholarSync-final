/**
 * audio/player.js
 * ---------------------------------------------------------------------------
 * One shared <audio> element for the interviewer's spoken replies.
 *
 * This element used to be created and exported by the Landing *page*, which
 * three other pages then imported — so an ordinary page module doubled as a
 * global singleton. It lives here instead, with the playback helpers that were
 * previously copy-pasted into each consumer.
 */

// A 1ms silent WAV. Browsers only allow programmatic playback after a user
// gesture, so we play this during a click to "unlock" the element for the
// real audio that arrives later from the backend.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

export const audioPlayer = new Audio();
audioPlayer.src = SILENT_WAV;

/** Stop playback and rewind. Safe to call when nothing is playing. */
export function stopAudio() {
  try {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
  } catch {
    /* nothing was playing */
  }
}

/**
 * Play a silent clip inside a user gesture so later programmatic playback is
 * permitted. Call this from a click handler before the first real audio.
 */
export function unlockAudio() {
  try {
    audioPlayer.src = SILENT_WAV;
    audioPlayer.load();
    return audioPlayer.play().catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

/**
 * Play base64-encoded WAV audio returned by the backend.
 * Retries once, since the first attempt can still be blocked by autoplay
 * policy if no gesture has been registered yet.
 */
export function playBase64Audio(base64) {
  if (!base64) return;

  stopAudio();
  try {
    audioPlayer.src = `data:audio/wav;base64,${base64}`;
    audioPlayer.load();

    const started = audioPlayer.play();
    if (started !== undefined) {
      started.catch(() => {
        setTimeout(() => audioPlayer.play().catch(() => {}), 500);
      });
    }
  } catch (err) {
    console.error('Audio playback failed:', err);
  }
}

export default audioPlayer;
