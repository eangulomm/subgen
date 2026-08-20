# ADR-0002 — Audio nativo con fallback ffmpeg.wasm

**Estado:** aceptada, 19-08-2026.

## Decisión

Intentar `AudioContext.decodeAudioData` y usar ffmpeg.wasm single-thread solo ante fallo.

## Consecuencias

Formatos nativos evitan ~32 MB de core y un filesystem virtual. MKV/codecs no nativos ganan cobertura, pero pueden duplicar memoria del archivo y no son apropiados para varios GB; se avisa sin bloquear arbitrariamente.
