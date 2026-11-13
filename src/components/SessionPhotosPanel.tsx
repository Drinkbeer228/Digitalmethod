import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import { Language, MAX_PHOTOS_PER_KIND, SessionPhoto, SessionPhotoKind } from '../types';

interface SessionPhotosPanelProps {
  photos: SessionPhoto[];
  lang: Language;
  /** Compresses and stores the picked files. Rejects with a user-facing message on failure. */
  onAddPhotos: (kind: SessionPhotoKind, files: File[]) => Promise<void>;
  onDeletePhoto: (photoId: string) => Promise<void>;
  readOnly?: boolean;
}

const KIND_META: Record<SessionPhotoKind, { en: string; ru: string; hintEn: string; hintRu: string }> = {
  before: {
    en: 'Before',
    ru: 'До',
    hintEn: 'Whole horse, topline or problem area before work',
    hintRu: 'Общий вид, линия верха или проблемная зона до работы',
  },
  after: {
    en: 'After',
    ru: 'После',
    hintEn: 'Same angle after the session',
    hintRu: 'Тот же ракурс после сессии',
  },
};

function usePhotoUrls(photos: SessionPhoto[]): Record<string, string> {
  const urls = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of photos) {
      if (p.imageBlob) map[p.id] = URL.createObjectURL(p.imageBlob);
      else if (p.imageDataUrl) map[p.id] = p.imageDataUrl;
    }
    return map;
  }, [photos]);

  useEffect(
    () => () => {
      Object.values(urls).forEach((u) => {
        if (u.startsWith('blob:')) URL.revokeObjectURL(u);
      });
    },
    [urls]
  );
  return urls;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Before / After session photo slots (camera or gallery), compressed on-device before storage.
 * Used both in the Evaluation photo drawer and in the session report view.
 */
