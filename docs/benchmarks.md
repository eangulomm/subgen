# Benchmarks y compatibilidad

## Metodología reproducible

1. Generar audio legal en macOS: `say -v Samantha -r 155 -o sample.wav --file-format=WAVE --data-format=LEI16@16000 'Hello…'`.
2. Abrir build local en Chromium con consola limpia.
3. Elegir English, Bilingüe y Ligero.
4. Medir desde “Generar subtítulos” hasta “Subtítulos generados”.
5. Registrar caché, segmentos y traducción; no extrapolar a otros equipos.

## Resultado observado (19-08-2026)

| Entorno                                                 | Modelo                       | Audio                             | Caché                        | Tiempo              | Memoria                  |
| ------------------------------------------------------- | ---------------------------- | --------------------------------- | ---------------------------- | ------------------- | ------------------------ |
| Codex in-app Chromium, 8 núcleos/8 GB expuestos, WebGPU | Whisper Tiny q4 + OPUS-MT q4 | WAV inglés sintético, 4 s, 152 KB | caliente, 388 MB/17 entradas | completo en ≤16,7 s | pico no expuesto por API |

Resultado: dos segmentos correctos con timestamps aproximados `0:00–0:02`/`0:02–0:04`; traducciones “Hola, esto es una prueba de subtítulos privada.” y “Todo se queda en este dispositivo.”; cero errores/warnings de consola observados.

No se ejecutaron archivos de 5/30/60/120 minutos por tiempo y recursos del entorno. SubGen no usa por ello un máximo absoluto; muestra una recomendación adaptativa y documenta el riesgo de memoria.

## Matriz

| Objetivo               | UI/flujo      | Inferencia real | Nota                                         |
| ---------------------- | ------------- | --------------- | -------------------------------------------- |
| Chromium desktop       | Verificado    | Verificado      | WebGPU, ASR, traducción, edición y caché     |
| Chromium móvil emulado | Verificado    | No verificado   | E2E y layout 390 px                          |
| Edge                   | No verificado | No verificado   | Motor Chromium no sustituye prueba real      |
| Chrome Android físico  | No verificado | No verificado   | batería/memoria requieren dispositivo        |
| Safari macOS/iOS       | No verificado | No verificado   | WebGPU no es Baseline; fallback WASM posible |
| Firefox                | No verificado | No verificado   | fallback WASM previsto                       |
