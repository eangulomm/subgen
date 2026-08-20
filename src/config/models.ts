import type { ModelQuality } from '../types';

export const MODEL_REVISIONS = {
  whisper: 'ff4177021cc41f7db950912b73ea4fdf7d01d8e7',
  translation: '4b002a4c7edd54a7ced58877258b87f7efd3f892',
} as const;

export const MODEL_CATALOG = {
  light: {
    id: 'onnx-community/whisper-tiny',
    label: 'Ligero',
    relativeAccuracy: 'Buena',
    relativeSpeed: 'Más rápida',
    relativeMemory: 'Baja',
    approximateDownloadMb: 72,
    dtype: 'q4' as const,
  },
  balanced: {
    id: 'onnx-community/whisper-tiny',
    label: 'Equilibrado',
    relativeAccuracy: 'Mejor',
    relativeSpeed: 'Media',
    relativeMemory: 'Media',
    approximateDownloadMb: 94,
    dtype: 'fp16' as const,
  },
} as const satisfies Record<Exclude<ModelQuality, 'auto'>, object>;

export const TRANSLATION_MODEL = {
  id: 'Xenova/opus-mt-en-es',
  label: 'OPUS-MT inglés → español',
  approximateDownloadMb: 122,
  dtype: 'q4' as const,
  license: 'Apache-2.0',
} as const;

export const MODEL_CACHE_NAME = 'transformers-cache';
