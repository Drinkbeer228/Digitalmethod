/**
 * Client-side photo compression for Before / After session photos.
 * Runs 100% offline in the browser: decode → resize (max side) → JPEG re-encode.
 * JPEG is used (not WebP) because pdf-lib can embed JPEG directly into the A4 report.
 */

export const PHOTO_MAX_SIDE = 1600;
export const PHOTO_JPEG_QUALITY = 0.8;
export const PHOTO_RETRY_QUALITY = 0.7;
export const PHOTO_SOFT_LIMIT_BYTES = 900 * 1024;

export interface CompressedPhoto {
  blob: Blob;
  width: number;
  height: number;
  mimeType: 'image/jpeg';
}

/**
 * Computes target dimensions that fit within `maxSide` while keeping aspect ratio.
 * Never upscales small images.
 */
export function computeTargetSize(
  width: number,
  height: number,
  maxSide: number = PHOTO_MAX_SIDE
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Invalid image dimensions');
  }
  const longest = Math.max(width, height);
  if (longest <= maxSide) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

type DecodedImage = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function decodeImage(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // Fall through to <img> decoding (older Safari)
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image could not be decoded'));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

async function encodeJpeg(
  decoded: DecodedImage,
  width: number,
  height: number,
  quality: number
): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(decoded.source, 0, 0, width, height);
      return canvas.convertToBlob({ type: 'image/jpeg', quality });
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(decoded.source, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
  );
  if (!blob) throw new Error('JPEG encoding failed');
  return blob;
}

/**
 * Compresses a camera/gallery photo to a JPEG no larger than `maxSide` px on its longest side.
 * Retries once at lower quality if the result is still above the soft size limit.
 */
export async function compressImageFile(
  file: Blob,
  options: { maxSide?: number; quality?: number } = {}
): Promise<CompressedPhoto> {
  const maxSide = options.maxSide ?? PHOTO_MAX_SIDE;
  const quality = options.quality ?? PHOTO_JPEG_QUALITY;
  const decoded = await decodeImage(file);
  try {
    const { width, height } = computeTargetSize(decoded.width, decoded.height, maxSide);
    let blob = await encodeJpeg(decoded, width, height, quality);
    if (blob.size > PHOTO_SOFT_LIMIT_BYTES && quality > PHOTO_RETRY_QUALITY) {
      blob = await encodeJpeg(decoded, width, height, PHOTO_RETRY_QUALITY);
    }
    return { blob, width, height, mimeType: 'image/jpeg' };
  } finally {
    decoded.close();
  }
}
