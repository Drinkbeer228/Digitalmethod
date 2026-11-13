/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BodyworkSession, HorseProfile, Language } from '../types';
import { TRANSLATIONS } from '../data/translations';
import { ChevronDown, ChevronUp, FileText, MapPin, Plus, Trash2 } from 'lucide-react';

interface HorsesViewProps {
  horses: HorseProfile[];
  sessions: BodyworkSession[];
  activeHorseId: string;
  activeSessionId: string;
  lang: Language;
  onSelectHorseAndSession: (horseId: string, sessionId: string) => void;
  onOpenSessionReport: (horseId: string, sessionId: string) => void;
  onEditSessionOnMap: (horseId: string, sessionId: string) => void;
  onCreateHorse: (horse: Omit<HorseProfile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateHorse: (horse: HorseProfile) => Promise<void>;
  onDeleteHorse: (horseId: string) => Promise<void>;
  onCreateSessionForHorse: (horseId: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

function sessionCountLabel(count: number, lang: Language): string {
  if (lang !== 'ru') return `${count} ${count === 1 ? 'session' : 'sessions'}`;
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? 'сессия'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'сессии'
        : 'сессий';
  return `${count} ${word}`;
}

const FIELD_INPUT = 'w-full rounded-lg border border-slate-300 bg-[#FAF9F6] px-3 py-2';
const FORM_INPUT = 'w-full rounded border border-slate-300 bg-white px-2.5 py-2';

/** Archive screen: horse roster, the selected horse's profile and its session history. */
export const HorsesView: React.FC<HorsesViewProps> = ({
  horses,
  sessions,
  activeHorseId,
  activeSessionId,
  lang,
  onSelectHorseAndSession,
  onOpenSessionReport,
  onEditSessionOnMap,
  onCreateHorse,
  onUpdateHorse,
  onDeleteHorse,
  onCreateSessionForHorse,
  onDeleteSession,
}) => {
  const t = TRANSLATIONS[lang];
  const [showNewHorseForm, setShowNewHorseForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newBreed, setNewBreed] = useState('');
  const [newJob, setNewJob] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [newContact, setNewContact] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  // Mobile only: the profile form stays folded so the session history is one glance away.
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const selectedHorse = horses.find((h) => h.id === activeHorseId) ?? horses[0] ?? null;
  const horseSessions = selectedHorse
    ? sessions
        .filter((s) => s.horseId === selectedHorse.id)
        .sort((a, b) => b.sessionNumber - a.sessionNumber)
    : [];
  const selectedSession =
    horseSessions.find((s) => s.id === activeSessionId) ?? horseSessions[0] ?? null;

  const horseSummary = (h: HorseProfile) =>
    [h.breed, h.age ? fill(t.ageYears, { n: h.age }) : '', h.job].filter(Boolean).join(' · ');

  const handleAddHorseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setFormError(t.horseNameRequired);
      return;
    }
    setFormError(null);
    await onCreateHorse({
      name: newName.trim(),
      age: newAge.trim(),
      breed: newBreed.trim(),
      job: newJob.trim(),
      owner: newOwner.trim(),
      contactInfo: newContact.trim(),
      notes: '',
    });
    setNewName('');
    setNewAge('');
    setNewBreed('');
    setNewJob('');
    setNewOwner('');
    setNewContact('');
    setShowNewHorseForm(false);
  };

  const profileFields: Array<{ key: keyof HorseProfile & string; label: string }> = [
    { key: 'name', label: t.horseLabel },
    { key: 'age', label: t.ageLabel },
    { key: 'breed', label: t.breedLabel },
    { key: 'job', label: t.jobLabel },
    { key: 'owner', label: t.ownerLabel },
    { key: 'contactInfo', label: t.contactLabel },
  ];

  return (
    <div data-testid="horses-view" className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
      {/* Horse roster */}
      <div className="lg:col-span-4 rounded-xl border border-slate-300 bg-white p-4 md:p-5 space-y-4 self-start">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-base font-semibold text-[#1E2421]">
            {fill(t.horsesCount, { n: horses.length })}
          </h2>
          <button
            type="button"
            data-testid="new-horse-btn"
            onClick={() => setShowNewHorseForm((v) => !v)}
            className="min-h-[40px] inline-flex items-center gap-1 px-3 rounded-lg bg-[#2B4C3F] hover:bg-[#223D32] text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.newHorse.replace('+ ', '')}</span>
          </button>
        </div>

        {showNewHorseForm && (
          <form
            onSubmit={handleAddHorseSubmit}
            className="p-3.5 rounded-lg bg-[#FAF9F6] border border-slate-300 space-y-2.5 text-xs"
          >
            <div className="font-semibold text-[#2B4C3F]">{t.newHorseProfile}</div>
            {formError && (
              <div className="p-2 rounded bg-red-50 text-red-700 border border-red-200">
                {formError}
              </div>
            )}
            <input
              type="text"
              placeholder={`${t.horseLabel} *`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={FORM_INPUT}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder={t.ageLabel}
                value={newAge}
                onChange={(e) => setNewAge(e.target.value)}
                className={FORM_INPUT}
              />
              <input
                type="text"
                placeholder={t.breedLabel}
                value={newBreed}
                onChange={(e) => setNewBreed(e.target.value)}
                className={FORM_INPUT}
              />
            </div>
            <input
              type="text"
              placeholder={t.jobLabel}
              value={newJob}
              onChange={(e) => setNewJob(e.target.value)}
              className={FORM_INPUT}
            />
            <input
              type="text"
              placeholder={t.ownerLabel}
              value={newOwner}
              onChange={(e) => setNewOwner(e.target.value)}
              className={FORM_INPUT}
            />
            <input
              type="text"
              placeholder={t.contactLabel}
              value={newContact}
              onChange={(e) => setNewContact(e.target.value)}
              className={FORM_INPUT}
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowNewHorseForm(false)}
                className="min-h-[40px] px-3 rounded border border-slate-300 bg-white text-slate-700 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="min-h-[40px] px-3.5 rounded bg-[#2B4C3F] text-white font-semibold cursor-pointer"
              >
                {t.saveHorse}
              </button>
            </div>
          </form>
        )}

        {horses.length > 0 && (
          <div className="space-y-2">
            {horses.map((h) => {
              const count = sessions.filter((s) => s.horseId === h.id).length;
              const isSelected = h.id === selectedHorse?.id;
              return (
                <button
                  key={h.id}
                  type="button"
                  data-testid={`horse-roster-item-${h.id}`}
                  aria-pressed={isSelected}
                  onClick={() => {
                    const latest = sessions
                      .filter((s) => s.horseId === h.id)
                      .sort((a, b) => b.sessionNumber - a.sessionNumber)[0];
                    onSelectHorseAndSession(h.id, latest?.id ?? '');
                  }}
                  className={`w-full min-h-[52px] p-3 rounded-lg border text-xs text-left cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-[#2B4C3F] bg-[#2B4C3F]/8'
                      : 'border-slate-200 bg-[#FAF9F6] hover:bg-slate-100/70'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[#1E2421] text-sm truncate">
                      {h.name}
                      {h.isDemo ? ` (${t.demoBadge})` : ''}
                    </div>
                    <div className="text-slate-500 mt-0.5 truncate">{horseSummary(h)}</div>
                  </div>
                  <div className="shrink-0 text-right font-tabular text-slate-600">
                    {sessionCountLabel(count, lang)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="lg:col-span-8 space-y-4 lg:space-y-6">
        {selectedHorse ? (
          <>
            {/* Session history: the main reason to open this screen in the field */}
            <div className="rounded-xl border border-slate-300 bg-white p-4 md:p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-[#1E2421]">
                    {fill(t.sessionHistoryTitle, {
                      name: selectedHorse.name,
                      n: horseSessions.length,
                    })}
                  </h3>
                  <p className="text-xs text-slate-500">{t.sessionHistoryHint}</p>
                </div>
                <button
                  type="button"
                  data-testid="new-session-btn"
                  onClick={() => void onCreateSessionForHorse(selectedHorse.id)}
                  className="shrink-0 min-h-[40px] inline-flex items-center gap-1.5 px-3.5 rounded-lg bg-[#2B4C3F] hover:bg-[#223D32] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.newSession.replace('+ ', '')}</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {horseSessions.map((sess) => {
                  const isCurrent = sess.id === selectedSession?.id;
                  return (
                    <div
                      key={sess.id}
                      data-testid={`session-history-row-${sess.id}`}
                      onClick={() => onOpenSessionReport(selectedHorse.id, sess.id)}
                      className={`p-3.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isCurrent
                          ? 'border-[#2B4C3F] bg-[#2B4C3F]/8 ring-1 ring-[#2B4C3F]/30'
                          : 'border-slate-200 bg-[#FAF9F6] hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-semibold text-[#1E2421] text-sm flex flex-wrap items-center gap-2">
                          <span>
                            {fill(t.sessionRowTitle, { n: sess.sessionNumber })} · {sess.date}
                          </span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full bg-[#2B4C3F] text-white text-[10px] font-bold">
                              {t.selectedBadge}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600">
                          {t.studentLabel}: {sess.practitioner || '—'} · {t.durationLabel}:{' '}
                          {sess.duration || '—'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          data-testid={`session-view-summary-btn-${sess.id}`}
                          onClick={() => onOpenSessionReport(selectedHorse.id, sess.id)}
                          className="min-h-[40px] inline-flex items-center gap-1 px-3 rounded-lg bg-[#2B4C3F] hover:bg-[#223D32] text-white font-semibold cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{t.openReport}</span>
                        </button>
                        <button
                          type="button"
                          data-testid={`session-edit-map-btn-${sess.id}`}
                          onClick={() => onEditSessionOnMap(selectedHorse.id, sess.id)}
                          className="min-h-[40px] inline-flex items-center gap-1 px-3 rounded-lg border border-[#2B4C3F] bg-white hover:bg-[#2B4C3F]/10 text-[#2B4C3F] font-semibold cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{t.editOnMap}</span>
                        </button>
                        {horseSessions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => void onDeleteSession(sess.id)}
                            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center text-slate-400 hover:text-red-700 rounded cursor-pointer"
                            aria-label={fill(t.deleteSessionAria, { n: sess.sessionNumber })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Horse profile: folded to one line on mobile, always open on desktop */}
            <div className="rounded-xl border border-slate-300 bg-white p-4 md:p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-[#1E2421] truncate">
                    {fill(t.horseProfileTitle, { name: selectedHorse.name })}
                  </h3>
                  <p className="text-xs text-slate-500 truncate lg:hidden">
                    {[horseSummary(selectedHorse), selectedHorse.owner].filter(Boolean).join(' · ') ||
                      t.horseProfileHint}
                  </p>
                  <p className="hidden lg:block text-xs text-slate-500">{t.horseProfileHint}</p>
                </div>
                <button
                  type="button"
                  data-testid="toggle-horse-profile-btn"
                  aria-expanded={isProfileOpen}
                  onClick={() => setIsProfileOpen((v) => !v)}
                  className="lg:hidden shrink-0 min-h-[40px] inline-flex items-center gap-1 px-3 rounded-lg bg-[#2B4C3F]/10 text-[#2B4C3F] text-xs font-semibold cursor-pointer"
                >
                  <span>{isProfileOpen ? t.hideProfile : t.editProfile}</span>
                  {isProfileOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div
                data-testid="horse-profile-form"
                className={`${isProfileOpen ? '' : 'hidden lg:block '}space-y-3 border-t border-slate-200 pt-4`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {profileFields.map(({ key, label }) => (
                    <label key={key} className="block">
                      <span className="block font-medium text-slate-600 mb-1">{label}</span>
                      <input
                        type="text"
                        value={String(selectedHorse[key] ?? '')}
                        onChange={(e) =>
                          void onUpdateHorse({ ...selectedHorse, [key]: e.target.value })
                        }
                        className={FIELD_INPUT}
                      />
                    </label>
                  ))}
                </div>

                <label className="block text-xs">
                  <span className="block font-medium text-slate-600 mb-1">{t.horseNotesLabel}</span>
                  <textarea
                    rows={2}
                    value={selectedHorse.notes}
                    onChange={(e) =>
                      void onUpdateHorse({ ...selectedHorse, notes: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-[#FAF9F6] p-2.5"
                  />
                </label>

                {!selectedHorse.isDemo && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      data-testid="delete-horse-btn"
                      onClick={() => void onDeleteHorse(selectedHorse.id)}
                      className="min-h-[40px] inline-flex items-center gap-1.5 px-3 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-medium cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t.deleteHorse}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            {t.noHorsesHint}
          </div>
        )}
      </div>
    </div>
  );
};
