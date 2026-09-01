/**
 * hooks/useSpeechRecognition.js
 * ---------------------------------------------------------------------------
 * Browser speech-to-text for the chat box, wrapped as a hook.
 *
 * Extracted from a ~30-line block inline in the Interview page. Note this is
 * the browser's Web Speech API (Chrome only), which is separate from the Azure
 * Speech STT the backend exposes at /ai/stt.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** The Web Speech API constructor, or null where unsupported. */
const getRecognitionCtor = () =>
  (typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;

export const isSpeechRecognitionSupported = () => Boolean(getRecognitionCtor());

/**
 * @param onTranscript called with the full transcript as the user speaks
 * @returns {{isRecording, toggle, stop, supported}}
 */
export function useSpeechRecognition(onTranscript) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  // Keep the newest callback without restarting recognition on every render.
  const callbackRef = useRef(onTranscript);
  useEffect(() => { callbackRef.current = onTranscript; }, [onTranscript]);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* already stopped */
    }
    setIsRecording(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return false;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += chunk;
        else interim += chunk;
      }
      callbackRef.current?.(finalTranscript + interim);
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    return true;
  }, []);

  const toggle = useCallback(() => {
    if (isRecording) stop();
    else start();
  }, [isRecording, start, stop]);

  // Never leave the microphone open when the page unmounts.
  useEffect(() => stop, [stop]);

  return { isRecording, toggle, stop, supported: isSpeechRecognitionSupported() };
}

export default useSpeechRecognition;
