# ADR-0003 — Cloudflare Pages estático

**Estado:** aceptada, 19-08-2026.

## Decisión

Publicar `dist/` sin Pages Functions. Modelos permanecen en Hugging Face y el core FFmpeg en jsDelivr.

## Consecuencias

Solicitudes estáticas gratuitas/ilimitadas y coste mensual obligatorio $0. CSP necesita permitir dos orígenes; el primer uso requiere red y los modelos no están bajo el dominio de SubGen.
