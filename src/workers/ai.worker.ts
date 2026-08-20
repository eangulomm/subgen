/// <reference lib="webworker" />

import { env, pipeline } from '@huggingface/transformers';
import { MODEL_CATALOG, MODEL_REVISIONS, TRANSLATION_MODEL } from '../config/models';
import { serializeError } from '../lib/errors/appError';
import { improveSegmentReadability } from '../lib/subtitles/segment';
import { mergeTranslations } from '../lib/translation/mergeTranslations';
import type { ProcessingState, WorkerRequest, WorkerResponse } from '../types';

type ProgressItem = {
  status?: string;
  progress?: number;
  loaded?: number;
  total?: number;
  file?: string;
};
type ASROutput = {
  text?: string;
  chunks?: Array<{ text: string; timestamp: [number, number | null] }>;
};
type TranslationOutput = Array<{ translation_text?: string; generated_text?: string }>;
type DisposablePipeline = { dispose?: () => void | Promise<void> };

let transcriber: ((audio: Float32Array, options: Record<string, unknown>) => Promise<ASROutput>) &
  DisposablePipeline;
let translator: ((text: string, options?: Record<string, unknown>) => Promise<TranslationOutput>) &
  DisposablePipeline;
let cancelled = false;

env.useBrowserCache = true;
env.useWasmCache = true;

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

function state(
  requestId: string,
  stage: ProcessingState['stage'],
  progress: number | null,
  message?: string,
): void {
  post({ type: 'state', requestId, state: { stage, progress, message } });
}

function modelProgress(requestId: string, stage: 'loading-transcription' | 'loading-translation') {
  return (item: ProgressItem): void => {
    if (cancelled) return;
    const progress =
      typeof item.progress === 'number'
        ? item.progress / (item.progress > 1 ? 100 : 1)
        : item.loaded != null && item.total
          ? item.loaded / item.total
          : null;
    state(requestId, stage, progress, item.file);
  };
}

async function disposePipeline(pipe: DisposablePipeline | undefined): Promise<void> {
  await pipe?.dispose?.();
}

async function transcribe(request: Extract<WorkerRequest, { type: 'transcribe' }>): Promise<void> {
  cancelled = false;
  const model = MODEL_CATALOG[request.quality];
  state(request.requestId, 'loading-transcription', null);
  transcriber ??= (await pipeline('automatic-speech-recognition', model.id, {
    device: request.device,
    dtype: request.device === 'webgpu' && request.quality === 'balanced' ? 'fp16' : 'q4',
    revision: MODEL_REVISIONS.whisper,
    progress_callback: modelProgress(request.requestId, 'loading-transcription'),
  })) as unknown as typeof transcriber;
  if (cancelled) return;
  state(request.requestId, 'transcribing', null);
  const output = await transcriber(request.audio, {
    language: request.language,
    task: 'transcribe',
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
  });
  if (cancelled) return;
  const raw = output.chunks?.length
    ? output.chunks.map((chunk, index) => ({
        id: `segment-${index + 1}`,
        start: chunk.timestamp[0],
        end: chunk.timestamp[1] ?? chunk.timestamp[0] + 3,
        text: chunk.text.trim(),
      }))
    : [
        {
          id: 'segment-1',
          start: 0,
          end: request.audio.length / 16000,
          text: output.text?.trim() ?? '',
        },
      ];
  const segments = improveSegmentReadability(raw.filter((segment) => segment.text));
  post({ type: 'transcription-result', requestId: request.requestId, segments });
}

async function translate(request: Extract<WorkerRequest, { type: 'translate' }>): Promise<void> {
  cancelled = false;
  await disposePipeline(transcriber);
  transcriber = undefined as unknown as typeof transcriber;
  state(request.requestId, 'loading-translation', null);
  translator ??= (await pipeline('translation', TRANSLATION_MODEL.id, {
    dtype: TRANSLATION_MODEL.dtype,
    revision: MODEL_REVISIONS.translation,
    progress_callback: modelProgress(request.requestId, 'loading-translation'),
  })) as unknown as typeof translator;
  const translations: string[] = [];
  for (const [index, segment] of request.segments.entries()) {
    if (cancelled) return;
    state(
      request.requestId,
      'translating',
      request.segments.length ? index / request.segments.length : 1,
    );
    const result = await translator(segment.text.replace(/\n/g, ' '), {
      num_beams: 1,
      do_sample: false,
    });
    translations.push(result[0]?.translation_text ?? result[0]?.generated_text ?? segment.text);
  }
  post({
    type: 'translation-result',
    requestId: request.requestId,
    segments: improveSegmentReadability(mergeTranslations(request.segments, translations)),
  });
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type === 'cancel') {
    cancelled = true;
    return;
  }
  if (request.type === 'dispose') {
    cancelled = true;
    void Promise.all([disposePipeline(transcriber), disposePipeline(translator)]).finally(() =>
      post({ type: 'disposed', requestId: request.requestId }),
    );
    return;
  }
  void (request.type === 'transcribe' ? transcribe(request) : translate(request)).catch(
    (error: unknown) => {
      post({ type: 'error', requestId: request.requestId, error: serializeError(error) });
    },
  );
};
