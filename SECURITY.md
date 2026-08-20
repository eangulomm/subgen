# Security Policy

## Supported version

La rama `main` y la última release reciben correcciones de seguridad.

## Reportar una vulnerabilidad

No publiques datos sensibles ni archivos multimedia en un issue. Usa el canal privado de Security Advisories del repositorio GitHub cuando esté disponible. Incluye versión, navegador, impacto y pasos mínimos sin contenido personal.

## Modelo de amenazas

SubGen no tiene backend, cuentas ni secretos. Los riesgos principales son supply chain de npm/modelos, agotamiento de memoria por archivos hostiles, fallos de decodificadores y datos que un navegador/extensión pueda observar localmente. Las revisiones de modelo están fijadas, las dependencias tienen lockfile, la CSP restringe red y la UI nunca interpreta texto generado como HTML.
