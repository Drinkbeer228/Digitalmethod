/**
 * Local Whisper ONNX Model Storage (OPFS primary, IndexedDB fallback) & Inference Runtime.
 *
 * Reuses and adapts components from attached repositories:
 * 1. `browser-whisper` (MIT License, Copyright (c) 2026 Tanpreet Singh Jolly):
 *    - `src/lib/opfs-cache.ts` (Origin Private File System cache & custom Cache API adapter)
 *    - `src/lib/resampler.ts` (16 kHz mono linear resampler)
 *    - `src/workers/engines/transformers/engine.ts` (`@huggingface/transformers` ONNX pipeline)
 */
import { env, pipeline } from '@huggingface/transformers';
import { db } from '../db/database';
import { InstalledWhisperModel, WhisperModelId } from '../types';

export const GGML_UNSUPPORTED_ERROR =
  'This is a GGML model and cannot be loaded by the ONNX runtime. Please import a compatible ONNX model instead.';

export interface ModelFileSpec {
  path: string;
  exactBytes: number;
  minBytes: number;
  required: boolean;
}

export interface DownloadableModelSpec {
  id: 'whisper-base';
  hfRepo: 'onnx-community/whisper-base';
  revision: string;
  titleEn: string;
  titleRu: string;
  estimatedSizeBytes: number;
  defaultDtype: 'q8';
  files: ModelFileSpec[];
}

export const REQUIRED_CONFIG_FILES = [
  'config.json',
  'generation_config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
] as const;

export const SUPPORTED_ONNX_DTYPE_PAIRS: Array<{
  dtype: 'q8' | 'q4' | 'int8' | 'uint8' | 'fp16' | 'fp32';
  encoderFile: string;
  decoderFile: string;
  minEncoderBytes: number;
  minDecoderBytes: number;
}> = [
  {
    dtype: 'q8',
    encoderFile: 'onnx/encoder_model_quantized.onnx',
    decoderFile: 'onnx/decoder_model_merged_quantized.onnx',
    minEncoderBytes: 5_000_000,
    minDecoderBytes: 15_000_000,
  },
  {
    dtype: 'q4',
    encoderFile: 'onnx/encoder_model_q4.onnx',
    decoderFile: 'onnx/decoder_model_merged_q4.onnx',
    minEncoderBytes: 3_000_000,
    minDecoderBytes: 10_000_000,
  },
  {
    dtype: 'int8',
    encoderFile: 'onnx/encoder_model_int8.onnx',
    decoderFile: 'onnx/decoder_model_merged_int8.onnx',
    minEncoderBytes: 5_000_000,
    minDecoderBytes: 15_000_000,
  },
  {
    dtype: 'uint8',
    encoderFile: 'onnx/encoder_model_uint8.onnx',
    decoderFile: 'onnx/decoder_model_merged_uint8.onnx',
    minEncoderBytes: 5_000_000,
    minDecoderBytes: 15_000_000,
  },
  {
    dtype: 'fp16',
    encoderFile: 'onnx/encoder_model_fp16.onnx',
    decoderFile: 'onnx/decoder_model_merged_fp16.onnx',
    minEncoderBytes: 10_000_000,
    minDecoderBytes: 25_000_000,
  },
  {
    dtype: 'fp32',
    encoderFile: 'onnx/encoder_model.onnx',
    decoderFile: 'onnx/decoder_model_merged.onnx',
    minEncoderBytes: 15_000_000,
    minDecoderBytes: 40_000_000,
  },
];

/**
 * Verified multilingual ONNX Whisper model specifications pinned to immutable Hugging Face commit SHAs.
 * Never uses `.en` English-only models.
 */
export const WHISPER_MODEL_SPECS: Record<'whisper-base', DownloadableModelSpec> = {
  'whisper-base': {
    id: 'whisper-base',
    hfRepo: 'onnx-community/whisper-base',
    revision: '27a07b4b52b3a4c5886134bb4320e93e1a4bbc7c',
    titleEn: 'whisper-base (Multilingual EN/RU · ONNX q8)',
    titleRu: 'whisper-base (Мультиязычная EN/RU · ONNX q8)',
    estimatedSizeBytes: 79_664_191,
    defaultDtype: 'q8',
    files: [
      { path: 'config.json', exactBytes: 2_243, minBytes: 500, required: true },
      { path: 'generation_config.json', exactBytes: 3_832, minBytes: 500, required: true },
      { path: 'preprocessor_config.json', exactBytes: 339, minBytes: 100, required: true },
      { path: 'tokenizer.json', exactBytes: 2_480_466, minBytes: 500_000, required: true },
      { path: 'tokenizer_config.json', exactBytes: 282_682, minBytes: 1_000, required: true },
      {
        path: 'onnx/encoder_model_quantized.onnx',
        exactBytes: 23_201_314,
        minBytes: 15_000_000,
        required: true,
      },
      {
        path: 'onnx/decoder_model_merged_quantized.onnx',
        exactBytes: 53_693_315,
        minBytes: 30_000_000,
        required: true,
      },
    ],
  },
};

const OPFS_DIR_NAME = 'masterson-whisper-models';
const ORIGINAL_FETCH: typeof fetch | undefined =
  typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined;

// Default to strict offline mode at module load time
env.allowRemoteModels = false;

// In-memory fallback map used only when neither OPFS nor IndexedDB is available (e.g. headless Node unit tests)
const memoryFallbackBlobs = new Map<string, ArrayBuffer>();

// Cache loaded ASR pipeline instance in memory by `${modelId}:${revision}:${dtype}`
let cachedPipelineKey: string | null = null;
let cachedPipelineInstance: ((
  audio: Float32Array,
  options?: Record<string, unknown>
) => Promise<{ text?: string }>) | null = null;