export const SessionPhotosPanel: React.FC<SessionPhotosPanelProps> = ({
  photos,
  lang,
  onAddPhotos,
  onDeletePhoto,
  readOnly = false,
}) => {
  const urls = usePhotoUrls(photos);
  const [busyKind, setBusyKind] = useState<SessionPhotoKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const cameraInputs = useRef<Record<SessionPhotoKind, HTMLInputElement | null>>({
    before: null,
    after: null,
  });
  const galleryInputs = useRef<Record<SessionPhotoKind, HTMLInputElement | null>>({
    before: null,
    after: null,
  });

  const byKind = (kind: SessionPhotoKind) =>
    photos
      .filter((p) => p.kind === kind)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const handleFiles = async (kind: SessionPhotoKind, fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;
    const free = MAX_PHOTOS_PER_KIND - byKind(kind).length;
    if (free <= 0) return;
    setError(null);
    setBusyKind(kind);
    try {
      await onAddPhotos(kind, files.slice(0, free));
      if (files.length > free) {
        setError(
          lang === 'ru'
            ? `Добавлено ${free}: в слоте не больше ${MAX_PHOTOS_PER_KIND} фото.`
            : `Added ${free}: max ${MAX_PHOTOS_PER_KIND} photos per slot.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKind(null);
    }
  };

  const previewPhoto = previewId ? photos.find((p) => p.id === previewId) : undefined;

  return (
    <div data-testid="session-photos-panel" className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {(['before', 'after'] as SessionPhotoKind[]).map((kind) => {
          const meta = KIND_META[kind];
          const list = byKind(kind);
          const isFull = list.length >= MAX_PHOTOS_PER_KIND;
          const isBusy = busyKind === kind;
          return (
            <div
              key={kind}
              data-testid={`photo-slot-${kind}`}
              className="rounded-xl border border-slate-300 bg-white p-2.5 space-y-2 min-w-0"
            >
              <div>
                <div
                  className={`text-xs font-bold ${
                    kind === 'before' ? 'text-slate-700' : 'text-[#15803D]'
                  }`}
                >
                  {lang === 'ru' ? meta.ru : meta.en}{' '}
                  <span className="font-tabular font-medium text-slate-400">
                    {list.length}/{MAX_PHOTOS_PER_KIND}
                  </span>
                </div>
                <div className="text-[10.5px] leading-snug text-slate-500">
                  {lang === 'ru' ? meta.hintRu : meta.hintEn}
                </div>
              </div>

              {list.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5">
                  {list.map((p) => (
                    <div key={p.id} className="relative">
                      <button
                        type="button"
                        onClick={() => setPreviewId(p.id)}
                        className="block w-full aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-[#F3F1EC] cursor-pointer"
                        aria-label={lang === 'ru' ? 'Открыть фото' : 'Open photo'}
                      >
                        {urls[p.id] && (
                          <img
                            src={urls[p.id]}
                            alt={`${lang === 'ru' ? meta.ru : meta.en} ${formatTime(p.createdAt)}`}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </button>
                      {!readOnly && (
                        <button
                          type="button"
                          data-testid={`photo-delete-${p.id}`}
                          onClick={() => setConfirmDeleteId(p.id)}
                          className="absolute top-1 right-1 w-8 h-8 flex items-center justify-center rounded-full bg-black/55 text-white cursor-pointer"
                          aria-label={lang === 'ru' ? 'Удалить фото' : 'Delete photo'}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      {confirmDeleteId === p.id && (
                        <div className="absolute inset-0 rounded-lg bg-white/95 flex flex-col items-center justify-center gap-1.5 p-1">
                          <button
                            type="button"
                            data-testid={`photo-confirm-delete-${p.id}`}
                            onClick={() => {
                              setConfirmDeleteId(null);
                              void onDeletePhoto(p.id);
                            }}
                            className="min-h-[36px] w-full inline-flex items-center justify-center gap-1 rounded-lg bg-red-700 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {lang === 'ru' ? 'Удалить' : 'Delete'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[32px] w-full rounded-lg text-[11px] font-semibold text-slate-600 cursor-pointer"
                          >
                            {lang === 'ru' ? 'Отмена' : 'Cancel'}
                          </button>
                        </div>
                      )}
                      <div className="mt-0.5 text-[10px] font-tabular text-slate-500">
                        {formatTime(p.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!readOnly && !isFull && (
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    data-testid={`photo-camera-${kind}`}
                    disabled={isBusy}
                    onClick={() => cameraInputs.current[kind]?.click()}
                    className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2B4C3F] hover:bg-[#223D32] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                  >
                    {isBusy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                    <span>
                      {isBusy
                        ? lang === 'ru'
                          ? 'Сжатие...'
                          : 'Compressing...'
                        : lang === 'ru'
                          ? 'Камера'
                          : 'Camera'}
                    </span>
                  </button>
                  <button
                    type="button"
                    data-testid={`photo-gallery-${kind}`}
                    disabled={isBusy}
                    onClick={() => galleryInputs.current[kind]?.click()}
                    className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-[#FAF9F6] hover:bg-slate-100 disabled:opacity-60 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    <ImagePlus className="w-4 h-4" />
                    <span>{lang === 'ru' ? 'Галерея' : 'Gallery'}</span>
                  </button>
                  <input
                    ref={(el) => {
                      cameraInputs.current[kind] = el;
                    }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      void handleFiles(kind, e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <input
                    ref={(el) => {
                      galleryInputs.current[kind] = el;
                    }}
                    data-testid={`photo-gallery-input-${kind}`}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void handleFiles(kind, e.target.files);
                      e.target.value = '';
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div
          data-testid="session-photos-error"
          className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start justify-between gap-2"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-amber-800 cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {previewPhoto && urls[previewPhoto.id] && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-3 no-print"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewId(null)}
        >
          <img
            src={urls[previewPhoto.id]}
            alt=""
            className="max-w-full max-h-full rounded-lg object-contain"
          />
          <button
            type="button"
            onClick={() => setPreviewId(null)}
            className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-full bg-white/20 text-white cursor-pointer"
            aria-label={lang === 'ru' ? 'Закрыть' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};
