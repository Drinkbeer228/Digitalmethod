import { PDFDocument, PDFFont, PDFPage, rgb, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {
  ANATOMICAL_AREAS,
  ANATOMICAL_REGIONS,
  getAreaCoordinate,
  getAreaReactionEndpoints,
  TOP_VIEW_ANCHORS,
} from '../data/anatomicalAreas';
import { TRANSLATIONS, translateStoredTaxonomyValue } from '../data/translations';
import {
  AreaSideObservation,
  BodyworkSession,
  DiagramAnnotation,
  HorseProfile,
  Language,
  Point,
  ReactionLevel,
  SessionPhoto,
  SessionPhotoKind,
} from '../types';
import { buildReportFromSession, getUnifiedSessionNotes } from './reportGenerator';
import { assetUrl } from './assetUrl';

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

const COLOR_FOREST = rgb(0x2b / 255, 0x4c / 255, 0x3f / 255);
const COLOR_CHARCOAL = rgb(0x1e / 255, 0x24 / 255, 0x21 / 255);
const COLOR_SLATE = rgb(0x47 / 255, 0x55 / 255, 0x69 / 255);
const COLOR_MUTED = rgb(0x64 / 255, 0x74 / 255, 0x8b / 255);
const COLOR_BORDER = rgb(0xcb / 255, 0xd5 / 255, 0xe1 / 255);
const COLOR_PARCHMENT = rgb(0xfa / 255, 0xf9 / 255, 0xf6 / 255);
const COLOR_ROW_ALT = rgb(0xf3 / 255, 0xf1 / 255, 0xec / 255);
const COLOR_WHITE = rgb(1, 1, 1);

const COLOR_REACTION = rgb(0xb9 / 255, 0x1c / 255, 0x1c / 255); // #B91C1C
const COLOR_RESTRICTION = rgb(0x1e / 255, 0x3a / 255, 0x8a / 255); // #1E3A8A
const COLOR_RELEASED = rgb(0x15 / 255, 0x80 / 255, 0x3d / 255); // #15803D
const COLOR_AMBER_BG = rgb(0xff / 255, 0xfb / 255, 0xeb / 255);
const COLOR_AMBER_BORDER = rgb(0xf5 / 255, 0x9e / 255, 0x0b / 255);

let cachedRegularFontBytes: Uint8Array | null = null;
let cachedBoldFontBytes: Uint8Array | null = null;

function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

async function loadPublicBinaryAsset(publicPath: string): Promise<Uint8Array> {
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    // Resolve against the deploy base path (e.g. /Digitalmethod/ on GitHub Pages)
    const res = await fetch(assetUrl(publicPath));
    if (!res.ok) {
      throw new Error(`Failed to fetch asset ${publicPath}: ${res.status}`);
    }
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  }
  // Node.js environment fallback for unit tests
  const fs = await import('node:fs');
  const path = await import('node:path');
  const cleanRel = publicPath.replace(/^\//, '');
  const fullPath = path.resolve(process.cwd(), 'public', cleanRel);
  const buf = fs.readFileSync(fullPath);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

async function getEmbeddedFonts(pdfDoc: PDFDocument): Promise<{
  regular: PDFFont;
  bold: PDFFont;
}> {
  pdfDoc.registerFontkit(fontkit);
  if (!cachedRegularFontBytes) {
    cachedRegularFontBytes = await loadPublicBinaryAsset('/fonts/DejaVuSans.ttf');
  }
  if (!cachedBoldFontBytes) {
    cachedBoldFontBytes = await loadPublicBinaryAsset('/fonts/DejaVuSans-Bold.ttf');
  }
  const regular = await pdfDoc.embedFont(cachedRegularFontBytes, { subset: true });
  const bold = await pdfDoc.embedFont(cachedBoldFontBytes, { subset: true });
  return { regular, bold };
}

/**
 * In browser environments, composites the parchment background, 5 soft pastel anatomical regions,
 * and the base PNG artwork (/diagrams/horse-left.png or /diagrams/horse-top.png) with multiply blend
 * onto a high-DPI offscreen <canvas>, returning PNG bytes.
 * Returns null in Node.js (where offscreen <canvas> is unavailable).
 */
async function renderBrowserDiagramCompositePng(
  view: 'left' | 'right' | 'top'
): Promise<Uint8Array | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return null;
  }

  const canvasW = 1200;
  const canvasH = view === 'top' ? 384 : 1032;
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 1. Warm parchment background
  ctx.fillStyle = '#FAF9F6';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // 2. Subtle veterinary calibration grid
  ctx.strokeStyle = '#E6E2D8';
  ctx.lineWidth = 1;
  const gridStep = 48;
  for (let x = 0; x <= canvasW; x += gridStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasH);
    ctx.stroke();
  }
  for (let y = 0; y <= canvasH; y += gridStep) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasW, y);
    ctx.stroke();
  }

  // 3. Brighter, natural color-coded anatomical region polygons
  const mirrorX = view === 'right';
  for (const region of ANATOMICAL_REGIONS) {
    const polygons = view === 'top' ? region.topPolygons : region.leftPolygons;
    for (const poly of polygons) {
      if (poly.length < 3) continue;
      ctx.save();
      ctx.beginPath();
      poly.forEach((pt, idx) => {
        const px = (mirrorX ? 1 - pt.x : pt.x) * canvasW;
        const py = pt.y * canvasH;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = region.pastelFill;
      ctx.globalAlpha = 0.38;
      ctx.fill();
      ctx.strokeStyle = region.pastelStroke;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 2.0;
      ctx.stroke();
      ctx.restore();
    }
  }

  // 4. Base anatomical line-art PNG with multiply blend
  const imgSrc = assetUrl(view === 'top' ? 'diagrams/horse-top.png' : 'diagrams/horse-left.png');
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Failed to load ${imgSrc}`));
      el.src = imgSrc;
    });

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    if (mirrorX) {
      ctx.translate(canvasW, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(img, 0, 0, canvasW, canvasH);
    ctx.restore();
  } catch {
    // Continue with pastel regions if image load fails
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );
  if (!blob) return null;
  const ab = await blob.arrayBuffer();
  return new Uint8Array(ab);
}

function toPdfCoord(
  pt: Point,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
): { x: number; y: number } {
  return {
    x: boxX + pt.x * boxW,
    y: boxY + (1 - pt.y) * boxH,
  };
}

function drawReactionVectorOnPdf(
  page: PDFPage,
  p0: Point,
  p1: Point,
  level: ReactionLevel,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  boldFont: PDFFont,
  badgeCenter: { x: number; y: number }
) {
  const start = toPdfCoord(p0, boxX, boxY, boxW, boxH);
  const end = toPdfCoord(p1, boxX, boxY, boxW, boxH);

  if (level !== 3) {
    // White contrast halo
    page.drawLine({
      start,
      end,
      thickness: level === 2 ? 4.5 : 3.0,
      color: COLOR_PARCHMENT,
      opacity: 0.85,
    });
    page.drawLine({
      start,
      end,
      thickness: level === 1 ? 1.5 : 3.2,
      color: COLOR_REACTION,
    });
  } else {
    // Level 3 sawtooth zigzag vector segments
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const segLen = Math.hypot(dx, dy) || 1;
    const nx = -dy / segLen;
    const ny = dx / segLen;
    const steps = 6;
    const amp = 3.2;
    let prev = start;
    let sign = 1;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const bx = start.x + dx * t;
      const by = start.y + dy * t;
      const nextPt =
        s === steps
          ? end
          : {
              x: bx + nx * amp * sign,
              y: by + ny * amp * sign,
            };
      sign = -sign;
      page.drawLine({
        start: prev,
        end: nextPt,
        thickness: 2.8,
        color: COLOR_PARCHMENT,
        opacity: 0.85,
      });
      page.drawLine({
        start: prev,
        end: nextPt,
        thickness: 1.7,
        color: COLOR_REACTION,
      });
      prev = nextPt;
    }
  }

  // R1 / R2 / R3 compact vector pill
  const bw = 13;
  const bh = 8.5;
  page.drawRectangle({
    x: badgeCenter.x - bw / 2,
    y: badgeCenter.y - bh / 2,
    width: bw,
    height: bh,
    color: COLOR_REACTION,
    borderColor: COLOR_WHITE,
    borderWidth: 0.7,
  });
  const label = `R${level}`;
  const tw = boldFont.widthOfTextAtSize(label, 5.5);
  page.drawText(label, {
    x: badgeCenter.x - tw / 2,
    y: badgeCenter.y - 2,
    size: 5.5,
    font: boldFont,
    color: COLOR_WHITE,
  });
}

async function drawDiagramBoxOnPdf(
  pdfDoc: PDFDocument,
  page: PDFPage,
  view: 'left' | 'right' | 'top',
  title: string,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  session: BodyworkSession,
  regularFont: PDFFont,
  boldFont: PDFFont
) {
  // Title bar above box
  page.drawText(title, {
    x: boxX,
    y: boxY + boxH + 4,
    size: 8,
    font: boldFont,
    color: COLOR_FOREST,
  });

  // Parchment background & border
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxW,
    height: boxH,
    color: COLOR_PARCHMENT,
    borderColor: COLOR_BORDER,
    borderWidth: 0.8,
  });

  // Composite high-DPI image (browser) or raw PNG fallback (Node unit tests)
  const compositeBytes = await renderBrowserDiagramCompositePng(view);
  if (compositeBytes) {
    const pngImg = await pdfDoc.embedPng(compositeBytes);
    page.drawImage(pngImg, {
      x: boxX + 0.5,
      y: boxY + 0.5,
      width: boxW - 1,
      height: boxH - 1,
    });
  } else {
    // Node.js fallback: draw natural region bounding boxes and embed raw PNG for left/top
    for (const region of ANATOMICAL_REGIONS) {
      const polys = view === 'top' ? region.topPolygons : region.leftPolygons;
      const [r, g, b] = hexToRgbTuple(region.pastelFill);
      for (const poly of polys) {
        if (poly.length === 0) continue;
        const xs = poly.map((p) => (view === 'right' ? 1 - p.x : p.x));
        const ys = poly.map((p) => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        page.drawRectangle({
          x: boxX + minX * boxW,
          y: boxY + (1 - maxY) * boxH,
          width: (maxX - minX) * boxW,
          height: (maxY - minY) * boxH,
          color: rgb(r, g, b),
          opacity: 0.52,
        });
      }
    }
    if (view !== 'right') {
      try {
        const rawBytes = await loadPublicBinaryAsset(
          view === 'top' ? '/diagrams/horse-top.png' : '/diagrams/horse-left.png'
        );
        const pngImg = await pdfDoc.embedPng(rawBytes);
        page.drawImage(pngImg, {
          x: boxX + 1,
          y: boxY + 1,
          width: boxW - 2,
          height: boxH - 2,
          opacity: 0.9,
        });
      } catch {
        // Ignore in headless fallback
      }
    }
  }

  // Vector markers for Left / Right profile
  if (view === 'left' || view === 'right') {
    const dir = view === 'left' ? 1 : -1;
    for (const area of ANATOMICAL_AREAS) {
      const coord = getAreaCoordinate(area.id, view);
      const center = toPdfCoord(coord, boxX, boxY, boxW, boxH);
      const obs: AreaSideObservation = session.evaluationTable[area.id]?.[view] ?? {
        reaction: null,
        restriction: false,
        released: false,
        note: '',
      };

      const hasObservation =
        Boolean(obs.reaction) ||
        obs.restriction ||
        obs.released ||
        Boolean(obs.note?.trim());

      // 1. Restriction ellipse
      if (obs.restriction) {
        const rx = area.defaultRadius.rx * boxW;
        const ry = area.defaultRadius.ry * boxH;
        page.drawEllipse({
          x: center.x,
          y: center.y,
          xScale: rx,
          yScale: ry,
          color: COLOR_RESTRICTION,
          opacity: 0.14,
          borderColor: COLOR_RESTRICTION,
          borderWidth: 1.5,
        });
      }

      // 2. Reaction line / zigzag
      if (obs.reaction) {
        const [p0, p1] = getAreaReactionEndpoints(area.id, view);
        drawReactionVectorOnPdf(
          page,
          p0,
          p1,
          obs.reaction,
          boxX,
          boxY,
          boxW,
          boxH,
          boldFont,
          { x: center.x - dir * 9.5, y: center.y + 8.5 }
        );
      }

      // 3. Released emerald badge
      if (obs.released) {
        const relX = center.x + dir * 9.5;
        const relY = center.y + 8.5;
        page.drawCircle({
          x: relX,
          y: relY,
          size: 4.5,
          color: COLOR_RELEASED,
          borderColor: COLOR_WHITE,
          borderWidth: 0.7,
        });
        // Checkmark vector lines
        page.drawLine({
          start: { x: relX - 1.8, y: relY - 0.2 },
          end: { x: relX - 0.4, y: relY - 1.6 },
          thickness: 1.1,
          color: COLOR_WHITE,
        });
        page.drawLine({
          start: { x: relX - 0.4, y: relY - 1.6 },
          end: { x: relX + 2.1, y: relY + 1.5 },
          thickness: 1.1,
          color: COLOR_WHITE,
        });
      }

      // 4. Landmark index pin
      const pinR = hasObservation ? 4.4 : 3.5;
      page.drawCircle({
        x: center.x,
        y: center.y,
        size: pinR,
        color: hasObservation ? COLOR_CHARCOAL : COLOR_PARCHMENT,
        borderColor: obs.reaction
          ? COLOR_REACTION
          : obs.restriction
            ? COLOR_RESTRICTION
            : obs.released
              ? COLOR_RELEASED
              : COLOR_FOREST,
        borderWidth: hasObservation ? 1.0 : 0.65,
      });

      const idxStr = String(area.index);
      const idxSize = 4.5;
      const idxW = boldFont.widthOfTextAtSize(idxStr, idxSize);
      page.drawText(idxStr, {
        x: center.x - idxW / 2,
        y: center.y - 1.6,
        size: idxSize,
        font: boldFont,
        color: hasObservation ? COLOR_WHITE : COLOR_CHARCOAL,
      });
    }
  } else {
    // Top View: dorsal midline + 6 anchors + Predominant Diagonal arrow
    const midLeft = toPdfCoord({ x: 0.185, y: 0.5 }, boxX, boxY, boxW, boxH);
    const midRight = toPdfCoord({ x: 0.875, y: 0.5 }, boxX, boxY, boxW, boxH);
    page.drawLine({
      start: midLeft,
      end: midRight,
      thickness: 0.6,
      color: COLOR_MUTED,
      opacity: 0.5,
    });

    const topDiags = session.annotations.filter(
      (a): a is Extract<DiagramAnnotation, { kind: 'diagonal' }> =>
        a.view === 'top' && a.kind === 'diagonal'
    );

    for (const diag of topDiags) {
      const sPt = toPdfCoord(diag.start, boxX, boxY, boxW, boxH);
      const ePt = toPdfCoord(diag.end, boxX, boxY, boxW, boxH);
      page.drawLine({
        start: sPt,
        end: ePt,
        thickness: 3.6,
        color: COLOR_PARCHMENT,
        opacity: 0.85,
      });
      page.drawLine({
        start: sPt,
        end: ePt,
        thickness: 2.0,
        color: COLOR_CHARCOAL,
      });

      // Arrowhead at end
      const angle = Math.atan2(ePt.y - sPt.y, ePt.x - sPt.x);
      const headLen = 6;
      page.drawLine({
        start: ePt,
        end: {
          x: ePt.x - headLen * Math.cos(angle - Math.PI / 6),
          y: ePt.y - headLen * Math.sin(angle - Math.PI / 6),
        },
        thickness: 1.8,
        color: COLOR_CHARCOAL,
      });
      page.drawLine({
        start: ePt,
        end: {
          x: ePt.x - headLen * Math.cos(angle + Math.PI / 6),
          y: ePt.y - headLen * Math.sin(angle + Math.PI / 6),
        },
        thickness: 1.8,
        color: COLOR_CHARCOAL,
      });
    }

    for (const [key, anchor] of Object.entries(TOP_VIEW_ANCHORS)) {
      const pt = toPdfCoord(anchor.point, boxX, boxY, boxW, boxH);
      const isUsed = topDiags.some((d) => d.fromAnchor === key || d.toAnchor === key);
      page.drawCircle({
        x: pt.x,
        y: pt.y,
        size: isUsed ? 3.8 : 3.0,
        color: isUsed
          ? anchor.role === 'atlas'
            ? COLOR_REACTION
            : COLOR_RESTRICTION
          : COLOR_PARCHMENT,
        borderColor: anchor.role === 'atlas' ? COLOR_REACTION : COLOR_RESTRICTION,
        borderWidth: 1.0,
      });
      const lbl = anchor.labelEn;
      const lw = regularFont.widthOfTextAtSize(lbl, 5.5);
      const ly = anchor.point.y < 0.5 ? pt.y + 5.5 : pt.y - 9.5;
      page.drawText(lbl, {
        x: pt.x - lw / 2,
        y: ly,
        size: 5.5,
        font: isUsed ? boldFont : regularFont,
        color: COLOR_CHARCOAL,
      });
    }
  }
}

// Invisible emoji helpers: variation selectors, ZWJ, skin-tone modifiers, keycap combiner
const EMOJI_HELPER_CODEPOINTS = new Set<number>([
  0xfe0e, 0xfe0f, 0x200d, 0x20e3, 0x1f3fb, 0x1f3fc, 0x1f3fd, 0x1f3fe, 0x1f3ff,
]);
// Pictographic emoji (some exist as monochrome glyphs in DejaVuSans, but are still emoji)
const EMOJI_PICTOGRAPHIC_RE = /\p{Extended_Pictographic}/u;
// Typographic marks that Unicode also classes as pictographic — keep them
const KEEP_PICTOGRAPHIC = new Set<string>(['©', '®', '™']);

/**
 * Returns a sanitizer that removes emoji and any characters none of the embedded fonts
 * can draw (pdf-lib would render those as empty boxes), then tidies the spaces left
 * behind. Plain symbols such as ✓ → № × © are kept.
 */
export function makePdfTextSanitizer(fonts: PDFFont[]): (text: string) => string {
  const supported = new Set<number>();
  for (const font of fonts) {
    for (const cp of font.getCharacterSet()) supported.add(cp);
  }
  return (text: string): string => {
    if (!text) return text;
    let out = '';
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      if (ch === '\n' || ch === '\t') {
        out += ch;
      } else if (
        !EMOJI_HELPER_CODEPOINTS.has(cp) &&
        supported.has(cp) &&
        (KEEP_PICTOGRAPHIC.has(ch) || !EMOJI_PICTOGRAPHIC_RE.test(ch))
      ) {
        out += ch;
      }
    }
    return out
      .split('\n')
      .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
      .join('\n');
  };
}

function wrapTextToLines(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const paragraphs = (text || '').split(/\r?\n/);
  const lines: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      if (lines.length > 0 && lines[lines.length - 1] !== '') {
        lines.push('');
      }
      continue;
    }
    const words = trimmed.split(/\s+/);
    let currentLine = '';
    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  return lines.length > 0 ? lines : ['—'];
}

function formatCellSummaryText(obs: AreaSideObservation, lang: Language): string {
  const parts: string[] = [];
  if (obs.reaction) {
    parts.push(`R${obs.reaction}`);
  }
  if (obs.restriction) {
    parts.push(lang === 'ru' ? 'Рестр.' : 'Restr.');
  }
  if (obs.released) {
    parts.push(lang === 'ru' ? 'Релиз ✓' : 'Rel ✓');
  }
  if (obs.releaseSigns && obs.releaseSigns.length > 0) {
    const formattedSigns = obs.releaseSigns.map((s) => {
      const tr = translateStoredTaxonomyValue(s, lang);
      if ((s === 'Yawn' || s === 'Deep yawning') && obs.yawnCount && obs.yawnCount > 1) {
        return `${tr} ×${obs.yawnCount}`;
      }
      return tr;
    });
    parts.push(formattedSigns.join(', '));
  }
  if (obs.resistanceSigns && obs.resistanceSigns.length > 0) {
    parts.push(
      obs.resistanceSigns.map((s) => translateStoredTaxonomyValue(s, lang)).join(', ')
    );
  }
  if (obs.techniques && obs.techniques.length > 0) {
    parts.push(obs.techniques.map((s) => translateStoredTaxonomyValue(s, lang)).join(', '));
  }
  if (obs.note?.trim()) {
    parts.push(obs.note.trim());
  }
  return parts.length > 0 ? parts.join(' · ') : '—';
}

function hasAnyCellObservation(obs: AreaSideObservation | undefined): boolean {
  if (!obs) return false;
  return (
    Boolean(obs.reaction) ||
    obs.restriction ||
    obs.released ||
    Boolean(obs.releaseSigns && obs.releaseSigns.length > 0) ||
    Boolean(obs.resistanceSigns && obs.resistanceSigns.length > 0) ||
    Boolean(obs.techniques && obs.techniques.length > 0) ||
    Boolean(obs.note?.trim())
  );
}

// ===========================================================================
// BEFORE / AFTER PHOTOS
// ===========================================================================

const PHOTO_BAND_HEIGHT = 168;
const PHOTOS_PER_KIND_IN_PDF = 2;

export function groupPhotosForPdf(photos: SessionPhoto[]): Record<SessionPhotoKind, SessionPhoto[]> {
  const sorted = [...photos].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return {
    before: sorted.filter((p) => p.kind === 'before').slice(0, PHOTOS_PER_KIND_IN_PDF),
    after: sorted.filter((p) => p.kind === 'after').slice(0, PHOTOS_PER_KIND_IN_PDF),
  };
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

async function getPhotoBytes(photo: SessionPhoto): Promise<{ bytes: Uint8Array; isPng: boolean } | null> {
  if (photo.imageBlob) {
    const bytes = new Uint8Array(await photo.imageBlob.arrayBuffer());
    return { bytes, isPng: photo.imageBlob.type === 'image/png' };
  }
  if (photo.imageDataUrl) {
    const comma = photo.imageDataUrl.indexOf(',');
    if (comma === -1) return null;
    const header = photo.imageDataUrl.slice(0, comma);
    return {
      bytes: decodeBase64ToBytes(photo.imageDataUrl.slice(comma + 1)),
      isPng: header.includes('image/png'),
    };
  }
  return null;
}

function formatPhotoTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Draws a "Before | After" photo band: title strip + two columns, each holding up to
 * two aspect-fit images with captions. Undecodable images become a labelled placeholder.
 */
async function drawPhotoBand(
  pdfDoc: PDFDocument,
  page: PDFPage,
  groups: Record<SessionPhotoKind, SessionPhoto[]>,
  x: number,
  topY: number,
  width: number,
  regular: PDFFont,
  bold: PDFFont,
  lang: Language,
  clean: (text: string) => string = (text) => text
): Promise<void> {
  const bandH = PHOTO_BAND_HEIGHT;
  page.drawRectangle({
    x,
    y: topY - bandH,
    width,
    height: bandH,
    color: COLOR_WHITE,
    borderColor: COLOR_BORDER,
    borderWidth: 0.65,
  });
  page.drawText(lang === 'ru' ? 'Фото: до и после сессии' : 'Photos: Before & After Session', {
    x: x + 8,
    y: topY - 12,
    size: 8,
    font: bold,
    color: COLOR_FOREST,
  });

  const gutter = 10;
  const colW = (width - 16 - gutter) / 2;
  const colTop = topY - 20;
  const labelH = 12;
  const captionH = 11;
  const cellGap = 6;
  const cellH = bandH - 20 - labelH - captionH - 8;

  const kinds: SessionPhotoKind[] = ['before', 'after'];
  for (let k = 0; k < kinds.length; k++) {
    const kind = kinds[k];
    const colX = x + 8 + k * (colW + gutter);
    const label =
      kind === 'before'
        ? lang === 'ru' ? 'ДО' : 'BEFORE'
        : lang === 'ru' ? 'ПОСЛЕ' : 'AFTER';
    page.drawText(label, {
      x: colX,
      y: colTop - 8,
      size: 7.4,
      font: bold,
      color: kind === 'before' ? COLOR_SLATE : COLOR_RELEASED,
    });

    const list = groups[kind];
    if (list.length === 0) {
      page.drawText(lang === 'ru' ? 'Фото не добавлено' : 'No photo added', {
        x: colX,
        y: colTop - labelH - cellH / 2,
        size: 7,
        font: regular,
        color: COLOR_MUTED,
      });
      continue;
    }

    const cellW = (colW - cellGap * (PHOTOS_PER_KIND_IN_PDF - 1)) / PHOTOS_PER_KIND_IN_PDF;
    const cellTop = colTop - labelH;
    for (let i = 0; i < list.length; i++) {
      const photo = list[i];
      const cellX = colX + i * (cellW + cellGap);
      page.drawRectangle({
        x: cellX,
        y: cellTop - cellH,
        width: cellW,
        height: cellH,
        color: COLOR_ROW_ALT,
      });

      let embedded = false;
      try {
        const data = await getPhotoBytes(photo);
        if (data) {
          const img = data.isPng ? await pdfDoc.embedPng(data.bytes) : await pdfDoc.embedJpg(data.bytes);
          const scale = Math.min(cellW / img.width, cellH / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          page.drawImage(img, {
            x: cellX + (cellW - w) / 2,
            y: cellTop - cellH + (cellH - h) / 2,
            width: w,
            height: h,
          });
          embedded = true;
        }
      } catch {
        embedded = false;
      }
      if (!embedded) {
        page.drawText(lang === 'ru' ? 'Фото недоступно' : 'Photo unavailable', {
          x: cellX + 6,
          y: cellTop - cellH / 2,
          size: 6.8,
          font: regular,
          color: COLOR_MUTED,
        });
      }
      page.drawRectangle({
        x: cellX,
        y: cellTop - cellH,
        width: cellW,
        height: cellH,
        borderColor: COLOR_BORDER,
        borderWidth: 0.6,
      });

      const time = formatPhotoTime(photo.createdAt);
      const caption = [label.charAt(0) + label.slice(1).toLowerCase(), clean(photo.caption ?? '').trim(), time]
        .filter(Boolean)
        .join(' · ');
      page.drawText(caption.slice(0, 48), {
        x: cellX,
        y: cellTop - cellH - 9,
        size: 6.6,
        font: regular,
        color: COLOR_SLATE,
      });
    }
  }
}

/**
 * Generates a unified A4 PDF document (2 pages; more when long notes overflow) (Uint8Array) 100% offline using pdf-lib,
 * embedded DejaVuSans TrueType fonts (Latin + Cyrillic), high-DPI composited diagrams,
 * and crisp vector markers.
 */
export async function generateSessionPdfBytes(
  horse: HorseProfile,
  session: BodyworkSession,
  lang: Language = 'en',
  photos: SessionPhoto[] = []
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const { regular, bold } = await getEmbeddedFonts(pdfDoc);
  // Strip emoji / glyphs the embedded fonts lack from user-entered text (data is untouched)
  const clean = makePdfTextSanitizer([regular, bold]);
  horse = {
    ...horse,
    name: clean(horse.name ?? ''),
    breed: clean(horse.breed ?? ''),
    age: clean(horse.age ?? ''),
    job: clean(horse.job ?? ''),
    owner: clean(horse.owner ?? ''),
  };
  session = {
    ...session,
    practitioner: clean(session.practitioner ?? ''),
    duration: clean(session.duration ?? ''),
  };
  const t = TRANSLATIONS[lang];
  const syncedSections = session.reportCustomized
    ? session.reportSections
    : buildReportFromSession(session, lang);

  // =========================================================================
  // PAGE 1: VISUAL EVALUATION MAP (HEADER + LEFT/RIGHT PROFILES + TOP VIEW)
  // =========================================================================
  const page1 = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  const margin = 28;
  const contentW = A4_WIDTH - margin * 2;
  let cursorY = A4_HEIGHT - margin;

  // Header Banner
  page1.drawRectangle({
    x: margin,
    y: cursorY - 42,
    width: contentW,
    height: 42,
    color: COLOR_FOREST,
  });

  const docTitle =
    lang === 'ru'
      ? 'ОТЧЕТ О СЕССИИ БОДИВОРКА ЛОШАДИ (MASTERSON METHOD)'
      : 'MASTERSON METHOD EQUINE BODYWORK — SESSION REPORT';

  page1.drawText(docTitle, {
    x: margin + 12,
    y: cursorY - 19,
    size: 10.5,
    font: bold,
    color: COLOR_WHITE,
  });

  const subTitle =
    lang === 'ru'
      ? 'Стр. 1: Визуальная карта пальпации (Реакции, Рестрикции, Релизы и Преобладающая диагональ)'
      : 'Page 1: Visual Evaluation Map (Palpation Reactions, Restrictions, Releases & Predominant Diagonal)';

  page1.drawText(subTitle.slice(0, 105), {
    x: margin + 12,
    y: cursorY - 33,
    size: 7.5,
    font: regular,
    color: COLOR_PARCHMENT,
  });

  cursorY -= 50;

  // Clean Metadata Grid (Omits empty optional fields instead of printing blank underscores)
  const metaPairs: Array<{ label: string; value: string }> = [
    { label: t.horseLabel, value: horse.name || 'Unnamed Horse' },
    { label: t.sessionNum, value: `#${session.sessionNumber}` },
    { label: t.dateLabel, value: session.date },
  ];
  if (horse.breed?.trim()) metaPairs.push({ label: t.breedLabel, value: horse.breed.trim() });
  if (horse.age?.trim()) metaPairs.push({ label: t.ageLabel, value: horse.age.trim() });
  if (horse.job?.trim()) metaPairs.push({ label: t.jobLabel, value: horse.job.trim() });
  if (session.practitioner?.trim()) {
    metaPairs.push({ label: t.studentLabel, value: session.practitioner.trim() });
  }
  if (horse.owner?.trim()) metaPairs.push({ label: t.ownerLabel, value: horse.owner.trim() });
  if (session.duration?.trim()) {
    metaPairs.push({ label: t.durationLabel, value: session.duration.trim() });
  }

  const cols = 4;
  const rowsCount = Math.ceil(metaPairs.length / cols);
  const metaBoxH = rowsCount * 16 + 10;

  page1.drawRectangle({
    x: margin,
    y: cursorY - metaBoxH,
    width: contentW,
    height: metaBoxH,
    color: COLOR_PARCHMENT,
    borderColor: COLOR_BORDER,
    borderWidth: 0.75,
  });

  const colW = contentW / cols;
  metaPairs.forEach((item, idx) => {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const x = margin + 8 + c * colW;
    const y = cursorY - 14 - r * 16;
    const labelStr = `${item.label}: `;
    const lw = regular.widthOfTextAtSize(labelStr, 7.5);
    page1.drawText(labelStr, {
      x,
      y,
      size: 7.5,
      font: regular,
      color: COLOR_MUTED,
    });
    page1.drawText(item.value.slice(0, 26), {
      x: x + lw,
      y,
      size: 7.8,
      font: bold,
      color: COLOR_CHARCOAL,
    });
  });

  cursorY -= metaBoxH + 10;

  // Symbol Legend Bar
  const legendH = 22;
  page1.drawRectangle({
    x: margin,
    y: cursorY - legendH,
    width: contentW,
    height: legendH,
    color: COLOR_ROW_ALT,
    borderColor: COLOR_BORDER,
    borderWidth: 0.6,
  });

  page1.drawText(
    lang === 'ru'
      ? 'Условные обозначения карты:'
      : 'Evaluation Map Legend:',
    {
      x: margin + 8,
      y: cursorY - 14,
      size: 7.5,
      font: bold,
      color: COLOR_CHARCOAL,
    }
  );

  // Legend items
  const legY = cursorY - 11.5;
  // R1
  page1.drawLine({
    start: { x: margin + 128, y: legY },
    end: { x: margin + 142, y: legY },
    thickness: 1.3,
    color: COLOR_REACTION,
  });
  page1.drawText(lang === 'ru' ? 'R1 Реакция 1' : 'R1 Reaction 1', {
    x: margin + 146,
    y: cursorY - 14,
    size: 7,
    font: bold,
    color: COLOR_REACTION,
  });

  // R2
  page1.drawLine({
    start: { x: margin + 215, y: legY },
    end: { x: margin + 229, y: legY },
    thickness: 3.0,
    color: COLOR_REACTION,
  });
  page1.drawText(lang === 'ru' ? 'R2 Реакция 2' : 'R2 Reaction 2', {
    x: margin + 233,
    y: cursorY - 14,
    size: 7,
    font: bold,
    color: COLOR_REACTION,
  });

  // R3
  page1.drawText(lang === 'ru' ? 'R3 Зигзаг (Ур. 3)' : 'R3 Zigzag (Lvl 3)', {
    x: margin + 302,
    y: cursorY - 14,
    size: 7,
    font: bold,
    color: COLOR_REACTION,
  });

  // Restriction
  page1.drawEllipse({
    x: margin + 390,
    y: legY,
    xScale: 5.5,
    yScale: 3.8,
    color: COLOR_RESTRICTION,
    opacity: 0.18,
    borderColor: COLOR_RESTRICTION,
    borderWidth: 1.2,
  });
  page1.drawText(lang === 'ru' ? 'Рестрикция' : 'Restriction', {
    x: margin + 400,
    y: cursorY - 14,
    size: 7,
    font: bold,
    color: COLOR_RESTRICTION,
  });

  // Released
  page1.drawCircle({
    x: margin + 468,
    y: legY,
    size: 4.2,
    color: COLOR_RELEASED,
  });
  page1.drawText(lang === 'ru' ? 'Релиз (✓)' : 'Released (✓)', {
    x: margin + 476,
    y: cursorY - 14,
    size: 7,
    font: bold,
    color: COLOR_RELEASED,
  });

  cursorY -= legendH + 18;

  // Side-by-Side Left Profile & Right Profile
  const sideGap = 12;
  const sideW = (contentW - sideGap) / 2; // ~263.6 pt
  const sideH = Math.round(sideW * 0.86); // ~226.7 pt
  const sideBottomY = cursorY - sideH;

  await drawDiagramBoxOnPdf(
    pdfDoc,
    page1,
    'left',
    t.leftProfileTitle,
    margin,
    sideBottomY,
    sideW,
    sideH,
    session,
    regular,
    bold
  );

  await drawDiagramBoxOnPdf(
    pdfDoc,
    page1,
    'right',
    t.rightProfileTitle,
    margin + sideW + sideGap,
    sideBottomY,
    sideW,
    sideH,
    session,
    regular,
    bold
  );

  cursorY = sideBottomY - 20;

  // Top View — Predominant Diagonal
  const topW = contentW;
  const topH = Math.round(topW * 0.305); // ~164 pt
  const topBottomY = cursorY - topH;

  await drawDiagramBoxOnPdf(
    pdfDoc,
    page1,
    'top',
    t.topViewTitle,
    margin,
    topBottomY,
    topW,
    topH,
    session,
    regular,
    bold
  );

  cursorY = topBottomY - 14;

  // 19-Area Index Reference Key at bottom of Page 1
  const refBoxH = Math.max(72, cursorY - margin - 20);
  page1.drawRectangle({
    x: margin,
    y: cursorY - refBoxH,
    width: contentW,
    height: refBoxH,
    color: COLOR_PARCHMENT,
    borderColor: COLOR_BORDER,
    borderWidth: 0.7,
  });

  page1.drawText(
    lang === 'ru'
      ? 'Индекс анатомических зон (1–19):'
      : 'Anatomical Landmarks Key (1–19):',
    {
      x: margin + 8,
      y: cursorY - 12,
      size: 7.5,
      font: bold,
      color: COLOR_FOREST,
    }
  );

  const keyCols = 4;
  const keyColW = (contentW - 16) / keyCols;
  ANATOMICAL_AREAS.forEach((area, i) => {
    const c = Math.floor(i / 5);
    const r = i % 5;
    const kx = margin + 8 + c * keyColW;
    const ky = cursorY - 24 - r * 10.5;
    const areaTitle = lang === 'ru' ? area.nameRu : area.nameEn;
    page1.drawText(`${area.index}. ${areaTitle}`.slice(0, 32), {
      x: kx,
      y: ky,
      size: 6.7,
      font: regular,
      color: COLOR_CHARCOAL,
    });
  });

  // Page footers are drawn at the end, once the total page count is known
  const footerPrefix = `${horse.name} · ${t.sessionNum} #${session.sessionNumber} · ${session.date}`;

  // =========================================================================
  // PAGE 2: UNIFIED EVALUATED ZONES SUMMARY TABLE & SESSION NOTES
  // =========================================================================
  // Forest header strip shared by page 2, the photo page and continuation pages.
  // Returns the cursor Y just below the strip.
  const drawPageHeaderStrip = (page: PDFPage, text: string): number => {
    const topY = A4_HEIGHT - margin;
    page.drawRectangle({
      x: margin,
      y: topY - 28,
      width: contentW,
      height: 28,
      color: COLOR_FOREST,
    });
    page.drawText(text, {
      x: margin + 10,
      y: topY - 18,
      size: 9.5,
      font: bold,
      color: COLOR_WHITE,
    });
    return topY - 36;
  };

  const page2 = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  let p2Y = drawPageHeaderStrip(
    page2,
    lang === 'ru'
      ? `СВОДКА ОТМЕЧЕННЫХ ЗОН И ЗАМЕТКИ СЕССИИ — ${horse.name.toUpperCase()} (СЕССИЯ №${session.sessionNumber})`
      : `EVALUATED ZONES SUMMARY & SESSION NOTES — ${horse.name.toUpperCase()} (SESSION #${session.sessionNumber})`
  );

  // Unified Table: Evaluated / Marked anatomical zones
  const areasToRender = ANATOMICAL_AREAS.filter((a) => {
    const row = session.evaluationTable[a.id];
    return hasAnyCellObservation(row?.left) || hasAnyCellObservation(row?.right);
  });

  // Table Header
  const thH = 16;
  const colLeftW = contentW * 0.34;
  const colAreaW = contentW * 0.32;
  const colRightW = contentW * 0.34;

  page2.drawRectangle({
    x: margin,
    y: p2Y - thH,
    width: contentW,
    height: thH,
    color: COLOR_CHARCOAL,
  });
  page2.drawText(t.tableLeft, {
    x: margin + 8,
    y: p2Y - 11.5,
    size: 7.5,
    font: bold,
    color: COLOR_WHITE,
  });
  page2.drawText(
    lang === 'ru'
      ? 'Отмеченные анатомические зоны'
      : 'Evaluated Anatomical Areas',
    {
      x: margin + colLeftW + 8,
      y: p2Y - 11.5,
      size: 7.5,
      font: bold,
      color: COLOR_WHITE,
    }
  );
  page2.drawText(t.tableRight, {
    x: margin + colLeftW + colAreaW + 8,
    y: p2Y - 11.5,
    size: 7.5,
    font: bold,
    color: COLOR_WHITE,
  });
  p2Y -= thH;

  const rowH = 18;
  if (areasToRender.length === 0) {
    page2.drawRectangle({
      x: margin,
      y: p2Y - 22,
      width: contentW,
      height: 22,
      color: COLOR_PARCHMENT,
      borderColor: COLOR_BORDER,
      borderWidth: 0.5,
    });
    page2.drawText(
      lang === 'ru'
        ? 'На карте оценки в данной сессии специфических реакций или рестрикций не отмечено.'
        : 'No specific area reactions or restrictions marked in this session.',
      {
        x: margin + 10,
        y: p2Y - 14,
        size: 7.5,
        font: regular,
        color: COLOR_MUTED,
      }
    );
    p2Y -= 22;
  } else {
    areasToRender.forEach((area, rIdx) => {
      const row = session.evaluationTable[area.id];
      const leftText = row ? clean(formatCellSummaryText(row.left, lang)) || '—' : '—';
      const rightText = row ? clean(formatCellSummaryText(row.right, lang)) || '—' : '—';
      const areaName = `${area.index}. ${lang === 'ru' ? area.nameRu : area.nameEn}`;

      page2.drawRectangle({
        x: margin,
        y: p2Y - rowH,
        width: contentW,
        height: rowH,
        color: rIdx % 2 === 0 ? COLOR_PARCHMENT : COLOR_ROW_ALT,
        borderColor: COLOR_BORDER,
        borderWidth: 0.4,
      });

      // Vertical dividers
      page2.drawLine({
        start: { x: margin + colLeftW, y: p2Y },
        end: { x: margin + colLeftW, y: p2Y - rowH },
        thickness: 0.4,
        color: COLOR_BORDER,
      });
      page2.drawLine({
        start: { x: margin + colLeftW + colAreaW, y: p2Y },
        end: { x: margin + colLeftW + colAreaW, y: p2Y - rowH },
        thickness: 0.4,
        color: COLOR_BORDER,
      });

      const textY = p2Y - rowH / 2 - 2.3;
      page2.drawText(leftText.slice(0, 42), {
        x: margin + 5,
        y: textY,
        size: 6.8,
        font: leftText !== '—' ? bold : regular,
        color: row?.left?.reaction
          ? COLOR_REACTION
          : row?.left?.restriction
            ? COLOR_RESTRICTION
            : row?.left?.released
              ? COLOR_RELEASED
              : COLOR_SLATE,
      });

      page2.drawText(areaName.slice(0, 36), {
        x: margin + colLeftW + 6,
        y: textY,
        size: 7,
        font: bold,
        color: COLOR_CHARCOAL,
      });

      page2.drawText(rightText.slice(0, 42), {
        x: margin + colLeftW + colAreaW + 5,
        y: textY,
        size: 6.8,
        font: rightText !== '—' ? bold : regular,
        color: row?.right?.reaction
          ? COLOR_REACTION
          : row?.right?.restriction
            ? COLOR_RESTRICTION
            : row?.right?.released
              ? COLOR_RELEASED
              : COLOR_SLATE,
      });

      p2Y -= rowH;
    });
  }

  p2Y -= 12;

  // ---------------------------------------------------------------------
  // Flowing narrative sections: start below the table on page 2 and continue
  // on extra pages (same header strip, footers added below) when space runs out.
  // ---------------------------------------------------------------------
  let flowPage: PDFPage = page2;
  let flowY = p2Y;
  const flowBottom = margin + 8;
  // A page already holding content (the photo page) where text continues next
  let pendingContinuation: { page: PDFPage; y: number } | null = null;

  const nextFlowPage = () => {
    if (pendingContinuation) {
      flowPage = pendingContinuation.page;
      flowY = pendingContinuation.y;
      pendingContinuation = null;
      return;
    }
    flowPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    flowY = drawPageHeaderStrip(
      flowPage,
      lang === 'ru'
        ? `ЗАМЕТКИ СЕССИИ (ПРОДОЛЖЕНИЕ) — ${horse.name.toUpperCase()} (СЕССИЯ №${session.sessionNumber})`
        : `SESSION NOTES (CONTINUED) — ${horse.name.toUpperCase()} (SESSION #${session.sessionNumber})`
    );
  };

  const NARRATIVE_FONT_SIZE = 7.6;
  const NARRATIVE_LINE_H = 10.5;
  const NARRATIVE_HEAD_H = 18;
  const NARRATIVE_PAD = 6;
  const continuedSuffix = lang === 'ru' ? ' (продолжение)' : ' (cont.)';

  // Draws a structured narrative box; long text is split across pages, never dropped
  // (unless an explicit maxLines cap is given for short generated summaries).
  const drawNarrativeSection = (
    sectionTitle: string,
    bodyText: string,
    opts: { maxLines?: number; highlightAmber?: boolean } = {}
  ) => {
    const { maxLines, highlightAmber = false } = opts;
    let lines = wrapTextToLines(clean(bodyText), regular, NARRATIVE_FONT_SIZE, contentW - 16);
    if (maxLines !== undefined) lines = lines.slice(0, maxLines);

    let idx = 0;
    let firstChunk = true;
    while (idx < lines.length) {
      if (!firstChunk) {
        // Do not start a continued box with a blank paragraph separator
        while (idx < lines.length && lines[idx] === '') idx++;
        if (idx >= lines.length) break;
      }
      const remaining = lines.length - idx;
      const minLines = Math.min(2, remaining);
      const fixedH = NARRATIVE_HEAD_H + NARRATIVE_PAD;
      if (flowY - fixedH - minLines * NARRATIVE_LINE_H < flowBottom) {
        nextFlowPage();
      }
      const fit = Math.max(
        1,
        Math.floor((flowY - flowBottom - fixedH) / NARRATIVE_LINE_H)
      );
      const chunk = lines.slice(idx, idx + fit);
      const boxH = fixedH + chunk.length * NARRATIVE_LINE_H;
      const page = flowPage;
      const topY = flowY;

      page.drawRectangle({
        x: margin,
        y: topY - boxH,
        width: contentW,
        height: boxH,
        color: highlightAmber ? COLOR_AMBER_BG : COLOR_PARCHMENT,
        borderColor: highlightAmber ? COLOR_AMBER_BORDER : COLOR_BORDER,
        borderWidth: highlightAmber ? 1.1 : 0.65,
      });
      page.drawText(firstChunk ? sectionTitle : `${sectionTitle}${continuedSuffix}`, {
        x: margin + 8,
        y: topY - 12,
        size: 8,
        font: bold,
        color: highlightAmber ? COLOR_CHARCOAL : COLOR_FOREST,
      });
      chunk.forEach((line, lIdx) => {
        page.drawText(line, {
          x: margin + 8,
          y: topY - 24 - lIdx * NARRATIVE_LINE_H,
          size: NARRATIVE_FONT_SIZE,
          font: regular,
          color: COLOR_CHARCOAL,
        });
      });

      flowY -= boxH + 8;
      idx += chunk.length;
      firstChunk = false;
    }
  };

  // 1. Response, Release & Guarding Signs (generated summary, capped)
  drawNarrativeSection(t.sec3Title, syncedSections.releaseSignsObserved, { maxLines: 4 });

  // 2. Predominant Diagonal (if marked)
  if (session.annotations.some((a) => a.kind === 'diagonal')) {
    drawNarrativeSection(t.sec4Title, syncedSections.predominantDiagonal, { maxLines: 2 });
  }

  // 3. Unified Session Notes & Techniques Used — full text, flows onto extra pages
  const unifiedSessionText =
    getUnifiedSessionNotes(session) || syncedSections.sessionNotes;
  drawNarrativeSection(t.sec5Title, unifiedSessionText);

  // 4. Before / After Photos (current flow page when it fits, otherwise a dedicated page;
  //    text that no longer fits on the current page then continues below the photos)
  const photoGroups = groupPhotosForPdf(photos);
  if (photoGroups.before.length > 0 || photoGroups.after.length > 0) {
    const bandH = PHOTO_BAND_HEIGHT;
    // Leave room for at least a short Owner Care box below the photos
    if (flowY - bandH - 60 >= flowBottom) {
      await drawPhotoBand(pdfDoc, flowPage, photoGroups, margin, flowY, contentW, regular, bold, lang, clean);
      flowY -= bandH + 8;
    } else {
      const photoPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      const photoTopY = drawPageHeaderStrip(
        photoPage,
        lang === 'ru'
          ? `ФОТО ДО / ПОСЛЕ — ${horse.name.toUpperCase()} (СЕССИЯ №${session.sessionNumber})`
          : `BEFORE / AFTER PHOTOS — ${horse.name.toUpperCase()} (SESSION #${session.sessionNumber})`
      );
      await drawPhotoBand(pdfDoc, photoPage, photoGroups, margin, photoTopY, contentW, regular, bold, lang, clean);
      pendingContinuation = { page: photoPage, y: photoTopY - bandH - 8 };
    }
  }

  // 5. Post-Session Care Recommendations — full text, flows onto extra pages
  drawNarrativeSection(t.sec6Title, syncedSections.postSessionCareNotes, {
    highlightAmber: true,
  });

  // Footers on every page: "<horse> · Session #N · date · Page X / Y"
  const allPages = pdfDoc.getPages();
  const disclaimerLines = wrapTextToLines(t.methodDisclaimer, regular, 5.4, contentW);
  allPages.forEach((pg, idx) => {
    pg.drawText(`${footerPrefix} · Page ${idx + 1} / ${allPages.length}`, {
      x: margin,
      y: margin - 5,
      size: 7,
      font: regular,
      color: COLOR_MUTED,
    });
    // Method / trademark disclaimer under the page footer
    disclaimerLines.slice(0, 2).forEach((line, lIdx) => {
      pg.drawText(line, {
        x: margin,
        y: margin - 13 - lIdx * 6.4, // keeps both lines ≥ 8pt above the sheet edge
        size: 5.4,
        font: regular,
        color: COLOR_MUTED,
      });
    });
  });

  return pdfDoc.save();
}

