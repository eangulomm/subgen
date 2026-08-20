export type Locale = 'es' | 'en';
export type Theme = 'system' | 'light' | 'dark';
export type OutputMode = 'original' | 'translated' | 'bilingual';
export type SourceLanguage = 'auto' | 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt';
export type ModelQuality = 'auto' | 'light' | 'balanced';

export interface SubtitleSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  translatedText?: string;
}

export interface Capabilities {
  webgpu: boolean;
  wasm: boolean;
  workers: boolean;
  cacheStorage: boolean;
  indexedDb: boolean;
  hardwareConcurrency: number | null;
  deviceMemoryGb: number | null;
  storageAvailableBytes: number | null;
  storageQuotaBytes: number | null;
  recommendedModel: Exclude<ModelQuality, 'auto'>;
  recommendedMaxMinutes: number;
}

export type ProcessingStage =
  | 'idle'
  | 'preparing'
  | 'extracting'
  | 'loading-transcription'
  | 'transcribing'
  | 'loading-translation'
  | 'translating'
  | 'generating'
  | 'complete'
  | 'cancelled'
  | 'error';

export interface ProcessingState {
  stage: ProcessingStage;
  progress: number | null;
  message?: string;
}

export interface ProcessingOptions {
  sourceLanguage: SourceLanguage;
  outputMode: OutputMode;
  quality: ModelQuality;
}

export type WorkerRequest =
  | {
      type: 'transcribe';
      requestId: string;
      audio: Float32Array;
      language?: string;
      device: 'webgpu' | 'wasm';
      quality: Exclude<ModelQuality, 'auto'>;
    }
  | { type: 'translate'; requestId: string; segments: SubtitleSegment[] }
  | { type: 'dispose'; requestId: string }
  | { type: 'cancel'; requestId: string };

export type WorkerResponse =
  | { type: 'state'; requestId: string; state: ProcessingState }
  | {
      type: 'transcription-result';
      requestId: string;
      segments: SubtitleSegment[];
      language?: string;
    }
  | { type: 'translation-result'; requestId: string; segments: SubtitleSegment[] }
  | { type: 'disposed'; requestId: string }
  | { type: 'error'; requestId: string; error: SerializedAppError };

export type AppErrorCode =
  | 'unsupported-browser'
  | 'unsupported-codec'
  | 'memory'
  | 'storage'
  | 'network'
  | 'cancelled'
  | 'invalid-file'
  | 'model'
  | 'unknown';

export interface SerializedAppError {
  code: AppErrorCode;
  userMessage: string;
  technicalMessage?: string;
  recoverable: boolean;
}