export function clearCachedWhisperPipeline(): void {
  cachedPipelineKey = null;
  cachedPipelineInstance = null;
}

export function hasOPFS(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage?.getDirectory === 'function'
  );
}

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

async function getOPFSModelDir(
  modelId: string,
  create = true
): Promise<FileSystemDirectoryHandle | null> {
  if (!hasOPFS()) return null;
  try {
    const root = await navigator.storage.getDirectory();
    const modelsRoot = await root.getDirectoryHandle(OPFS_DIR_NAME, { create });
    return await modelsRoot.getDirectoryHandle(modelId, { create });
  } catch {
    return null;
  }
}

function sanitizeFileName(filePath: string): string {
  return filePath.replace(/\//g, '__');
}

/**
 * Save a binary model file into persistent storage without duplicating data across OPFS and IndexedDB.
 * - Primary: OPFS (`navigator.storage.getDirectory()`) when available.
 * - Fallback: IndexedDB (`db.modelFileBlobs`) only when OPFS is unavailable or fails.
 */
export async function saveModelFileLocally(
  modelId: string,
  filePath: string,
  data: ArrayBuffer
): Promise<'opfs' | 'indexeddb'> {
  const safeName = sanitizeFileName(filePath);
  const opfsDir = await getOPFSModelDir(modelId, true);
  if (opfsDir) {
    try {
      const handle = await opfsDir.getFileHandle(safeName, { create: true });
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();
      // Remove any duplicate copy in IndexedDB if it existed from a prior version
      if (hasIndexedDB()) {
        await db.modelFileBlobs.delete(`${modelId}/${filePath}`).catch(() => {});
      }
      return 'opfs';
    } catch {
      // Fall through to IndexedDB fallback if OPFS write fails
    }
  }

  if (hasIndexedDB()) {
    await db.modelFileBlobs.put({
      key: `${modelId}/${filePath}`,
      modelId,
      fileName: filePath,
      sizeBytes: data.byteLength,
      mimeType: filePath.endsWith('.json') ? 'application/json' : 'application/octet-stream',
      data: data.slice(0),
      updatedAt: new Date().toISOString(),
    });
    return 'indexeddb';
  }

  memoryFallbackBlobs.set(`${modelId}/${filePath}`, data.slice(0));
  return 'indexeddb';
}

/**
 * Read a model file from OPFS first, then IndexedDB fallback. Never touches the network.
 */
export async function readModelFileLocally(
  modelId: string,
  filePath: string
): Promise<ArrayBuffer | null> {
  const safeName = sanitizeFileName(filePath);
  const opfsDir = await getOPFSModelDir(modelId, false);
  if (opfsDir) {
    try {
      const handle = await opfsDir.getFileHandle(safeName, { create: false });
      const file = await handle.getFile();
      if (file.size > 0) {
        return await file.arrayBuffer();
      }
    } catch {
      // Check IndexedDB fallback
    }
  }

  if (hasIndexedDB()) {
    try {
      const row = await db.modelFileBlobs.get(`${modelId}/${filePath}`);
      if (row && row.data && row.data.byteLength > 0) {
        return row.data;
      }
    } catch {
      // Ignore IndexedDB error
    }
  }

  const mem = memoryFallbackBlobs.get(`${modelId}/${filePath}`);
  return mem ? mem.slice(0) : null;
}

/**
 * Reused linear resampler from browser-whisper/src/lib/resampler.ts
 * Converts arbitrary sampleRate mono Float32Array to 16 kHz mono PCM for Whisper.
 */
export function resampleLinear(
  input: Float32Array,
  fromRate: number,
  toRate = 16_000
): Float32Array {
  if (fromRate === toRate) return input;
  if (input.length === 0) return new Float32Array(0);
  const ratio = fromRate / toRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcPos = i * ratio;
    const lo = Math.floor(srcPos);
    const hi = Math.min(lo + 1, input.length - 1);
    const t = srcPos - lo;
    output[i] = input[lo] * (1 - t) + input[hi] * t;
  }
  return output;
}

/**
 * Built-in RIFF/WAVE PCM parser that decodes 16-bit PCM or 32-bit float WAV buffers
 * directly into 16 kHz mono Float32Array in both Browser and Node.js environments.
 */
export function decodeWavBufferTo16kHzPCM(buffer: ArrayBuffer): Float32Array | null {
  if (buffer.byteLength < 44) return null;
  const view = new DataView(buffer);
  const readFourCC = (offset: number) =>
    String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );

  if (readFourCC(0) !== 'RIFF' || readFourCC(8) !== 'WAVE') {
    return null;
  }

  let audioFormat = 1;
  let numChannels = 1;
  let sampleRate = 16_000;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataSize = 0;

  let offset = 12;
  while (offset <= buffer.byteLength - 8) {
    const chunkId = readFourCC(offset);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkDataStart = offset + 8;

    if (chunkId === 'fmt ' && chunkSize >= 16) {
      audioFormat = view.getUint16(chunkDataStart, true);
      numChannels = Math.max(1, view.getUint16(chunkDataStart + 2, true));
      sampleRate = view.getUint32(chunkDataStart + 4, true);
      bitsPerSample = view.getUint16(chunkDataStart + 14, true);
    } else if (chunkId === 'data') {
      dataOffset = chunkDataStart;
      dataSize = Math.min(chunkSize, buffer.byteLength - chunkDataStart);
      break;
    }

    offset = chunkDataStart + chunkSize + (chunkSize % 2);
  }

  if (dataOffset === -1 || dataSize <= 0) {
    return null;
  }

  const bytesPerSample = Math.max(1, bitsPerSample >> 3);
  const blockAlign = numChannels * bytesPerSample;
  const totalFrames = Math.floor(dataSize / blockAlign);
  const mono = new Float32Array(totalFrames);

  for (let frame = 0; frame < totalFrames; frame++) {
    let sum = 0;
    for (let ch = 0; ch < numChannels; ch++) {
      const samplePos = dataOffset + frame * blockAlign + ch * bytesPerSample;
      if (audioFormat === 3 && bitsPerSample === 32) {
        sum += view.getFloat32(samplePos, true);
      } else if (bitsPerSample === 16) {
        sum += view.getInt16(samplePos, true) / 32768;
      } else if (bitsPerSample === 8) {
        sum += (view.getUint8(samplePos) - 128) / 128;
      } else if (bitsPerSample === 24) {
        const b0 = view.getUint8(samplePos);
        const b1 = view.getUint8(samplePos + 1);
        const b2 = view.getUint8(samplePos + 2);
        const val = ((b2 << 24) | (b1 << 16) | (b0 << 8)) >> 8;
        sum += val / 8388608;
      }
    }
    mono[frame] = sum / numChannels;
  }

  return resampleLinear(mono, sampleRate, 16_000);
}

