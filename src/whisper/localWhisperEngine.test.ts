import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '@huggingface/transformers';
import {
  clearCachedWhisperPipeline,
  deleteInstalledWhisperModel,
  GGML_UNSUPPORTED_ERROR,
  importLocalWhisperFiles,
  transcribeAudioClipLocally,
  WHISPER_MODEL_SPECS,
} from './localWhisperEngine';

const BASE_SPEC = WHISPER_MODEL_SPECS['whisper-base'];
const CACHE_BUNDLE_DIR = '/tmp/whisper-base-bundle';

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

function makeFileLike(
  name: string,
  buffer: ArrayBuffer
): { name: string; arrayBuffer: () => Promise<ArrayBuffer> } {
  return {
    name,
    arrayBuffer: async () => buffer,
  };
}

test('1. Rejects GGML .bin model files with explicit ONNX incompatibility message', async () => {
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

test('2. Rejects incomplete ONNX model bundles missing companion config/tokenizer files', async () => {
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

test('3. Rejects English-only (.en) Whisper models and corrupt ONNX files', async () => {
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

test('4. Throws error when transcribing without a verified model — never returns hardcoded text', async () => {
  await deleteInstalledWhisperModel('whisper-base');

  const enWav = fs.readFileSync(
    path.resolve(process.cwd(), 'src/whisper/fixtures/sample_en.wav')
  );

  await assert.rejects(
    async () => {
      await transcribeAudioClipLocally(
        enWav.buffer.slice(enWav.byteOffset, enWav.byteOffset + enWav.byteLength),
        'en'
      );
    },
    (err: Error) => {
      assert.match(err.message, /No verified local ONNX Whisper model is installed/i);
      return true;
    }
  );
});