export function buildPdfFileName(horse: HorseProfile, session: BodyworkSession): string {
  const safeHorse = (horse.name || 'Horse')
    .trim()
    .replace(/[^a-zA-Z0-9\u0400-\u04FF_-]+/g, '_');
  const safeDate = (session.date || new Date().toISOString().slice(0, 10)).replace(
    /[^0-9-]/g,
    ''
  );
  return `Masterson_Report_${safeHorse}_${safeDate}.pdf`;
}

export async function buildSessionPdfFile(
  horse: HorseProfile,
  session: BodyworkSession,
  lang: Language = 'en',
  photos: SessionPhoto[] = []
): Promise<File> {
  const bytes = await generateSessionPdfBytes(horse, session, lang, photos);
  const filename = buildPdfFileName(horse, session);
  const bufferSlice = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  return new File([bufferSlice], filename, { type: 'application/pdf' });
}

export function triggerPdfFileDownload(pdfFile: File): void {
  const url = URL.createObjectURL(pdfFile);
  const a = document.createElement('a');
  a.href = url;
  a.download = pdfFile.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/**
 * Reliable Mobile File Saving & Sharing (Web Share API + Fallback).
 * Accepts an already-constructed `File` if pre-built so iOS Safari user-gesture
 * activation never expires before `navigator.share` is invoked.
 */
export async function shareOrDownloadPdfFile(
  pdfFile: File,
  title?: string
): Promise<'shared' | 'downloaded' | 'aborted'> {
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  ) {
    try {
      if (navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: title || pdfFile.name,
        });
        return 'shared';
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'aborted';
      }
      // If share fails for another reason, fall back to direct download below
    }
  }

  triggerPdfFileDownload(pdfFile);
  return 'downloaded';
}
