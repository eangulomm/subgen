import type { ProcessingState, SubtitleSegment, WorkerRequest, WorkerResponse } from '../../types';
import { AppError } from '../errors/appError';

export interface WorkerCallbacks {
  onState: (state: ProcessingState) => void;
}

export class AIWorkerClient {
  private worker: Worker | null = null;
  private activeRequestId: string | null = null;

  constructor(private readonly callbacks: WorkerCallbacks) {}

  private ensureWorker(): Worker {
    this.worker ??= new Worker(new URL('../../workers/ai.worker.ts', import.meta.url), {
      type: 'module',
      name: 'subgen-ai',
    });
    return this.worker;
  }

  private request<T extends WorkerResponse>(
    message: WorkerRequest,
    transfer: Transferable[] = [],
  ): Promise<T> {
    const worker = this.ensureWorker();
    this.activeRequestId = message.requestId;
    return new Promise<T>((resolve, reject) => {
      const listener = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.requestId !== message.requestId) return;
        if (event.data.type === 'state') {
          this.callbacks.onState(event.data.state);
          return;
        }
        if (event.data.type === 'error') {
          worker.removeEventListener('message', listener);
          reject(
            new AppError(
              event.data.error.code,
              event.data.error.userMessage,
              event.data.error.recoverable,
            ),
          );
          return;
        }
        worker.removeEventListener('message', listener);
        resolve(event.data as T);
      };
      worker.addEventListener('message', listener);
      worker.postMessage(message, transfer);
    });
  }

  async transcribe(
    audio: Float32Array,
    language: string | undefined,
    device: 'webgpu' | 'wasm',
    quality: 'light' | 'balanced',
  ): Promise<SubtitleSegment[]> {
    const requestId = crypto.randomUUID();
    const response = await this.request<Extract<WorkerResponse, { type: 'transcription-result' }>>(
      { type: 'transcribe', requestId, audio, language, device, quality },
      [audio.buffer],
    );
    return response.segments;
  }

  async translate(segments: SubtitleSegment[]): Promise<SubtitleSegment[]> {
    const requestId = crypto.randomUUID();
    const response = await this.request<Extract<WorkerResponse, { type: 'translation-result' }>>({
      type: 'translate',
      requestId,
      segments,
    });
    return response.segments;
  }

  cancel(): void {
    if (this.worker && this.activeRequestId)
      this.worker.postMessage({
        type: 'cancel',
        requestId: this.activeRequestId,
      } satisfies WorkerRequest);
    this.worker?.terminate();
    this.worker = null;
    this.activeRequestId = null;
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.activeRequestId = null;
  }
}
