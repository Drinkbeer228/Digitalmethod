import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '@huggingface/transformers';
import { db } from '../db/database';
import {
  clearCachedWhisperPipeline,
  deleteInstalledWhisperModel,
  GGML_UNSUPPORTED_ERROR,
  importLocalWhisperFiles,
  inspectLegacyWhisperTinyStorage,
  removeLegacyWhisperTinyStorage,
  resolveWhisperInitTokens,
  transcribeAudioClipLocally,
  WHISPER_MODEL_SPECS,
} from './localWhisperEngine';

const BASE_SPEC = WHISPER_MODEL_SPECS['whisper-base'];
const CACHE_BUNDLE_DIR = '/tmp/whisper-base-bundle';
const TEST_RU_WAV = '/tmp/test_ru.wav';
const TEST_EN_WAV = '/tmp/test_en.wav';

async function ensureBaseBundleOnDisk(): Promise<void> {
  fs.mkdirSync(path.join(CACHE_BUNDLE_DIR, 'onnx'), { recursive: true });
  for (const fileSpec of BASE_SPEC.files) {
    const dest = path.join(CACHE_BUNDLE_DIR, fileSpec.path);
    if (!fs.existsSync(dest) || fs.statSync(dest).size < fileSpec.minBytes) {
      const url = `https://huggingface.co/${BASE_SPEC.hfRepo}/resolve/${BASE_SPEC.revision}/${fileSpec.path}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch test fixture ${url}: HTTP ${res.status}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
    }
  }
}

function readNodeFileArrayBuffer(filePath: string): ArrayBuffer {
  const buf = fs.readFileSync(filePath);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function makeTestWavBuffer(durationSec = 0.5, sampleRate = 16_000): ArrayBuffer {
  const numSamples = Math.floor(durationSec * sampleRate);
  const dataBytes = numSamples * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buf);
  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);
  return buf;
}

function makeFileLike(
  name: string,
  buffer: ArrayBuffer
): { name: string; arrayBuffer: () => Promise<ArrayBuffer> } {
  return {
    name,
    arrayBuffer: async () => buffer,
  };
}

test('1. [Validation] Rejects GGML .bin model files with explicit ONNX incompatibility message', async () => {
  await deleteInstalledWhisperModel('whisper-base');

  const ggmlBuf = new ArrayBuffer(512);
  const view = new DataView(ggmlBuf);
  view.setUint32(0, 0x67676d6c, true); // 'ggml' magic header

  await assert.rejects(
    async () => {
      await importLocalWhisperFiles(
        [makeFileLike('ggml-base.bin', ggmlBuf)],
        'whisper-base',
        () => {}
      );
    },
    (err: Error) => {
      assert.equal(err.message, GGML_UNSUPPORTED_ERROR);
      return true;
    }
  );
});

test('2. [Validation] Rejects incomplete ONNX model bundles missing companion config/tokenizer files', async () => {
  const fakeOnnx = new Uint8Array(64);
  fakeOnnx[0] = 0x08;
  fakeOnnx[1] = 0x07;

  await assert.rejects(
    async () => {
      await importLocalWhisperFiles(
        [makeFileLike('encoder_model_quantized.onnx', fakeOnnx.buffer)],
        'whisper-base',
        () => {}
      );
    },
    (err: Error) => {
      assert.match(err.message, /Incomplete ONNX Whisper model bundle/i);
      assert.match(err.message, /config\.json/);
      assert.match(err.message, /tokenizer\.json/);
      return true;
    }
  );
});

test('3. [Validation] Rejects English-only (.en) Whisper models and corrupt ONNX files', async () => {
  const enOnlyConfig = new TextEncoder().encode(
    JSON.stringify({
      model_type: 'whisper',
      _name_or_path: 'openai/whisper-base.en',
      vocab_size: 51864,
    })
  );
  const emptyJson = new TextEncoder().encode(JSON.stringify({ feature_size: 80 }));
  const largeEnoughJson = new TextEncoder().encode(
    JSON.stringify({ pad: 'x'.repeat(600_000) })
  );
  const dummyOnnx = new Uint8Array(16_000_000);
  dummyOnnx[0] = 0x08;
  dummyOnnx[1] = 0x07;

  await assert.rejects(
    async () => {
      await importLocalWhisperFiles(
        [
          makeFileLike('config.json', enOnlyConfig.buffer),
          makeFileLike('generation_config.json', enOnlyConfig.buffer),
          makeFileLike('preprocessor_config.json', emptyJson.buffer),
          makeFileLike('tokenizer.json', largeEnoughJson.buffer),
          makeFileLike('tokenizer_config.json', largeEnoughJson.buffer),
          makeFileLike('encoder_model_quantized.onnx', dummyOnnx.buffer),
          makeFileLike('decoder_model_merged_quantized.onnx', dummyOnnx.buffer),
        ],
        'whisper-base',
        () => {}
      );
    },
    (err: Error) => {
      assert.match(err.message, /English-only \(\.en\) Whisper models are not supported/i);
      return true;
    }
  );
});

test('4. [Guard] Throws error when transcribing without a verified model — never returns hardcoded text', async () => {
  await deleteInstalledWhisperModel('whisper-base');
  await deleteInstalledWhisperModel('whisper-tiny');

  const wavBuf = fs.existsSync(TEST_EN_WAV)
    ? readNodeFileArrayBuffer(TEST_EN_WAV)
    : makeTestWavBuffer();

  await assert.rejects(
    async () => {
      await transcribeAudioClipLocally(wavBuf, 'en');
    },
    (err: Error) => {
      assert.match(err.message, /No verified local ONNX Whisper Base model is installed/i);
      return true;
    }
  );
});

test('5. [Config & Init Tokens] Enforces multilingual transcribe tokens (RU -> <|ru|> 50263, EN -> <|en|> 50259, never translate)', async () => {
  const mockMultilingualModel = {
    generation_config: {
      is_multilingual: true,
      decoder_start_token_id: 50258,
      no_timestamps_token_id: 50363,
      lang_to_id: {
        '<|en|>': 50259,
        '<|ru|>': 50263,
      },
      task_to_id: {
        translate: 50358,
        transcribe: 50359,
      },
    },
  };

  const ruResolved = resolveWhisperInitTokens(mockMultilingualModel, 'russian', 'transcribe');
  assert.equal(ruResolved.isMultilingual, true);
  assert.equal(ruResolved.language, 'russian');
  assert.equal(ruResolved.task, 'transcribe');
  assert.deepEqual(ruResolved.initTokens, [50258, 50263, 50359, 50363]);
  assert.equal(ruResolved.initTokens.includes(50259), false); // never <|en|>
  assert.equal(ruResolved.initTokens.includes(50358), false); // never <|translate|>

  const enResolved = resolveWhisperInitTokens(mockMultilingualModel, 'english', 'transcribe');
  assert.deepEqual(enResolved.initTokens, [50258, 50259, 50359, 50363]);

  assert.throws(() => {
    resolveWhisperInitTokens(
      {
        generation_config: {
          is_multilingual: false,
          decoder_start_token_id: 50258,
        },
      },
      'russian',
      'transcribe'
    );
  }, /English-only/i);
});

test('6. [Legacy Cleanup] Safe removal of Whisper Tiny deletes only Tiny files/rows and keeps Whisper Base active', async () => {
  await deleteInstalledWhisperModel('whisper-base');
  await deleteInstalledWhisperModel('whisper-tiny');

  // Seed legacy whisper-tiny (marked active) + whisper-base (inactive)
  await db.whisperModels.put({
    id: 'whisper-tiny' as unknown as 'whisper-base',
    name: 'whisper-tiny (Legacy)',
    hfRepo: 'onnx-community/whisper-tiny',
    revision: 'legacy',
    format: 'onnx',
    dtype: 'q8',
    sizeBytes: 1_024,
    installMethod: 'downloaded',
    storageBackend: 'indexeddb',
    installedAt: new Date().toISOString(),
    verified: true,
    verificationDetail: 'legacy',
    fileNames: ['config.json'],
    active: true,
  });
  await db.modelFileBlobs.put({
    key: 'whisper-tiny/config.json',
    modelId: 'whisper-tiny',
    fileName: 'config.json',
    sizeBytes: 1_024,
    mimeType: 'application/json',
    data: new ArrayBuffer(1_024),
    updatedAt: new Date().toISOString(),
  });

  // Confirm Tiny alone cannot be used for transcription
  await assert.rejects(
    async () => {
      await transcribeAudioClipLocally(makeTestWavBuffer(), 'ru');
    },
    /No verified local ONNX Whisper Base model is installed/i
  );

  // Now seed Whisper Base alongside legacy Tiny
  await db.whisperModels.put({
    id: 'whisper-base',
    name: BASE_SPEC.titleEn,
    hfRepo: BASE_SPEC.hfRepo,
    revision: BASE_SPEC.revision,
    format: 'onnx',
    dtype: 'q8',
    sizeBytes: 2_048,
    installMethod: 'downloaded',
    storageBackend: 'indexeddb',
    installedAt: new Date().toISOString(),
    verified: true,
    verificationDetail: 'ok',
    fileNames: ['config.json'],
    active: false,
  });
  await db.modelFileBlobs.put({
    key: 'whisper-base/config.json',
    modelId: 'whisper-base',
    fileName: 'config.json',
    sizeBytes: 2_048,
    mimeType: 'application/json',
    data: new ArrayBuffer(2_048),
    updatedAt: new Date().toISOString(),
  });

  const beforeStatus = await inspectLegacyWhisperTinyStorage();
  assert.equal(beforeStatus.hasLegacyTiny, true);
  assert.equal(beforeStatus.inDbMetadata, true);
  assert.equal(beforeStatus.inDbBlobs, true);
  assert.equal(beforeStatus.blobCount, 1);

  const removal = await removeLegacyWhisperTinyStorage();
  assert.equal(removal.removed, true);
  assert.equal(removal.freedBytes, 1_024);

  const afterStatus = await inspectLegacyWhisperTinyStorage();
  assert.equal(afterStatus.hasLegacyTiny, false);

  // Confirm whisper-tiny rows & blobs are gone, while whisper-base remains intact and became active
  assert.equal(await db.whisperModels.get('whisper-tiny'), undefined);
  assert.equal((await db.modelFileBlobs.where('modelId').equals('whisper-tiny').toArray()).length, 0);

  const baseRow = await db.whisperModels.get('whisper-base');
  assert.ok(baseRow, 'Whisper Base metadata should remain untouched');
  assert.equal(baseRow.active, true);
  const baseBlobs = await db.modelFileBlobs.where('modelId').equals('whisper-base').toArray();
  assert.equal(baseBlobs.length, 1);

  await deleteInstalledWhisperModel('whisper-base');
});

test(
  '7. [Real Offline Speech Inference] Transcribes Russian as Russian Cyrillic and English as English (both explicit & auto)',
  { timeout: 180_000 },
  async () => {
    await ensureBaseBundleOnDisk();
    clearCachedWhisperPipeline();
    await deleteInstalledWhisperModel('whisper-base');
    await deleteInstalledWhisperModel('whisper-tiny');

    const bundleFiles = BASE_SPEC.files.map((f) => {
      const fullPath = path.join(CACHE_BUNDLE_DIR, f.path);
      return makeFileLike(f.path, readNodeFileArrayBuffer(fullPath));
    });

    const installed = await importLocalWhisperFiles(
      bundleFiles,
      'whisper-base',
      () => {}
    );
    assert.equal(installed.id, 'whisper-base');
    assert.equal(installed.verified, true);
    assert.equal(env.allowRemoteModels, false);

    try {
      if (fs.existsSync(TEST_RU_WAV)) {
        const ruWav = readNodeFileArrayBuffer(TEST_RU_WAV);

        // Explicit Russian mode -> Cyrillic Russian transcript (no English translation)
        const ruExplicit = await transcribeAudioClipLocally(ruWav, 'ru');
        assert.equal(ruExplicit.detectedLanguage, 'ru');
        assert.match(ruExplicit.text, /[а-яё]/i, `Expected Cyrillic Russian text, got: ${ruExplicit.text}`);
        assert.doesNotMatch(ruExplicit.text, /\b(left|shoulder|right|gluteal)\b/i);

        // Auto mode -> acoustic Whisper language check detects RU -> Cyrillic Russian transcript
        const ruAuto = await transcribeAudioClipLocally(ruWav, 'auto');
        assert.equal(ruAuto.detectedLanguage, 'ru');
        assert.match(ruAuto.text, /[а-яё]/i, `Expected Cyrillic Russian text in auto mode, got: ${ruAuto.text}`);
        assert.doesNotMatch(ruAuto.text, /\b(left|shoulder|right|gluteal)\b/i);
      }

      if (fs.existsSync(TEST_EN_WAV)) {
        const enWav = readNodeFileArrayBuffer(TEST_EN_WAV);

        // Explicit English mode -> English transcript
        const enExplicit = await transcribeAudioClipLocally(enWav, 'en');
        assert.equal(enExplicit.detectedLanguage, 'en');
        assert.match(enExplicit.text, /shoulder|left|right/i, `Expected English transcript, got: ${enExplicit.text}`);
        assert.doesNotMatch(enExplicit.text, /[а-яё]/i);

        // Auto mode -> acoustic Whisper language check detects EN -> English transcript
        const enAuto = await transcribeAudioClipLocally(enWav, 'auto');
        assert.equal(enAuto.detectedLanguage, 'en');
        assert.match(enAuto.text, /shoulder|left|right/i, `Expected English transcript in auto mode, got: ${enAuto.text}`);
        assert.doesNotMatch(enAuto.text, /[а-яё]/i);
      }
    } finally {
      clearCachedWhisperPipeline();
      await deleteInstalledWhisperModel('whisper-base');
    }
  }
);
