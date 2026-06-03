import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

function getCtor(): { new (): SpeechRecognitionInstance } | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition(onTranscript: (text: string, isFinal: boolean) => void) {
  const Ctor = getCtor();
  const supported = !!Ctor;
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const cbRef = useRef(onTranscript);
  cbRef.current = onTranscript;

  useEffect(() => () => recRef.current?.abort(), []);

  // IMPORTANT: must run synchronously inside a user gesture — no awaits before rec.start()
  const start = useCallback(() => {
    if (!Ctor) {
      toast.error("Voice input isn't supported in this browser. Try Chrome on desktop or Android.");
      return;
    }
    if (listening) return;
    try {
      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = (typeof navigator !== "undefined" && navigator.language) || "en-US";
      rec.onresult = (event: any) => {
        let finalText = "";
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interimText += r[0].transcript;
        }
        if (finalText) cbRef.current(finalText, true);
        else if (interimText) cbRef.current(interimText, false);
      };
      rec.onerror = (e: any) => {
        setListening(false);
        const err = e?.error;
        if (err === "not-allowed" || err === "service-not-allowed") {
          toast.error("Microphone is blocked. Enable it in your browser settings.");
        } else if (err === "no-speech") {
          toast("No speech detected.");
        } else if (err === "audio-capture") {
          toast.error("No microphone found.");
        } else if (err === "network") {
          toast.error("Voice input needs an internet connection.");
        } else if (err && err !== "aborted") {
          toast.error(`Voice input error: ${err}`);
        }
      };
      rec.onend = () => setListening(false);
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch (e: any) {
      console.error("speech start failed", e);
      toast.error("Couldn't start voice input.");
      setListening(false);
    }
  }, [Ctor, listening]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
  }, []);

  // Always report supported=true so the UI shows the button; if the API is missing,
  // `start()` will show a clear toast instead of the button silently doing nothing.
  return { supported: true, nativeSupported: supported, listening, start, stop };
}
