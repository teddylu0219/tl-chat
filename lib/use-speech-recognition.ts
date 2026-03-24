import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionResult = {
  error: string | null;
  isListening: boolean;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => string;
  transcript: string;
};

// Web Speech API types (not in default TS lib)
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionResultItem {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const win = window as unknown as Record<string, unknown>;

  return (
    (win.SpeechRecognition as SpeechRecognitionConstructor | undefined) ??
    (win.webkitSpeechRecognition as SpeechRecognitionConstructor | undefined) ??
    null
  );
}

export function useSpeechRecognition(): SpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptRef = useRef("");

  // Safe to use lazy init — this hook is only used in client components
  // rendered after mount (behind isLoaded gate).
  const [isSupported] = useState(() =>
    typeof window !== "undefined" ? getSpeechRecognition() !== null : false,
  );

  const startListening = useCallback(() => {
    const SpeechRecognitionClass = getSpeechRecognition();

    if (!SpeechRecognitionClass) {
      return;
    }

    setError(null);
    setTranscript("");
    transcriptRef.current = "";

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = "";
      let interim = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];

        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      const combined = (final + interim).trim();
      transcriptRef.current = combined;
      setTranscript(combined);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "aborted") {
        return;
      }

      setError(
        event.error === "not-allowed"
          ? "Microphone access denied."
          : `Speech error: ${event.error}`,
      );
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback((): string => {
    recognitionRef.current?.stop();
    setIsListening(false);

    return transcriptRef.current;
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return {
    error,
    isListening,
    isSupported,
    startListening,
    stopListening,
    transcript,
  };
}