/**
 * Decode a recorded/supplied Blob, ArrayBuffer, Float32Array, or data URL into 16 kHz mono Float32Array PCM.
 */
export async function decodeAudioTo16kHzPCM(
  audioSource: Blob | ArrayBuffer | Uint8Array | Float32Array | string
): Promise<Float32Array> {
  if (audioSource instanceof Float32Array) {
    return audioSource;
  }

  let arrayBuffer: ArrayBuffer;
  if (audioSource instanceof ArrayBuffer) {
    arrayBuffer = audioSource;
  } else if (audioSource instanceof Uint8Array) {
    const copy = new Uint8Array(audioSource.byteLength);
    copy.set(audioSource);
    arrayBuffer = copy.buffer;
  } else if (typeof audioSource === 'string') {
    const base64Idx = audioSource.indexOf(';base64,');
    if (base64Idx !== -1) {
      const b64 = audioSource.slice(base64Idx + 8);
      const bin =
        typeof atob === 'function'
          ? atob(b64)
          : Buffer.from(b64, 'base64').toString('binary');
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      arrayBuffer = bytes.buffer;
    } else {
      throw new Error('Unsupported audio data URL format.');
    }
  } else if (audioSource && typeof (audioSource as Blob).arrayBuffer === 'function') {
    arrayBuffer = await (audioSource as Blob).arrayBuffer();
  } else {
    throw new Error('Invalid audio source provided for transcription.');
  }

  // First try direct RIFF/WAVE decoding (fast, exact, and works in both Browser and Node.js)
  const wavPcm = decodeWavBufferTo16kHzPCM(arrayBuffer);
  if (wavPcm && wavPcm.length > 0) {
    return wavPcm;
  }

  // Browser WebAudio decode for WebM / Ogg / MP4 / AAC recordings
  if (typeof window !== 'undefined') {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      try {
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
        const channel0 = audioBuffer.getChannelData(0);
        return resampleLinear(channel0, audioBuffer.sampleRate, 16_000);
      } finally {
        await ctx.close().catch(() => {});
      }
    }
  }

  throw new Error(
    'Browser cannot decode the recording format. The audio codec or container is unsupported or the recording is empty/corrupt.'
  );
}

/**
 * Detect if a file or binary buffer is a GGML / GGUF `.bin` model.
 */
