# Investigación técnica (19-08-2026)

Esta investigación se realizó antes de implementar. Fuentes primarias/oficiales consultadas el 19 de agosto de 2026.

## Hallazgos

### Transformers.js y ONNX Runtime Web

- La versión npm verificada fue `@huggingface/transformers 4.2.0`; el repositorio oficial la presenta como release actual y licencia Apache-2.0. La librería ejecuta ASR y traducción con ONNX Runtime en navegador.
- WebGPU se habilita con `device: 'webgpu'`; la propia guía advierte que sigue siendo experimental fuera de Chromium. Por eso SubGen solicita un adaptador real y vuelve a WASM/CPU cuando no existe.
- La caché de navegador y la caché WASM están disponibles mediante `env.useBrowserCache`/`useWasmCache` y Cache Storage. Se usan, sin duplicar pesos en el service worker.
- Los modelos se descargan bajo demanda desde Hugging Face. La revisión puede fijarse; SubGen fija hashes concretos.

Fuentes: [Transformers.js](https://huggingface.co/docs/transformers.js/en/index), [WebGPU](https://huggingface.co/docs/transformers.js/en/guides/webgpu), [entorno/caché](https://huggingface.co/docs/transformers.js/api/env), [repositorio y licencia](https://github.com/huggingface/transformers.js/).

### ASR

- `onnx-community/whisper-tiny` es la conversión oficial-comunitaria compatible con Transformers.js del modelo multilingüe `openai/whisper-tiny`; no se eligió `.en` porque SubGen detecta/transcribe varios idiomas.
- Revisión fijada: `ff4177021cc41f7db950912b73ea4fdf7d01d8e7`.
- Los archivos ONNX q4 inspeccionados mediante la API oficial del Hub suman decenas de MB por encoder/decoder; el modelo base y pesos Whisper están bajo MIT.
- Se verificaron timestamps por chunks con una muestra sintética inglesa real.

Fuentes: [modelo ONNX](https://huggingface.co/onnx-community/whisper-tiny), [Whisper y licencia](https://github.com/openai/whisper), [licencia literal](https://github.com/openai/whisper/blob/main/LICENSE).

### Traducción

- Whisper no es un traductor general hacia español; SubGen separa ASR y traducción.
- `Xenova/opus-mt-en-es` es una conversión ONNX/Transformers.js de `Helsinki-NLP/opus-mt-en-es` (Marian). El modelo base declara Apache-2.0.
- Revisión fijada: `4b002a4c7edd54a7ced58877258b87f7efd3f892`.
- Se usa q4 y se libera Whisper antes de cargar el traductor para reducir presión de memoria.

Fuentes: [conversión Transformers.js](https://huggingface.co/Xenova/opus-mt-en-es), [modelo base/licencia](https://huggingface.co/Helsinki-NLP/opus-mt-en-es).

### Multimedia

- `AudioContext.decodeAudioData` es la ruta inicial porque evita descargar FFmpeg cuando el navegador entiende el contenedor/codec.
- `ffmpeg.wasm 0.12.15` se ejecuta en un worker; su documentación confirma que antes de procesar hay que poblar su filesystem, lo que implica memoria adicional. Por eso es fallback y los archivos grandes reciben una recomendación, no una promesa.
- El core single-thread 0.12.10 evita exigir `SharedArrayBuffer`/COEP. El multithread necesita requisitos de seguridad adicionales y consume más memoria/CPU.
- `ffmpeg.wasm` wrapper es MIT; `@ffmpeg/core` declara GPL-2.0-or-later.

Fuentes: [visión general](https://ffmpegwasm.netlify.app/docs/overview/), [uso y abort](https://ffmpegwasm.netlify.app/docs/getting-started/usage/), [rendimiento](https://ffmpegwasm.netlify.app/docs/performance/), [repositorio](https://github.com/ffmpegwasm/ffmpeg.wasm).

### APIs web

- WebGPU requiere contexto seguro y `requestAdapter()` puede resolver `null` aunque `navigator.gpu` exista; la implementación comprueba el adaptador.
- Storage Estimate puede no estar disponible o ser denegado; todos los hints son opcionales.
- File, Blob URL, Workers y Cache Storage se detectan antes de usarse. No se usan nombres de dispositivo para elegir calidad.

Fuente: [GPU.requestAdapter (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/GPU/requestAdapter), [StorageManager.estimate](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate), [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API), [File API](https://developer.mozilla.org/en-US/docs/Web/API/File_API).

### Subtítulos

- SRT se genera en un módulo puro: ordena, elimina vacíos, evita solapes, descarta intervalos imposibles tras clamp, conserva UTF-8 y deduplica repeticiones contiguas.
- El wrapping intenta 42 caracteres por línea y máximo dos líneas, equilibrando por palabras; es una heurística, nunca desplaza timestamps solo por estética.
- Los resultados de modelo mantienen sus intervalos y son editables antes de descargar.

### PWA y offline

- El service worker cachea únicamente el shell same-origin con estrategia network-first.
- Transformers.js gestiona pesos/runtime en su Cache Storage. No se precachean cientos de MB sin acción del usuario.
- Offline completo es viable después de una carga y ejecución exitosas, siempre que el navegador conserve ambas cachés. FFmpeg fallback depende de que su core jsDelivr haya quedado cacheado; no se promete offline para un codec no usado previamente.

### Hosting

- Cloudflare Pages Free: 500 builds/mes, 1 build concurrente, timeout 20 min, 20.000 archivos, 25 MiB por asset, 100 dominios personalizados y 100 proyectos/cuenta.
- Las solicitudes a assets estáticos son gratuitas e ilimitadas en planes Free y de pago. SubGen no usa Functions.
- `_headers` soporta CSP y headers de seguridad; límite de 100 reglas/2.000 caracteres por regla.
- El mayor asset generado es ONNX Runtime WASM de 23.567 kB (~22,5 MiB), bajo el máximo de 25 MiB.
- No se requiere tarjeta, API ni servicio facturable para la arquitectura estática ya construida. La creación/conexión de cuenta queda sujeta a la sesión externa disponible.

Fuentes: [límites de Pages](https://developers.cloudflare.com/pages/platform/limits/), [precios de assets estáticos](https://developers.cloudflare.com/pages/functions/pricing/), [headers](https://developers.cloudflare.com/pages/configuration/headers/).

## Decisiones

1. SPA estática, sin backend ni cuentas.
2. APIs nativas primero; ffmpeg.wasm como fallback visible.
3. Whisper Tiny multilingüe q4 en equipos limitados; fp16/WebGPU como perfil equilibrado.
4. OPUS-MT solo para inglés→español en V1.
5. Workers separados de UI; se termina el worker al cancelar y se libera ASR antes de traducción.
6. Cache Storage administrable; PWA no precachea modelos.
7. Cloudflare Pages preferido; GitHub Pages es alternativa estática si Cloudflare no puede autenticarse.
