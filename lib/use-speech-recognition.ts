import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type SpeechRecognitionResult = {
  audioLevel: number;
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

type AudioContextConstructor = typeof AudioContext;

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

function getAudioContext(): AudioContextConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const win = window as unknown as Record<string, unknown>;

  return (
    (win.AudioContext as AudioContextConstructor | undefined) ??
    (win.webkitAudioContext as AudioContextConstructor | undefined) ??
    null
  );
}

function getRecognitionLanguage(language: string) {
  if (language !== "auto") {
    return language;
  }

  return navigator.language || "zh-TW";
}

function getSpeechSupportSnapshot() {
  return getSpeechRecognition() !== null;
}

function getServerSpeechSupportSnapshot() {
  return false;
}

function subscribeToSpeechSupport() {
  return () => {};
}

export function useSpeechRecognition({
  language = "auto",
}: {
  language?: string;
} = {}): SpeechRecognitionResult {
  const [audioLevel, setAudioLevel] = useState(0);
  const isSupported = useSyncExternalStore(
    subscribeToSpeechSupport,
    getSpeechSupportSnapshot,
    getServerSpeechSupportSnapshot,
  );
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptRef = useRef("");

  const stopAudioMeter = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;

    void audioContextRef.current?.close();
    audioContextRef.current = null;
    setAudioLevel(0);
  }, []);

  const startAudioMeter = useCallback(async () => {
    const AudioContextClass = getAudioContext();

    if (!AudioContextClass || !navigator.mediaDevices?.getUserMedia) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContextClass();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 1024;
      const samples = new Uint8Array(analyser.fftSize);
      source.connect(analyser);
      audioContextRef.current = audioContext;
      audioStreamRef.current = stream;

      const tick = () => {
        analyser.getByteTimeDomainData(samples);

        let sumSquares = 0;

        for (const sample of samples) {
          const normalized = (sample - 128) / 128;
          sumSquares += normalized * normalized;
        }

        const rms = Math.sqrt(sumSquares / samples.length);
        const nextLevel = Math.min(1, rms * 5);

        setAudioLevel((currentLevel) => currentLevel * 0.55 + nextLevel * 0.45);
        animationFrameRef.current = requestAnimationFrame(tick);
      };

      tick();
    } catch {
      // SpeechRecognition surfaces permission errors separately; keep dictation usable
      // even when the decorative audio meter cannot attach to the stream.
    }
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognitionClass = getSpeechRecognition();

    if (!SpeechRecognitionClass) {
      setError("Voice input is not supported in this browser. Try Chrome or Safari.");
      return;
    }

    setError(null);
    setTranscript("");
    transcriptRef.current = "";
    stopAudioMeter();
    void startAudioMeter();

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = getRecognitionLanguage(language);

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
      stopAudioMeter();
      setIsListening(false);
    };

    recognition.onend = () => {
      stopAudioMeter();
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [language, startAudioMeter, stopAudioMeter]);

  const stopListening = useCallback((): string => {
    recognitionRef.current?.stop();
    stopAudioMeter();
    setIsListening(false);

    return transcriptRef.current;
  }, [stopAudioMeter]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      stopAudioMeter();
    };
  }, [stopAudioMeter]);

  return {
    audioLevel,
    error,
    isListening,
    isSupported,
    startListening,
    stopListening,
    transcript,
  };
}
