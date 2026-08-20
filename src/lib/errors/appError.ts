import type { AppErrorCode, SerializedAppError } from '../../types';

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    public readonly userMessage: string,
    public readonly recoverable = true,
    options?: ErrorOptions,
  ) {
    super(userMessage, options);
    this.name = 'AppError';
  }
}

export function serializeError(error: unknown): SerializedAppError {
  if (error instanceof AppError) {
    return {
      code: error.code,
      userMessage: error.userMessage,
      technicalMessage: error.stack,
      recoverable: error.recoverable,
    };
  }

  const technicalMessage = error instanceof Error ? error.message : String(error);
  const lower = technicalMessage.toLowerCase();
  if (lower.includes('memory') || lower.includes('allocation')) {
    return {
      code: 'memory',
      userMessage:
        'Tu dispositivo se quedó sin memoria. Prueba un modelo más ligero, un archivo más corto o cierra otras pestañas.',
      technicalMessage,
      recoverable: true,
    };
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return {
      code: 'network',
      userMessage:
        'No se pudo descargar el modelo. Revisa la conexión y vuelve a intentarlo; los archivos permanecen en tu dispositivo.',
      technicalMessage,
      recoverable: true,
    };
  }
  return {
    code: 'unknown',
    userMessage: 'Ocurrió un problema inesperado. Puedes volver a intentarlo.',
    technicalMessage,
    recoverable: true,
  };
}
