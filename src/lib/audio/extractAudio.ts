import { AppError } from '../errors/appError';

export interface ExtractedAudio {
  samples: Float32Array;
  duration: number;
  sampleRate: 16000;
  method: 'native' | 'ffmpeg';
}

export interface AudioExtractionOptions {
  signal: AbortSignal;
  onProgress?: (value: number | null) => void;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new AppError('cancelled', 'Procesamiento cancelado.', true);
}

function mixToMono(buffer: AudioBuffer): Float32Array {
  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < buffer.length; index += 1)
      mono[index] += (data[index] ?? 0) / buffer.numberOfChannels;
  }
  return mono;
}

async function resample(buffer: AudioBuffer, signal: AbortSignal): Promise<Float32Array> {
  throwIfAborted(signal);
  if (buffer.sampleRate === 16000) return mixToMono(buffer);
  const outputLength = Math.ceil(buffer.duration * 16000);
  const context = new OfflineAudioContext(1, outputLength, 16000);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
  const rendered = await context.startRendering();
  throwIfAborted(signal);
  return new Float32Array(rendered.getChannelData(0));
}

async function decodeNative(file: File, signal: AbortSignal): Promise<ExtractedAudio> {
  throwIfAborted(signal);
  const context = new AudioContext({ sampleRate: 16000 });
  try {
    const data = await file.arrayBuffer();
    throwIfAborted(signal);
    const decoded = await context.decodeAudioData(data);
    const samples = await resample(decoded, signal);
    return { samples, duration: decoded.duration, sampleRate: 16000, method: 'native' };
  } finally {
    await context.close();
  }
}

async function decodeWithFfmpeg(
  file: File,
  options: AudioExtractionOptions,
): Promise<ExtractedAudio> {
  const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    import('@ffmpeg/util'),
  ]);
  const ffmpeg = new FFmpeg();
  const abort = () => ffmpeg.terminate();
  options.signal.addEventListener('abort', abort, { once: true });
  ffmpeg.on('progress', ({ progress }) =>
    options.onProgress?.(Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : null),
  );
  try {
    const coreBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${coreBase}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    throwIfAborted(options.signal);
    const inputName = `input.${file.name.split('.').pop()?.toLowerCase() || 'bin'}`;
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    await ffmpeg.exec([
      '-i',
      inputName,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-f',
      'wav',
      'audio.wav',
    ]);
    throwIfAborted(options.signal);
    const wav = await ffmpeg.readFile('audio.wav');
    if (typeof wav === 'string') throw new Error('Unexpected text output from ffmpeg');
    const context = new AudioContext({ sampleRate: 16000 });
    try {
      const copied = new Uint8Array(wav).buffer;
      const decoded = await context.decodeAudioData(copied);
      return {
        samples: mixToMono(decoded),
        duration: decoded.duration,
        sampleRate: 16000,
        method: 'ffmpeg',
      };
    } finally {
      await context.close();
    }
  } catch (error) {
    if (options.signal.aborted) throw new AppError('cancelled', 'Procesamiento cancelado.');
    throw new AppError(
      'unsupported-codec',
      'Este archivo usa un formato o codec que el navegador no pudo procesar. Prueba convertirlo a MP4 (H.264/AAC), WebM o WAV.',
      true,
      { cause: error },
    );
  } finally {
    options.signal.removeEventListener('abort', abort);
    ffmpeg.terminate();
  }
}

export async function extractAudio(
  file: File,
  options: AudioExtractionOptions,
): Promise<ExtractedAudio> {
  if (
    !file.type.startsWith('video/') &&
    !file.type.startsWith('audio/') &&
    !/\.(mkv|m4v|mov|mp4|webm|wav|mp3|m4a|aac|ogg|flac)$/i.test(file.name)
  ) {
    throw new AppError('invalid-file', 'Selecciona un archivo de video o audio compatible.');
  }
  options.onProgress?.(null);
  try {
    const result = await decodeNative(file, options.signal);
    options.onProgress?.(1);
    return result;
  } catch (error) {
    if (options.signal.aborted) throw error;
    return decodeWithFfmpeg(file, options);
  }
}
