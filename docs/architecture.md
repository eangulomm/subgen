# Arquitectura

## Principios

- Privacidad por diseño: no existe ruta de upload ni backend.
- Coste operativo obligatorio $0: inferencia en el cliente y hosting estático.
- Honestidad: capacidades y formatos se detectan; las compatibilidades no probadas figuran como tales.
- Resiliencia: la transcripción permanece disponible si falla la traducción.

## Componentes

| Área                     | Responsabilidad                                                      |
| ------------------------ | -------------------------------------------------------------------- |
| `App.tsx`                | Orquesta UI, estado, cancelación, recuperación, editor y descarga    |
| `lib/audio`              | Decodificación nativa, resampling 16 kHz mono y fallback ffmpeg.wasm |
| `workers/ai.worker.ts`   | Carga/inferencia/dispose de ASR y traducción                         |
| `lib/ai/workerClient.ts` | Protocolo tipado UI↔worker y terminación                             |
| `lib/subtitles`          | Legibilidad, normalización temporal y serialización SRT              |
| `lib/capabilities`       | Adaptador WebGPU real, WASM/workers, hardware y cuota                |
| `lib/models/cache.ts`    | Inspección y borrado explícito de Cache Storage                      |
| `config/models.ts`       | IDs, revisiones, perfiles y tamaños mostrados                        |

## Máquina de estados

`idle → preparing → extracting → loading-transcription → transcribing → loading-translation → translating → generating → complete`

Desde cualquier fase activa puede ir a `cancelled` o `error`. El progreso es `null` cuando la tecnología no expone una medida real.

## Memoria y cancelación

- El `ArrayBuffer` del archivo se consume en AudioContext o se escribe al FS de FFmpeg; no se conserva después de extraer muestras.
- El `Float32Array` se transfiere al worker, no se clona.
- Antes de traducir se invoca `dispose()` en Whisper.
- Cancelar aborta extracción, termina FFmpeg y termina el worker de IA. Reiniciar crea un worker limpio.
- Los object URLs se revocan tras metadata/descarga.

## Seguridad

- Sin secretos ni tokens; no hay `dangerouslySetInnerHTML`, `eval`, HTML de usuario ni base de datos.
- CSP restringe orígenes a self, Hugging Face y jsDelivr; `object-src none`, `frame-ancestors none`, referrer no-referrer y permisos sensibles desactivados.
- MIME y extensión se validan como señal inicial; el decodificador sigue siendo la validación autoritativa.
- Dependencias fijadas y lockfile; CI ejecuta lint, tipos, tests, build y E2E.

## ADR resumidos

- [ADR-0001: aplicación local sin backend](adr/0001-local-first.md)
- [ADR-0002: multimedia nativa con fallback FFmpeg](adr/0002-audio-extraction.md)
- [ADR-0003: hosting estático](adr/0003-static-hosting.md)