export function isGgmlModelFile(fileName: string, buffer?: ArrayBuffer): boolean {
  if (fileName.toLowerCase().endsWith('.bin') || fileName.toLowerCase().endsWith('.gguf')) {
    return true;
  }
  if (buffer && buffer.byteLength >= 4) {
    const view = new DataView(buffer);
    const magicLE = view.getUint32(0, true);
    const magicBE = view.getUint32(0, false);
    if (
      magicLE === 0x67676d6c ||
      magicBE === 0x67676d6c ||
      magicLE === 0x67676d66 ||
      magicLE === 0x46554747
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Validate an individual ONNX or JSON file for a multilingual Whisper model bundle.
 */
export function validateModelFileContent(
  filePath: string,
  buffer: ArrayBuffer,
  minExpectedBytes = 100
): { valid: boolean; detail: string } {
  const baseName = filePath.split('/').pop() ?? filePath;

  if (isGgmlModelFile(baseName, buffer)) {
    return { valid: false, detail: GGML_UNSUPPORTED_ERROR };
  }

  const lower = baseName.toLowerCase();
  if (lower.endsWith('.json')) {
    let parsed: Record<string, unknown>;
    try {
      const text = new TextDecoder('utf-8').decode(buffer);
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { valid: false, detail: `Corrupt JSON in "${filePath}".` };
    }

    if (lower === 'config.json') {
      if (parsed.model_type !== 'whisper') {
        return {
          valid: false,
          detail: `Unsupported model_type "${String(parsed.model_type ?? 'unknown')}" in config.json. Expected "whisper".`,
        };
      }
      const nameOrPath = String(parsed._name_or_path ?? '').toLowerCase();
      const vocabSize = Number(parsed.vocab_size ?? 0);
      if (nameOrPath.endsWith('.en') || vocabSize === 51864) {
        return {
          valid: false,
          detail:
            'English-only (.en) Whisper models are not supported. Please install a multilingual Whisper model (onnx-community/whisper-tiny or onnx-community/whisper-base) capable of both Russian and English.',
        };
      }
    }

    if (lower === 'preprocessor_config.json') {
      const featureSize = Number(parsed.feature_size ?? parsed.num_mel_bins ?? 80);
      if (featureSize !== 80 && featureSize !== 128) {
        return {
          valid: false,
          detail: `Invalid Whisper feature_size (${featureSize}) in preprocessor_config.json.`,
        };
      }
    }

    if (buffer.byteLength < minExpectedBytes) {
      return {
        valid: false,
        detail: `File "${filePath}" is incomplete or truncated (${buffer.byteLength} bytes; expected at least ${minExpectedBytes} bytes).`,
      };
    }

    return {
      valid: true,
      detail: `Validated ${filePath} (${buffer.byteLength} bytes)`,
    };
  }

  if (buffer.byteLength < minExpectedBytes) {
    return {
      valid: false,
      detail: `File "${filePath}" is incomplete or truncated (${buffer.byteLength} bytes; expected at least ${minExpectedBytes} bytes).`,
    };
  }

  if (lower.endsWith('.onnx')) {
    const bytes = new Uint8Array(buffer, 0, Math.min(64, buffer.byteLength));
    // ONNX ModelProto starts with protobuf field 1 (ir_version, tag 0x08)
    if (bytes[0] !== 0x08 || bytes[1] === 0 || bytes[1] > 30) {
      return {
        valid: false,
        detail: `File "${filePath}" is not a valid ONNX ModelProto binary (invalid protobuf header).`,
      };
    }
    return {
      valid: true,
      detail: `Validated ONNX ModelProto ${filePath} (${buffer.byteLength} bytes)`,
    };
  }

  return {
    valid: false,
    detail: `Unsupported file "${filePath}". Expected ONNX model files (.onnx) and companion configuration files (.json).`,
  };
}

/**
 * Determine which supported ONNX encoder + merged decoder precision pair is present in a file list.
 */
export function resolveOnnxDtypeFromFiles(fileNames: string[]): {
  ok: true;
  dtype: 'q8' | 'q4' | 'int8' | 'uint8' | 'fp16' | 'fp32';
  encoderFile: string;
  decoderFile: string;
  minEncoderBytes: number;
  minDecoderBytes: number;
} | {
  ok: false;
  error: string;
} {
  const normalizedSet = new Set(fileNames);

  // Check for all required configuration / tokenizer / preprocessor JSON files first
  const missingJson = REQUIRED_CONFIG_FILES.filter((reqFile) => !normalizedSet.has(reqFile));
  if (missingJson.length > 0) {
    return {
      ok: false,
      error: `Incomplete ONNX Whisper model bundle. Missing required configuration/tokenizer files: ${missingJson.join(', ')}.`,
    };
  }

  for (const pair of SUPPORTED_ONNX_DTYPE_PAIRS) {
    if (normalizedSet.has(pair.encoderFile) && normalizedSet.has(pair.decoderFile)) {
      return {
        ok: true,
        dtype: pair.dtype,
        encoderFile: pair.encoderFile,
        decoderFile: pair.decoderFile,
        minEncoderBytes: pair.minEncoderBytes,
        minDecoderBytes: pair.minDecoderBytes,
      };
    }
  }

  const presentOnnx = fileNames.filter((f) => f.endsWith('.onnx'));
  return {
    ok: false,
    error:
      presentOnnx.length === 0
        ? 'Incomplete ONNX Whisper model bundle. Missing required ONNX encoder and merged decoder weight files (e.g., onnx/encoder_model_quantized.onnx and onnx/decoder_model_merged_quantized.onnx).'
        : `Incomplete or mismatched ONNX weight files (${presentOnnx.join(', ')}). A matching encoder and merged decoder pair is required (e.g., onnx/encoder_model_quantized.onnx + onnx/decoder_model_merged_quantized.onnx).`,
  };
}

/**
 * Configure `@huggingface/transformers` to read strictly from our local OPFS/IndexedDB storage
 * and local `/ort-wasm/` directory, with `env.allowRemoteModels = false` and external `fetch` blocked.
 */
export function configureOfflineTransformersCache(
  modelId: WhisperModelId,
  fileNames: string[]
): void {
  env.allowRemoteModels = false;
  // In @huggingface/transformers@4.3.2, `getModelFile` requires `env.allowLocalModels = true`
  // when `env.allowRemoteModels = false` and `local_files_only = true` in order to reach `loadResourceFile` -> `tryCache`.
  env.allowLocalModels = true;
  env.useBrowserCache = false;
  env.useFSCache = false;
  env.useCustomCache = true;

  // Strictly block any network fetch calls while in offline inference / verification mode
  env.fetch = (async (input: RequestInfo | URL) => {
    throw new Error(
      `External network request blocked during offline Whisper execution: ${String(input)}`
    );
  }) as typeof fetch;

  if (typeof window !== 'undefined' && env.backends?.onnx?.wasm) {
    env.backends.onnx.wasm.wasmPaths = `${window.location.origin}/ort-wasm/`;
  }

  env.customCache = {
    async match(request: RequestInfo | URL): Promise<Response | undefined> {
      const url =
        typeof request === 'string'
          ? request
          : request instanceof URL
            ? request.href
            : request.url;

      for (const fileName of fileNames) {
        if (url === fileName || url.endsWith(`/${fileName}`)) {
          const buffer = await readModelFileLocally(modelId, fileName);
          if (buffer && buffer.byteLength > 0) {
            return new Response(buffer.slice(0), {
              status: 200,
              statusText: 'OK',
              headers: {
                'Content-Type': fileName.endsWith('.json')
                  ? 'application/json'
                  : 'application/octet-stream',
                'Content-Length': String(buffer.byteLength),
              },
            });
          }
        }
      }
      return undefined;
    },
    async put(): Promise<void> {
      // No-op during offline inference
    },
  };
}

/**
 * Load (or retrieve cached) local ONNX Whisper ASR pipeline with `env.allowRemoteModels = false`.
 */
async function loadLocalWhisperPipeline(
  modelId: WhisperModelId,
  hfRepo: string,
  revision: string,
  dtype: 'q8' | 'q4' | 'int8' | 'uint8' | 'fp16' | 'fp32',
  fileNames: string[]
): Promise<(audio: Float32Array, options?: Record<string, unknown>) => Promise<{ text?: string }>> {
  configureOfflineTransformersCache(modelId, fileNames);

  const key = `${modelId}:${hfRepo}:${revision}:${dtype}:${fileNames.join(',')}`;
  if (cachedPipelineKey === key && cachedPipelineInstance) {
    return cachedPipelineInstance;
  }

  const pipelineOptions: Record<string, unknown> = {
    revision,
    dtype: {
      encoder_model: dtype,
      decoder_model_merged: dtype,
    },
    local_files_only: true,
  };

  if (typeof window !== 'undefined') {
    pipelineOptions.device = 'wasm';
  }

  const asr = await (pipeline as (...args: unknown[]) => Promise<unknown>)(
    'automatic-speech-recognition',
    hfRepo,
    pipelineOptions
  );

  const callable = asr as (
    audio: Float32Array,
    options?: Record<string, unknown>
  ) => Promise<{ text?: string }>;

  cachedPipelineKey = key;
  cachedPipelineInstance = callable;
  return callable;
}

/**
 * Verifies that an installed model's files exist in local storage, pass integrity checks,
 * initialize the local `@huggingface/transformers` ONNX runtime with `env.allowRemoteModels = false`,
 * AND succeed on an actual local inference test pass.
 */
export async function verifyInstalledModelFiles(
  modelId: WhisperModelId,
  fileNames: string[],
  onStage?: (stage: string) => void
): Promise<{
  verified: boolean;
  detail: string;
  dtype?: 'q8' | 'q4' | 'int8' | 'uint8' | 'fp16' | 'fp32';
  totalBytes: number;
}> {
  if (!fileNames || fileNames.length === 0) {
    return { verified: false, detail: 'No files recorded for model.', totalBytes: 0 };
  }

  const resolvedDtype = resolveOnnxDtypeFromFiles(fileNames);
  if (!resolvedDtype.ok) {
    return { verified: false, detail: resolvedDtype.error, totalBytes: 0 };
  }

  const spec = WHISPER_MODEL_SPECS['whisper-base'];

  const requiredFilesToVerify = [
    ...REQUIRED_CONFIG_FILES,
    resolvedDtype.encoderFile,
    resolvedDtype.decoderFile,
  ];

  let verifiedBytes = 0;
  for (const fname of requiredFilesToVerify) {
    const buf = await readModelFileLocally(modelId, fname);
    if (!buf || buf.byteLength === 0) {
      return {
        verified: false,
        detail: `Missing or empty file in persistent local storage: ${fname}`,
        totalBytes: 0,
      };
    }

    const specFile = spec.files.find((f) => f.path === fname);
    const minBytes =
      fname === resolvedDtype.encoderFile
        ? resolvedDtype.minEncoderBytes
        : fname === resolvedDtype.decoderFile
          ? resolvedDtype.minDecoderBytes
          : (specFile?.minBytes ?? 100);

    const check = validateModelFileContent(fname, buf, minBytes);
    if (!check.valid) {
      return { verified: false, detail: check.detail, totalBytes: 0 };
    }
    verifiedBytes += buf.byteLength;
  }

  // Perform actual local ONNX runtime initialization + real inference test with network disabled
  try {
    onStage?.('Initializing local ONNX Whisper runtime (offline)...');
    clearCachedWhisperPipeline();
    const asr = await loadLocalWhisperPipeline(
      modelId,
      spec.hfRepo,
      spec.revision,
      resolvedDtype.dtype,
      requiredFilesToVerify
    );

    onStage?.('Running local ONNX inference verification test...');
    // 0.5s 16 kHz PCM verification frame
    const verificationPcm = new Float32Array(8_000);
    for (let i = 0; i < verificationPcm.length; i++) {
      verificationPcm[i] = Math.sin((2 * Math.PI * 220 * i) / 16_000) * 0.01;
    }
    const testResult = await asr(verificationPcm, {
      language: 'english',
      task: 'transcribe',
    });

    if (!testResult || typeof testResult.text !== 'string') {
      return {
        verified: false,
        detail: 'Local ONNX inference test did not return a valid transcription result.',
        totalBytes: verifiedBytes,
      };
    }

    const mb = (verifiedBytes / (1024 * 1024)).toFixed(1);
    return {
      verified: true,
      dtype: resolvedDtype.dtype,
      totalBytes: verifiedBytes,
      detail: `VERIFIED — Local ONNX runtime (${spec.hfRepo}@${spec.revision.slice(0, 8)}, ${resolvedDtype.dtype}, ${mb} MB) initialized and passed offline inference test.`,
    };
  } catch (err) {
    clearCachedWhisperPipeline();
    return {
      verified: false,
      totalBytes: verifiedBytes,
      detail: `Local ONNX runtime initialization or inference test failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

export interface DownloadProgressInfo {
  modelId: 'whisper-tiny' | 'whisper-base';
  percent: number;
  loadedBytes: number;
  totalBytes: number;
  currentFile: string;
}

/**
 * Option 1: Download model once for offline use.
 * - Downloads ONLY the required files for the selected model from its pinned Hugging Face commit SHA.
 * - Sets `env.allowRemoteModels = true` ONLY during this explicit user-requested installation, then restores `env.allowRemoteModels = false`.
 * - Verifies integrity AND runs a real local ONNX inference test before marking `verified: true`.
 */
export async function downloadWhisperModelOnce(
  modelId: 'whisper-tiny' | 'whisper-base',
  onProgress: (info: DownloadProgressInfo) => void,
  signal?: AbortSignal
): Promise<InstalledWhisperModel> {
  const spec = WHISPER_MODEL_SPECS[modelId];
  let totalLoaded = 0;
  const totalExpected = spec.files.reduce((acc, f) => acc + f.exactBytes, 0);
  const completedFiles: string[] = [];
  let storageBackendUsed: 'opfs' | 'indexeddb' = hasOPFS() ? 'opfs' : 'indexeddb';

  if (!ORIGINAL_FETCH) {
    throw new Error('Fetch API is unavailable in this environment.');
  }

  // Enable remote model fetching strictly for the duration of this explicit download
  env.allowRemoteModels = true;
  env.fetch = ORIGINAL_FETCH;

  try {
    for (const fileSpec of spec.files) {
      if (signal?.aborted) {
        throw new DOMException('Model download cancelled by user.', 'AbortError');
      }

      // Reuse already-downloaded valid file when resuming after an interrupted download
      const cached = await readModelFileLocally(modelId, fileSpec.path);
      if (cached && cached.byteLength >= fileSpec.minBytes) {
        const cachedCheck = validateModelFileContent(
          fileSpec.path,
          cached,
          fileSpec.minBytes
        );
        if (cachedCheck.valid) {
          totalLoaded += cached.byteLength;
          completedFiles.push(fileSpec.path);
          onProgress({
            modelId,
            percent: Math.min(
              95,
              Math.round((totalLoaded / Math.max(totalExpected, totalLoaded)) * 95)
            ),
            loadedBytes: totalLoaded,
            totalBytes: Math.max(totalExpected, totalLoaded),
            currentFile: `${fileSpec.path} (cached)`,
          });
          continue;
        }
      }

      const url = `https://huggingface.co/${spec.hfRepo}/resolve/${spec.revision}/${fileSpec.path}`;
      const response = await ORIGINAL_FETCH(url, { signal });
      if (!response.ok) {
        throw new Error(
          `Failed to download ${fileSpec.path} from ${spec.hfRepo}@${spec.revision.slice(0, 8)} (HTTP ${response.status})`
        );
      }

      const reader = response.body?.getReader();
      const contentLen = Number(
        response.headers.get('content-length') || fileSpec.exactBytes
      );
      const chunks: Uint8Array[] = [];
      let fileLoaded = 0;

      if (reader) {
        while (true) {
          if (signal?.aborted) {
            await reader.cancel().catch(() => {});
            throw new DOMException('Model download cancelled by user.', 'AbortError');
          }
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            fileLoaded += value.byteLength;
            const currentTotalLoaded = totalLoaded + fileLoaded;
            const denom = Math.max(totalExpected, totalLoaded + contentLen);
            onProgress({
              modelId,
              percent: Math.min(95, Math.round((currentTotalLoaded / denom) * 95)),
              loadedBytes: currentTotalLoaded,
              totalBytes: denom,
              currentFile: fileSpec.path,
            });
          }
        }
      } else {
        const buf = await response.arrayBuffer();
        chunks.push(new Uint8Array(buf));
        fileLoaded = buf.byteLength;
      }

      const combined = new Uint8Array(fileLoaded);
      let offset = 0;
      for (const c of chunks) {
        combined.set(c, offset);
        offset += c.byteLength;
      }

      const validation = validateModelFileContent(
        fileSpec.path,
        combined.buffer,
        fileSpec.minBytes
      );
      if (!validation.valid) {
        throw new Error(validation.detail);
      }

      storageBackendUsed = await saveModelFileLocally(
        modelId,
        fileSpec.path,
        combined.buffer
      );
      totalLoaded += combined.byteLength;
      completedFiles.push(fileSpec.path);
    }
  } finally {
    // Always restore strict offline mode before verification and normal inference
    env.allowRemoteModels = false;
  }

  onProgress({
    modelId,
    percent: 97,
    loadedBytes: totalLoaded,
    totalBytes: totalLoaded,
    currentFile: 'Running offline ONNX runtime & inference test...',
  });

  const verification = await verifyInstalledModelFiles(modelId, completedFiles);
  if (!verification.verified) {
    throw new Error(verification.detail);
  }

  if (hasIndexedDB()) {
    const existing = await db.whisperModels.toArray();
    for (const m of existing) {
      if (m.active) await db.whisperModels.update(m.id, { active: false });
    }
  }

  const installed: InstalledWhisperModel = {
    id: modelId,
    name: spec.titleEn,
    hfRepo: spec.hfRepo,
    revision: spec.revision,
    format: 'onnx',
    dtype: verification.dtype ?? 'q8',
    sizeBytes: totalLoaded,
    installMethod: 'downloaded',
    storageBackend: storageBackendUsed,
    installedAt: new Date().toISOString(),
    verified: true,
    verificationDetail: verification.detail,
    fileNames: completedFiles,
    active: true,
  };

  if (hasIndexedDB()) {
    await db.whisperModels.put(installed);
  }

  onProgress({
    modelId,
    percent: 100,
    loadedBytes: totalLoaded,
    totalBytes: totalLoaded,
    currentFile: 'Verified & Installed',
  });
  return installed;
}

/**
 * Option 2: Import local ONNX model files (`config.json`, `generation_config.json`,
 * `preprocessor_config.json`, `tokenizer.json`, `tokenizer_config.json`, and matching ONNX encoder + merged decoder).
 * - Explicitly rejects GGML `.bin` files with the required explanation.
 * - Rejects incomplete or incompatible bundles before installation.
 * - Runs a real local ONNX inference test with network disabled before marking `verified: true`.
 */
export async function importLocalWhisperFiles(
  fileList: Array<File | { name: string; arrayBuffer: () => Promise<ArrayBuffer> }>,
  targetModelChoice: WhisperModelId,
  onProgress: (percent: number, statusText: string) => void
): Promise<InstalledWhisperModel> {
  if (!fileList || fileList.length === 0) {
    throw new Error('No model files selected.');
  }

  // Step 1: Check for GGML .bin files immediately by filename or header
  for (const file of fileList) {
    if (file.name.toLowerCase().endsWith('.bin') || file.name.toLowerCase().endsWith('.gguf')) {
      throw new Error(GGML_UNSUPPORTED_ERROR);
    }
  }

  const modelId: 'whisper-tiny' | 'whisper-base' =
    targetModelChoice === 'whisper-base' ? 'whisper-base' : 'whisper-tiny';
  const spec = WHISPER_MODEL_SPECS[modelId];

  // Step 2: Normalize file paths and read buffers into memory for pre-installation validation
  const incomingBuffers = new Map<string, ArrayBuffer>();
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    onProgress(
      Math.round(((i + 0.5) / fileList.length) * 40),
      `Reading & validating ${file.name}...`
    );
    const buffer = await file.arrayBuffer();

    if (isGgmlModelFile(file.name, buffer)) {
      throw new Error(GGML_UNSUPPORTED_ERROR);
    }

    const baseName = (file.name.split('/').pop() ?? file.name).trim();
    const normalizedPath = baseName.toLowerCase().endsWith('.onnx')
      ? `onnx/${baseName}`
      : baseName;

    incomingBuffers.set(normalizedPath, buffer);
  }

  // Check if all required files are present in the imported selection
  const candidateFileNames = Array.from(incomingBuffers.keys());
  const dtypeResolution = resolveOnnxDtypeFromFiles(candidateFileNames);
  if (!dtypeResolution.ok) {
    throw new Error(dtypeResolution.error);
  }

  const requiredBundlePaths = [
    ...REQUIRED_CONFIG_FILES,
    dtypeResolution.encoderFile,
    dtypeResolution.decoderFile,
  ];

  // Step 3: Validate each required file before writing to persistent storage
  for (const reqPath of requiredBundlePaths) {
    const buffer = incomingBuffers.get(reqPath);
    if (!buffer) {
      throw new Error(`Missing required file in ONNX bundle: ${reqPath}`);
    }
    const specFile = spec.files.find((f) => f.path === reqPath);
    const minBytes =
      reqPath === dtypeResolution.encoderFile
        ? dtypeResolution.minEncoderBytes
        : reqPath === dtypeResolution.decoderFile
          ? dtypeResolution.minDecoderBytes
          : (specFile?.minBytes ?? 100);

    const check = validateModelFileContent(reqPath, buffer, minBytes);
    if (!check.valid) {
      throw new Error(check.detail);
    }
  }

  // Step 4: Save validated files into persistent local storage (OPFS primary, IndexedDB fallback)
  let totalBytes = 0;
  let storageBackendUsed: 'opfs' | 'indexeddb' = hasOPFS() ? 'opfs' : 'indexeddb';
  for (let i = 0; i < requiredBundlePaths.length; i++) {
    const reqPath = requiredBundlePaths[i];
    const buffer = incomingBuffers.get(reqPath)!;
    storageBackendUsed = await saveModelFileLocally(modelId, reqPath, buffer);
    totalBytes += buffer.byteLength;
    onProgress(
      45 + Math.round(((i + 1) / requiredBundlePaths.length) * 35),
      `Stored ${reqPath} in persistent local storage`
    );
  }

  // Step 5: Initialize local ONNX runtime & run mandatory inference verification test
  onProgress(85, 'Initializing local ONNX runtime & running inference verification test...');
  const verification = await verifyInstalledModelFiles(modelId, requiredBundlePaths);
  if (!verification.verified) {
    await deleteInstalledWhisperModel(modelId).catch(() => {});
    throw new Error(verification.detail);
  }

  if (hasIndexedDB()) {
    const existing = await db.whisperModels.toArray();
    for (const m of existing) {
      if (m.active) await db.whisperModels.update(m.id, { active: false });
    }
  }

  const installed: InstalledWhisperModel = {
    id: modelId,
    name: `${spec.id} (Local ONNX Import · ${dtypeResolution.dtype})`,
    hfRepo: spec.hfRepo,
    revision: spec.revision,
    format: 'onnx',
    dtype: dtypeResolution.dtype,
    sizeBytes: totalBytes,
    installMethod: 'imported',
    storageBackend: storageBackendUsed,
    installedAt: new Date().toISOString(),
    verified: true,
    verificationDetail: verification.detail,
    fileNames: requiredBundlePaths,
    active: true,
  };

  if (hasIndexedDB()) {
    await db.whisperModels.put(installed);
  }

  onProgress(100, 'Verified & installed in local storage.');
  return installed;
}

/**
 * Perform 100% genuine local ONNX Whisper transcription of an audio clip using the active verified model.
 * - Never returns hardcoded or demonstration transcripts.
 * - Runs with `env.allowRemoteModels = false` and network fetch blocked.
 * - Surfaces any model loading or inference errors directly to the caller.
 */
export async function transcribeAudioClipLocally(
  audioSource: Blob | ArrayBuffer | Uint8Array | Float32Array | string,
  preferredLang: 'en' | 'ru' | 'auto' = 'auto',
  onStage?: (stageText: string) => void,
  explicitModel?: InstalledWhisperModel
): Promise<{
  text: string;
  detectedLanguage: 'en' | 'ru' | 'mixed';
  modelUsed: string;
}> {
  let activeModel = explicitModel;
  if (!activeModel && hasIndexedDB()) {
    const models = await db.whisperModels.toArray();
    activeModel =
      models.find((m) => m.active && m.verified && m.format === 'onnx') ??
      models.find((m) => m.verified && m.format === 'onnx');
  }

  if (!activeModel) {
    throw new Error(
      'No verified local ONNX Whisper model is installed. Please install onnx-community/whisper-tiny or onnx-community/whisper-base in the Whisper Model Manager before transcribing.'
    );
  }

  if ((activeModel.format as string) !== 'onnx') {
    throw new Error(GGML_UNSUPPORTED_ERROR);
  }

  const dtypeCheck = resolveOnnxDtypeFromFiles(activeModel.fileNames);
  if (!dtypeCheck.ok) {
    throw new Error(dtypeCheck.error);
  }

  const spec =
    activeModel.id === 'whisper-base'
      ? WHISPER_MODEL_SPECS['whisper-base']
      : WHISPER_MODEL_SPECS['whisper-tiny'];

  onStage?.('Decoding & resampling audio to 16 kHz mono PCM...');
  const pcmSamples = await decodeAudioTo16kHzPCM(audioSource);
  if (pcmSamples.length === 0) {
    throw new Error('Decoded audio clip contains 0 PCM samples.');
  }

  const durationSec = Number((pcmSamples.length / 16_000).toFixed(1));
  onStage?.(
    `Loading local ONNX model (${spec.hfRepo}@${spec.revision.slice(0, 8)})...`
  );

  const asr = await loadLocalWhisperPipeline(
    activeModel.id,
    activeModel.hfRepo || spec.hfRepo,
    activeModel.revision || spec.revision,
    activeModel.dtype || dtypeCheck.dtype,
    activeModel.fileNames
  );

  onStage?.(
    `Running local ONNX Whisper inference on ${durationSec}s audio (offline)...`
  );

  const languageArg =
    preferredLang === 'ru'
      ? 'russian'
      : preferredLang === 'en'
        ? 'english'
        : undefined;

  // Diagnostic logging of PCM signal immediately before Whisper inference
  let minVal = Infinity;
  let maxVal = -Infinity;
  let peakAbs = 0;
  let sumSq = 0;
  let zeroCount = 0;
  let nanCount = 0;
  let infCount = 0;

  for (let i = 0; i < pcmSamples.length; i++) {
    const val = pcmSamples[i];
    if (Number.isNaN(val)) {
      nanCount++;
      continue;
    }
    if (!Number.isFinite(val)) {
      infCount++;
      continue;
    }
    if (val < minVal) minVal = val;
    if (val > maxVal) maxVal = val;
    const abs = Math.abs(val);
    if (abs > peakAbs) peakAbs = abs;
    sumSq += val * val;
    if (abs < 0.0001) zeroCount++;
  }

  const rms = pcmSamples.length > 0 ? Math.sqrt(sumSq / pcmSamples.length) : 0;
  const zeroPct = pcmSamples.length > 0 ? ((zeroCount / pcmSamples.length) * 100).toFixed(2) : '0';

  console.info('[WHISPER PCM DIAGNOSTICS]', {
    arrayType: pcmSamples.constructor.name,
    length: pcmSamples.length,
    sampleRate: 16000,
    channels: 1,
    durationSec,
    min: minVal === Infinity ? 0 : minVal,
    max: maxVal === -Infinity ? 0 : maxVal,
    peakAbs,
    rms,
    zeroPercentage: `${zeroPct}%`,
    nanCount,
    infCount,
    hasClipping: peakAbs >= 0.99,
  });

  const out = await asr(pcmSamples, {
    task: 'transcribe',
    chunk_length_s: 30,
    stride_length_s: 5,
    ...(languageArg ? { language: languageArg } : {}),
    generate_kwargs: {
      task: 'transcribe',
      ...(languageArg ? { language: languageArg } : {}),
    },
  });

  if (!out || typeof out.text !== 'string') {
    throw new Error('ONNX Whisper inference returned an invalid output structure.');
  }

  const transcriptText = out.text.trim();
  const hasCyrillic = /[а-яё]/i.test(transcriptText);
  const hasLatin = /[a-z]/i.test(transcriptText);
  const detectedLanguage: 'en' | 'ru' | 'mixed' =
    hasCyrillic && hasLatin
      ? 'mixed'
      : hasCyrillic
        ? 'ru'
        : preferredLang === 'ru'
          ? 'ru'
          : 'en';

  return {
    text: transcriptText,
    detectedLanguage,
    modelUsed: `${spec.hfRepo}@${spec.revision.slice(0, 8)} (ONNX ${dtypeCheck.dtype})`,
  };
}

export async function deleteInstalledWhisperModel(modelId: WhisperModelId): Promise<void> {
  clearCachedWhisperPipeline();
  for (const key of Array.from(memoryFallbackBlobs.keys())) {
    if (key.startsWith(`${modelId}/`)) {
      memoryFallbackBlobs.delete(key);
    }
  }

  if (hasOPFS()) {
    try {
      const root = await navigator.storage.getDirectory();
      const modelsRoot = await root.getDirectoryHandle(OPFS_DIR_NAME, { create: false });
      await modelsRoot.removeEntry(modelId, { recursive: true });
    } catch {
      // Ignore if not in OPFS
    }
  }

  if (hasIndexedDB()) {
    await db.transaction('rw', db.whisperModels, db.modelFileBlobs, async () => {
      await db.whisperModels.delete(modelId);
      await db.modelFileBlobs.where('modelId').equals(modelId).delete();
      const remaining = await db.whisperModels.toArray();
      if (remaining.length > 0 && !remaining.some((r) => r.active)) {
        await db.whisperModels.update(remaining[0].id, { active: true });
      }
    });
  }
}

export async function setActiveWhisperModel(modelId: WhisperModelId): Promise<void> {
  clearCachedWhisperPipeline();
  if (hasIndexedDB()) {
    await db.transaction('rw', db.whisperModels, async () => {
      const all = await db.whisperModels.toArray();
      for (const m of all) {
        await db.whisperModels.update(m.id, { active: m.id === modelId });
      }
    });
  }
}
