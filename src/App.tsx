import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MODEL_CATALOG, TRANSLATION_MODEL } from './config/models';
import { messages } from './i18n/messages';
import { AIWorkerClient } from './lib/ai/workerClient';
import { extractAudio } from './lib/audio/extractAudio';
import { detectCapabilities, recommendedFileBytes } from './lib/capabilities/detectCapabilities';
import { serializeError } from './lib/errors/appError';
import {
  formatBytes,
  formatDuration,
  readMediaMetadata,
  type MediaMetadata,
} from './lib/files/mediaMetadata';
import { outputFileName } from './lib/files/outputName';
import { clearModelCache, inspectModelCache, type CacheSummary } from './lib/models/cache';
import { toSrt } from './lib/subtitles/srt';
import type {
  Capabilities,
  Locale,
  ModelQuality,
  OutputMode,
  ProcessingState,
  SourceLanguage,
  SubtitleSegment,
  Theme,
} from './types';

const initialState: ProcessingState = { stage: 'idle', progress: null };
const languageLabels: Record<Exclude<SourceLanguage, 'auto'>, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
};

function e2eSegments(duration: number): SubtitleSegment[] {
  return [
    {
      id: 'mock-1',
      start: 0,
      end: Math.min(2.8, duration),
      text: 'A private subtitle test.',
      translatedText: 'Una prueba privada de subtítulos.',
    },
    {
      id: 'mock-2',
      start: Math.min(3, duration),
      end: Math.min(5.8, duration),
      text: 'Everything stays on this device.',
      translatedText: 'Todo permanece en este dispositivo.',
    },
  ].filter((segment) => segment.end > segment.start);
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(
    () => (localStorage.getItem('subgen-locale') as Locale) || 'es',
  );
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('subgen-theme') as Theme) || 'system',
  );
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState<SourceLanguage>('auto');
  const [outputMode, setOutputMode] = useState<OutputMode>('translated');
  const [quality, setQuality] = useState<ModelQuality>('auto');
  const [state, setState] = useState<ProcessingState>(initialState);
  const [segments, setSegments] = useState<SubtitleSegment[]>([]);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [cacheSummary, setCacheSummary] = useState<CacheSummary>({ entries: 0, bytes: null });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [translationFailed, setTranslationFailed] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const workerRef = useRef<AIWorkerClient | null>(null);
  const t = messages[locale];
  const isProcessing = !['idle', 'complete', 'cancelled', 'error'].includes(state.stage);

  useEffect(() => {
    void detectCapabilities().then(setCapabilities);
    void inspectModelCache().then(setCacheSummary);
    return () => workerRef.current?.dispose();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = locale;
    localStorage.setItem('subgen-theme', theme);
    localStorage.setItem('subgen-locale', locale);
  }, [theme, locale]);

  const selectedQuality =
    quality === 'auto' ? (capabilities?.recommendedModel ?? 'light') : quality;
  const modelInfo = MODEL_CATALOG[selectedQuality];
  const needsTranslation = outputMode !== 'original';
  const downloadMb =
    modelInfo.approximateDownloadMb +
    (needsTranslation ? TRANSLATION_MODEL.approximateDownloadMb : 0);
  const isLargeFile = Boolean(
    file && capabilities && file.size > recommendedFileBytes(capabilities),
  );

  const setSelectedFile = useCallback(async (selected: File | null) => {
    if (!selected) return;
    workerRef.current?.dispose();
    setFile(selected);
    setSegments([]);
    setErrorMessage(null);
    setState(initialState);
    setTranslationFailed(false);
    setMetadata(await readMediaMetadata(selected));
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    workerRef.current?.cancel();
    workerRef.current = null;
    setState({ stage: 'cancelled', progress: null });
  }, []);

  const runTranslation = useCallback(
    async (
      sourceSegments: SubtitleSegment[],
      client: AIWorkerClient,
    ): Promise<SubtitleSegment[]> => {
      if (!needsTranslation) return sourceSegments;
      try {
        const translated = await client.translate(sourceSegments);
        setTranslationFailed(false);
        return translated;
      } catch (error) {
        if (abortRef.current?.signal.aborted) throw error;
        setTranslationFailed(true);
        setErrorMessage(
          'La transcripción está lista, pero la traducción falló. Puedes descargar el original o reintentar la traducción.',
        );
        return sourceSegments;
      }
    },
    [needsTranslation],
  );

  const processFile = useCallback(async () => {
    if (!file || !capabilities) return;
    if (!capabilities.wasm || !capabilities.workers) {
      setErrorMessage(
        'Este navegador no ofrece WebAssembly y Web Workers, necesarios para procesar el archivo localmente.',
      );
      setState({ stage: 'error', progress: null });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setErrorMessage(null);
    setSegments([]);
    setState({ stage: 'preparing', progress: null });
    const client = new AIWorkerClient({ onState: setState });
    workerRef.current = client;
    try {
      let result: SubtitleSegment[];
      if (import.meta.env.VITE_E2E_MODE === 'true') {
        setState({ stage: 'extracting', progress: 0.5 });
        await new Promise((resolve) => window.setTimeout(resolve, 80));
        setState({ stage: 'transcribing', progress: null });
        result = e2eSegments(metadata?.duration ?? 6);
      } else {
        setState({ stage: 'extracting', progress: null });
        const audio = await extractAudio(file, {
          signal: controller.signal,
          onProgress: (progress) => setState({ stage: 'extracting', progress }),
        });
        result = await client.transcribe(
          audio.samples,
          sourceLanguage === 'auto' ? undefined : sourceLanguage,
          capabilities.webgpu ? 'webgpu' : 'wasm',
          selectedQuality,
        );
      }
      if (controller.signal.aborted) return;
      setSegments(result);
      if (import.meta.env.VITE_E2E_MODE !== 'true') result = await runTranslation(result, client);
      else if (needsTranslation) result = e2eSegments(metadata?.duration ?? 6);
      setSegments(result);
      setState({ stage: 'generating', progress: 1 });
      await new Promise((resolve) => window.setTimeout(resolve, 30));
      setState({ stage: 'complete', progress: 1 });
      void inspectModelCache().then(setCacheSummary);
    } catch (error) {
      if (controller.signal.aborted) return;
      const serialized = serializeError(error);
      setErrorMessage(serialized.userMessage);
      setState({ stage: 'error', progress: null });
    } finally {
      abortRef.current = null;
    }
  }, [
    capabilities,
    file,
    metadata,
    needsTranslation,
    runTranslation,
    selectedQuality,
    sourceLanguage,
  ]);

  const retryTranslation = useCallback(async () => {
    if (!segments.length) return;
    setErrorMessage(null);
    const client = workerRef.current ?? new AIWorkerClient({ onState: setState });
    workerRef.current = client;
    try {
      const translated = await runTranslation(segments, client);
      setSegments(translated);
      setState({ stage: 'complete', progress: 1 });
    } catch (error) {
      setErrorMessage(serializeError(error).userMessage);
    }
  }, [runTranslation, segments]);

  const downloadName = useMemo(
    () =>
      file
        ? outputFileName(
            file.name,
            outputMode,
            sourceLanguage === 'auto' ? 'original' : sourceLanguage,
          )
        : 'subtitles.srt',
    [file, outputMode, sourceLanguage],
  );

  const download = useCallback(() => {
    const content = toSrt(
      segments,
      translationFailed && outputMode !== 'original' ? 'original' : outputMode,
      metadata?.duration ?? undefined,
    );
    const url = URL.createObjectURL(
      new Blob([content], { type: 'application/x-subrip;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = downloadName;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [downloadName, metadata?.duration, outputMode, segments, translationFailed]);

  const reset = useCallback(() => {
    cancel();
    setFile(null);
    setMetadata(null);
    setSegments([]);
    setErrorMessage(null);
    setState(initialState);
    setTranslationFailed(false);
    if (inputRef.current) inputRef.current.value = '';
  }, [cancel]);

  const stageLabel = t.stages[state.stage];

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#main" aria-label="SubGen, inicio">
          <span className="brand-mark" aria-hidden="true">
            S
          </span>
          <span>SUBGEN</span>
        </a>
        <div className="header-controls">
          <label className="compact-control">
            <span className="sr-only">{t.locale}</span>
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
              aria-label={t.locale}
            >
              <option value="es">ES</option>
              <option value="en">EN</option>
            </select>
          </label>
          <label className="compact-control">
            <span className="sr-only">{t.theme}</span>
            <select
              value={theme}
              onChange={(event) => setTheme(event.target.value as Theme)}
              aria-label={t.theme}
            >
              <option value="system">◐</option>
              <option value="light">☀</option>
              <option value="dark">☾</option>
            </select>
          </label>
        </div>
      </header>

      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <p className="eyebrow">
            <span aria-hidden="true">✦</span> IA local · Sin cuentas · Sin subidas
          </p>
          <h1 id="hero-title">{t.tagline}</h1>
          <p className="hero-copy">{t.subtitle}</p>
          <div className="privacy-pill">
            <span aria-hidden="true">⌾</span>
            <span>{t.privacy}</span>
          </div>
        </section>

        <section className="workspace-card" aria-label="Generador de subtítulos">
          {!file ? (
            <div
              className={`drop-zone ${dragActive ? 'is-dragging' : ''}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (event.currentTarget === event.target) setDragActive(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                void setSelectedFile(event.dataTransfer.files[0] ?? null);
              }}
            >
              <div className="upload-icon" aria-hidden="true">
                <span>↑</span>
              </div>
              <h2>{t.dropTitle}</h2>
              <p>{t.dropHint}</p>
              <button
                className="primary-button"
                type="button"
                onClick={() => inputRef.current?.click()}
              >
                {t.select}
              </button>
              <input
                ref={inputRef}
                className="sr-only"
                type="file"
                aria-label={t.select}
                accept="video/*,audio/*,.mkv,.m4v"
                onChange={(event) => void setSelectedFile(event.target.files?.[0] ?? null)}
              />
            </div>
          ) : (
            <div className="processor">
              <div className="file-summary">
                <div className="file-icon" aria-hidden="true">
                  ▶
                </div>
                <div className="file-details">
                  <strong>{file.name}</strong>
                  <span>
                    {formatDuration(metadata?.duration ?? null)} · {formatBytes(file.size)}
                  </span>
                </div>
                {!isProcessing && (
                  <button
                    className="icon-button"
                    type="button"
                    onClick={reset}
                    aria-label="Quitar archivo"
                  >
                    ×
                  </button>
                )}
              </div>

              {isLargeFile && (
                <div className="notice warning" role="status">
                  {t.fileWarning}
                </div>
              )}

              {!isProcessing && state.stage !== 'complete' && (
                <>
                  <div className="options-grid">
                    <label>
                      <span>{t.language}</span>
                      <select
                        value={sourceLanguage}
                        onChange={(event) =>
                          setSourceLanguage(event.target.value as SourceLanguage)
                        }
                      >
                        <option value="auto">{t.automatic}</option>
                        {Object.entries(languageLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>{t.output}</span>
                      <select
                        aria-label={t.output}
                        value={outputMode}
                        onChange={(event) => setOutputMode(event.target.value as OutputMode)}
                      >
                        <option value="translated">{t.spanish}</option>
                        <option value="original">{t.original}</option>
                        <option value="bilingual">{t.bilingual}</option>
                      </select>
                    </label>
                    <label>
                      <span>{t.quality}</span>
                      <select
                        value={quality}
                        onChange={(event) => setQuality(event.target.value as ModelQuality)}
                      >
                        <option value="auto">
                          {t.automatic} ·{' '}
                          {MODEL_CATALOG[capabilities?.recommendedModel ?? 'light'].label}
                        </option>
                        <option value="light">
                          Ligero · ~{MODEL_CATALOG.light.approximateDownloadMb} MB
                        </option>
                        <option value="balanced">
                          Equilibrado · ~{MODEL_CATALOG.balanced.approximateDownloadMb} MB
                        </option>
                      </select>
                    </label>
                  </div>
                  <details className="model-details">
                    <summary>{t.advanced}</summary>
                    <div className="model-facts">
                      <span>Velocidad: {modelInfo.relativeSpeed}</span>
                      <span>Memoria: {modelInfo.relativeMemory}</span>
                      <span>Precisión relativa: {modelInfo.relativeAccuracy}</span>
                      <span>Descarga estimada total: ~{downloadMb} MB</span>
                    </div>
                  </details>
                  <div className="notice" role="note">
                    {t.firstDownload}
                  </div>
                  <button
                    className="primary-button generate"
                    type="button"
                    onClick={() => void processFile()}
                  >
                    {t.generate}
                    <span aria-hidden="true">→</span>
                  </button>
                </>
              )}

              {isProcessing && (
                <div className="progress-panel" aria-live="polite">
                  <div className="orbit" aria-hidden="true">
                    <span />
                  </div>
                  <h2>{stageLabel}</h2>
                  {state.message && (
                    <p className="technical-progress">{state.message.split('/').pop()}</p>
                  )}
                  {state.progress == null ? (
                    <div className="indeterminate">
                      <span />
                    </div>
                  ) : (
                    <progress value={state.progress} max="1">
                      {Math.round(state.progress * 100)}%
                    </progress>
                  )}
                  <button className="secondary-button" type="button" onClick={cancel}>
                    {t.cancel}
                  </button>
                </div>
              )}

              {(state.stage === 'complete' || (segments.length > 0 && state.stage === 'error')) && (
                <div className="result-panel" aria-live="polite">
                  <div className="success-icon" aria-hidden="true">
                    ✓
                  </div>
                  <h2>{t.ready}</h2>
                  <p className="output-name">{downloadName}</p>
                  <div className="result-actions">
                    <button className="primary-button" type="button" onClick={download}>
                      {t.download}
                    </button>
                    <button className="secondary-button" type="button" onClick={reset}>
                      {t.another}
                    </button>
                  </div>
                  {translationFailed && (
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => void retryTranslation()}
                    >
                      {t.retryTranslation}
                    </button>
                  )}
                  <details className="preview" open>
                    <summary>{t.preview}</summary>
                    <div className="segments">
                      {segments.map((segment, index) => (
                        <article className="segment" key={segment.id}>
                          <time>
                            {formatDuration(segment.start)} → {formatDuration(segment.end)}
                          </time>
                          <label>
                            <span className="sr-only">Texto original, segmento {index + 1}</span>
                            <textarea
                              value={segment.text}
                              onChange={(event) =>
                                setSegments((current) =>
                                  current.map((item) =>
                                    item.id === segment.id
                                      ? { ...item, text: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </label>
                          {outputMode !== 'original' && (
                            <label>
                              <span className="sr-only">Traducción, segmento {index + 1}</span>
                              <textarea
                                lang="es"
                                value={segment.translatedText ?? ''}
                                onChange={(event) =>
                                  setSegments((current) =>
                                    current.map((item) =>
                                      item.id === segment.id
                                        ? { ...item, translatedText: event.target.value }
                                        : item,
                                    ),
                                  )
                                }
                              />
                            </label>
                          )}
                        </article>
                      ))}
                    </div>
                  </details>
                </div>
              )}

              {errorMessage && (
                <div className="notice error" role="alert">
                  {errorMessage}
                </div>
              )}
              {state.stage === 'cancelled' && (
                <div className="notice" role="status">
                  {t.stages.cancelled}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="trust-grid" aria-label="Características">
          <article>
            <span aria-hidden="true">◇</span>
            <h3>100% local</h3>
            <p>El contenido multimedia nunca sale del navegador.</p>
          </article>
          <article>
            <span aria-hidden="true">◴</span>
            <h3>Sin esperas de subida</h3>
            <p>Empieza directamente desde el archivo en tu dispositivo.</p>
          </article>
          <article>
            <span aria-hidden="true">⌁</span>
            <h3>Funciona sin cuenta</h3>
            <p>Sin registro, historial remoto ni seguimiento.</p>
          </article>
        </section>

        <section className="device-card" aria-labelledby="device-title">
          <div>
            <p className="eyebrow">Diagnóstico local</p>
            <h2 id="device-title">Preparado para tu dispositivo</h2>
            <p>
              {capabilities
                ? `${capabilities.hardwareConcurrency ?? '—'} núcleos · ${capabilities.deviceMemoryGb ? `${capabilities.deviceMemoryGb} GB aprox.` : 'memoria no expuesta'} · ${capabilities.webgpu ? 'WebGPU' : 'WASM/CPU'}`
                : 'Comprobando capacidades…'}
            </p>
            <p className="battery-note">{t.battery}</p>
          </div>
          <div className="cache-box">
            <strong>{t.models}</strong>
            <span>
              {cacheSummary.entries
                ? `${cacheSummary.entries} archivos${cacheSummary.bytes != null ? ` · ${formatBytes(cacheSummary.bytes)}` : ''}`
                : t.noCachedModels}
            </span>
            {cacheSummary.entries > 0 && (
              <button
                className="text-button"
                type="button"
                onClick={() =>
                  void clearModelCache().then(() => setCacheSummary({ entries: 0, bytes: 0 }))
                }
              >
                {t.clearModels}
              </button>
            )}
          </div>
        </section>
      </main>

      <footer>
        <span>SubGen · código abierto</span>
        <span>Privacidad por diseño · Sin analítica</span>
      </footer>
    </div>
  );
}
