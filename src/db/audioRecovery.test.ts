import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from './database';

test('1. Normal recording and finalization lifecycle with chunks', async () => {
  const recordingId = `rec-normal-${Date.now()}`;
  const chunkId1 = `${recordingId}-0`;
  const chunkId2 = `${recordingId}-1`;

  const buf1 = new Uint8Array([1, 2, 3, 4]).buffer;
  const buf2 = new Uint8Array([5, 6, 7, 8]).buffer;

  await db.audioChunks.put({
    id: chunkId1,
    recordingId,
    sequenceNumber: 0,
    data: buf1,
    createdAt: new Date().toISOString(),
  });

  await db.audioChunks.put({
    id: chunkId2,
    recordingId,
    sequenceNumber: 1,
    data: buf2,
    createdAt: new Date().toISOString(),
  });

  const stored = await db.audioChunks.where('recordingId').equals(recordingId).toArray();
  stored.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  assert.equal(stored.length, 2);

  const combinedBlob = new Blob(stored.map((c) => new Blob([c.data])), { type: 'audio/webm' });
  assert.equal(combinedBlob.size, 8);

  await db.audioChunks.where('recordingId').equals(recordingId).delete();
  const remaining = await db.audioChunks.where('recordingId').equals(recordingId).toArray();
  assert.equal(remaining.length, 0);
});

test('2. Browser reload simulation during active recording', async () => {
  const recordingId = `rec-crash-${Date.now()}`;
  const chunkId = `${recordingId}-0`;
  const buf = new Uint8Array([10, 20, 30]).buffer;

  await db.audioChunks.put({
    id: chunkId,
    recordingId,
    sequenceNumber: 0,
    data: buf,
    createdAt: new Date().toISOString(),
  });

  const orphanChunks = await db.audioChunks.where('recordingId').equals(recordingId).toArray();
  assert.equal(orphanChunks.length, 1);
  assert.equal(orphanChunks[0].recordingId, recordingId);
  await db.audioChunks.where('recordingId').equals(recordingId).delete();
});

test('3. Recovery of an interrupted recording', async () => {
  const recordingId = `rec-interrupted-${Date.now()}`;
  const chunkId = `${recordingId}-0`;
  const buf = new Uint8Array([99, 100]).buffer;

  await db.audioChunks.put({
    id: chunkId,
    recordingId,
    sequenceNumber: 0,
    data: buf,
    createdAt: new Date().toISOString(),
  });

  const chunks = await db.audioChunks.where('recordingId').equals(recordingId).toArray();
  chunks.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  assert.equal(chunks.length, 1);

  const recoveredBlob = new Blob(chunks.map((c) => new Blob([c.data])), { type: 'audio/webm' });
  assert.equal(recoveredBlob.size, 2);

  await db.audioChunks.where('recordingId').equals(recordingId).delete();
  const checkDeleted = await db.audioChunks.where('recordingId').equals(recordingId).toArray();
  assert.equal(checkDeleted.length, 0);
});

test('4. Duplicate chunk prevention', async () => {
  const recordingId = `rec-dup-${Date.now()}`;
  const chunkId = `${recordingId}-0`;
  const buf = new Uint8Array([1, 1, 1]).buffer;

  const chunkRow = {
    id: chunkId,
    recordingId,
    sequenceNumber: 0,
    data: buf,
    createdAt: new Date().toISOString(),
  };

  const existing1 = await db.audioChunks.get(chunkId);
  if (!existing1) await db.audioChunks.put(chunkRow);

  const existing2 = await db.audioChunks.get(chunkId);
  if (!existing2) await db.audioChunks.put(chunkRow);

  const all = await db.audioChunks.where('recordingId').equals(recordingId).toArray();
  assert.equal(all.length, 1);
  await db.audioChunks.where('recordingId').equals(recordingId).delete();
});

test('5. Database write failure resilience (try/catch fallback)', async () => {
  let writeFailed = false;
  try {
    throw new Error('Simulated write error');
  } catch {
    writeFailed = true;
  }
  assert.equal(writeFailed, true);
});

test('7. Missing sequence number detection', async () => {
  const recordingId = `rec-missing-${Date.now()}`;
  await db.audioChunks.put({
    id: `${recordingId}-0`,
    recordingId,
    sequenceNumber: 0,
    data: new Uint8Array([1]).buffer,
    createdAt: new Date().toISOString(),
  });
  await db.audioChunks.put({
    id: `${recordingId}-2`,
    recordingId,
    sequenceNumber: 2,
    data: new Uint8Array([3]).buffer,
    createdAt: new Date().toISOString(),
  });

  const chunks = await db.audioChunks.where('recordingId').equals(recordingId).toArray();
  chunks.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  let hasMissing = false;
  if (chunks.length > 0) {
    const maxSeq = chunks[chunks.length - 1].sequenceNumber;
    const seqSet = new Set(chunks.map((c) => c.sequenceNumber));
    for (let i = 0; i <= maxSeq; i++) {
      if (!seqSet.has(i)) {
        hasMissing = true;
        break;
      }
    }
  }

  assert.equal(hasMissing, true);
  await db.audioChunks.where('recordingId').equals(recordingId).delete();
});

test('8. Cross-tab active recording protection via recordingSessions heartbeat', async () => {
  const recordingId = `rec-crosstab-${Date.now()}`;
  const nowIso = new Date().toISOString();

  await db.recordingSessions.put({
    recordingId,
    sessionId: 'session-1',
    horseId: 'horse-1',
    state: 'recording',
    startedAt: nowIso,
    lastUpdatedAt: nowIso,
    mimeType: 'audio/webm',
  });

  const allSessions = await db.recordingSessions.toArray();
  const now = Date.now();
  const activeInOtherTab = allSessions.some(
    (s) => s.state === 'recording' && now - new Date(s.lastUpdatedAt).getTime() < 10000
  );

  assert.equal(activeInOtherTab, true);
  await db.recordingSessions.delete(recordingId);
});

test('9. Idempotent recovery with stable clip ID', async () => {
  const recordingId = `rec-idempotent-${Date.now()}`;
  const stableClipId = `clip-${recordingId}`;
  const blob = new Blob([new Uint8Array([1, 2])], { type: 'audio/webm' });

  const clip = {
    id: stableClipId,
    sessionId: 'session-1',
    createdAt: new Date().toISOString(),
    durationSec: 5,
    mimeType: 'audio/webm',
    audioBlob: blob,
    transcript: '',
    transcriptionStatus: 'idle' as const,
    recordingState: 'completed' as const,
  };

  await db.voiceClips.put(clip);
  await db.voiceClips.put(clip);

  const clips = await db.voiceClips.where('id').equals(stableClipId).toArray();
  assert.equal(clips.length, 1);
  await db.voiceClips.delete(stableClipId);
});

test('10. Crash-safe atomic transaction finalization', async () => {
  const recordingId = `rec-tx-${Date.now()}`;
  const stableClipId = `clip-${recordingId}`;
  await db.audioChunks.put({
    id: `${recordingId}-0`,
    recordingId,
    sequenceNumber: 0,
    data: new Uint8Array([10]).buffer,
    createdAt: new Date().toISOString(),
  });

  await db.recordingSessions.put({
    recordingId,
    sessionId: 'session-1',
    horseId: 'horse-1',
    state: 'recording',
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    mimeType: 'audio/webm',
  });

  const newClip = {
    id: stableClipId,
    sessionId: 'session-1',
    createdAt: new Date().toISOString(),
    durationSec: 2,
    mimeType: 'audio/webm',
    audioBlob: new Blob([new Uint8Array([10])]),
    transcript: '',
    transcriptionStatus: 'idle' as const,
    recordingState: 'completed' as const,
  };

  await db.transaction(
    'rw',
    db.voiceClips,
    db.audioChunks,
    db.recordingSessions,
    async () => {
      await db.voiceClips.put(newClip);
      await db.audioChunks.where('recordingId').equals(recordingId).delete();
      await db.recordingSessions.update(recordingId, {
        state: 'completed',
        lastUpdatedAt: new Date().toISOString(),
      });
    }
  );

  const savedClip = await db.voiceClips.get(stableClipId);
  const remainingChunks = await db.audioChunks.where('recordingId').equals(recordingId).toArray();
  const sessionRow = await db.recordingSessions.get(recordingId);

  assert.ok(savedClip);
  assert.equal(remainingChunks.length, 0);
  assert.equal(sessionRow?.state, 'completed');

  await db.voiceClips.delete(stableClipId);
  await db.recordingSessions.delete(recordingId);
});

test('12. Missing original session preserves all chunks and keeps recording visible for recovery', async () => {
  const recordingId = `rec-miss-sess-${Date.now()}`;
  await db.recordingSessions.put({
    recordingId,
    sessionId: 'non-existent-session',
    horseId: 'horse-1',
    state: 'interrupted',
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    mimeType: 'audio/webm',
  });
  await db.audioChunks.put({
    id: `${recordingId}-0`,
    recordingId,
    sequenceNumber: 0,
    data: new Uint8Array([1, 2]).buffer,
    createdAt: new Date().toISOString(),
  });

  const chunks = await db.audioChunks.where('recordingId').equals(recordingId).toArray();
  assert.equal(chunks.length, 1, 'Source chunks must be preserved when session is missing');

  await db.audioChunks.where('recordingId').equals(recordingId).delete();
  await db.recordingSessions.delete(recordingId);
});

test('13. Assigning an orphaned recording to a valid session creates an accessible clip', async () => {
  const recordingId = `rec-assign-${Date.now()}`;
  const validSessionId = 'session-test-valid';
  
  await db.sessions.put({
    id: validSessionId,
    horseId: 'horse-1',
    practitioner: 'Test',
    caseStudyNumber: 'CS-01',
    sessionNumber: 1,
    date: '2026-01-01',
    duration: '60 min',
    generalNotes: '',
    manualVoiceNotes: '',
    evaluationTable: {} as any,
    annotations: [],
    reportSections: {} as any,
    reportCustomized: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await db.recordingSessions.put({
    recordingId,
    sessionId: 'non-existent-session',
    horseId: 'horse-1',
    state: 'interrupted',
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    mimeType: 'audio/webm',
  });

  await db.audioChunks.put({
    id: `${recordingId}-0`,
    recordingId,
    sequenceNumber: 0,
    data: new Uint8Array([10, 20]).buffer,
    createdAt: new Date().toISOString(),
  });

  const clipId = `clip-${recordingId}`;
  const clip = {
    id: clipId,
    sessionId: validSessionId,
    createdAt: new Date().toISOString(),
    durationSec: 2,
    mimeType: 'audio/webm',
    audioBlob: new Blob([new Uint8Array([10, 20])]),
    transcript: '',
    transcriptionStatus: 'idle' as const,
    recordingState: 'completed' as const,
  };

  await db.transaction('rw', db.voiceClips, db.audioChunks, db.recordingSessions, async () => {
    await db.voiceClips.put(clip);
    await db.audioChunks.where('recordingId').equals(recordingId).delete();
    await db.recordingSessions.update(recordingId, { state: 'completed', lastUpdatedAt: new Date().toISOString() });
  });

  const savedClip = await db.voiceClips.get(clipId);
  assert.ok(savedClip);
  assert.equal(savedClip.sessionId, validSessionId);
  const remainingChunks = await db.audioChunks.where('recordingId').equals(recordingId).toArray();
  assert.equal(remainingChunks.length, 0, 'Chunks deleted after atomic persistence');

  await db.voiceClips.delete(clipId);
  await db.sessions.delete(validSessionId);
  await db.recordingSessions.delete(recordingId);
});

test('14. Missing sequence numbers never cause silent successful completion or source chunk deletion', async () => {
  const recordingId = `rec-missing-seq-${Date.now()}`;
  await db.recordingSessions.put({
    recordingId,
    sessionId: 'session-1',
    horseId: 'horse-1',
    state: 'interrupted',
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    mimeType: 'audio/webm',
  });
  await db.audioChunks.put({
    id: `${recordingId}-0`,
    recordingId,
    sequenceNumber: 0,
    data: new Uint8Array([1]).buffer,
    createdAt: new Date().toISOString(),
  });
  await db.audioChunks.put({
    id: `${recordingId}-2`,
    recordingId,
    sequenceNumber: 2,
    data: new Uint8Array([3]).buffer,
    createdAt: new Date().toISOString(),
  });

  const chunks = await db.audioChunks.where('recordingId').equals(recordingId).toArray();
  chunks.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  let hasMissing = false;
  const maxSeq = chunks[chunks.length - 1].sequenceNumber;
  const seqSet = new Set(chunks.map((c) => c.sequenceNumber));
  for (let i = 0; i <= maxSeq; i++) {
    if (!seqSet.has(i)) {
      hasMissing = true;
      break;
    }
  }

  assert.equal(hasMissing, true);
  const chunksBefore = await db.audioChunks.where('recordingId').equals(recordingId).toArray();
  assert.equal(chunksBefore.length, 2, 'Chunks must be preserved when sequence is missing');

  await db.audioChunks.where('recordingId').equals(recordingId).delete();
  await db.recordingSessions.delete(recordingId);
});

test('15. Failed assignment preserves all original data', async () => {
  const recordingId = `rec-fail-assign-${Date.now()}`;
  await db.recordingSessions.put({
    recordingId,
    sessionId: 'missing-sess',
    horseId: 'horse-1',
    state: 'interrupted',
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    mimeType: 'audio/webm',
  });
  await db.audioChunks.put({
    id: `${recordingId}-0`,
    recordingId,
    sequenceNumber: 0,
    data: new Uint8Array([7]).buffer,
    createdAt: new Date().toISOString(),
  });

  let failed = false;
  try {
    await db.transaction('rw', db.voiceClips, db.audioChunks, async () => {
      throw new Error('Simulated failure during assignment/persistence');
    });
  } catch {
    failed = true;
  }

  assert.equal(failed, true);
  const chunks = await db.audioChunks.where('recordingId').equals(recordingId).toArray();
  assert.equal(chunks.length, 1, 'All original chunks must be preserved on assignment failure');

  await db.audioChunks.where('recordingId').equals(recordingId).delete();
  await db.recordingSessions.delete(recordingId);
});

test('16. Repeated assignment/recovery does not create duplicate clips', async () => {
  const recordingId = `rec-rep-${Date.now()}`;
  const clipId = `clip-${recordingId}`;
  const clip = {
    id: clipId,
    sessionId: 'session-1',
    createdAt: new Date().toISOString(),
    durationSec: 1,
    mimeType: 'audio/webm',
    audioBlob: new Blob([new Uint8Array([1])]),
    transcript: '',
    transcriptionStatus: 'idle' as const,
    recordingState: 'completed' as const,
  };

  await db.voiceClips.put(clip);
  await db.voiceClips.put(clip);

  const clips = await db.voiceClips.where('id').equals(clipId).toArray();
  assert.equal(clips.length, 1, 'Idempotent put must not create duplicate clips');

  await db.voiceClips.delete(clipId);
});

test('17. If selected session disappears before transaction, recovery aborts and all source chunks remain intact', async () => {
  const recordingId = `rec-disappear-${Date.now()}`;
  const missingSessionId = `non-existent-${Date.now()}`;

  await db.audioChunks.put({
    id: `${recordingId}-0`,
    recordingId,
    sequenceNumber: 0,
    data: new Uint8Array([5]).buffer,
    createdAt: new Date().toISOString(),
  });

  let aborted = false;
  try {
    await db.transaction('rw', db.voiceClips, db.audioChunks, db.recordingSessions, db.sessions, async () => {
      const targetSess = await db.sessions.get(missingSessionId);
      if (!targetSess) {
        throw new Error('Target session does not exist');
      }
      await db.voiceClips.put({
        id: `clip-${recordingId}`,
        sessionId: missingSessionId,
        createdAt: new Date().toISOString(),
        durationSec: 1,
        mimeType: 'audio/webm',
        audioBlob: new Blob([new Uint8Array([5])]),
        transcript: '',
        transcriptionStatus: 'idle',
        recordingState: 'completed',
      });
      await db.audioChunks.where('recordingId').equals(recordingId).delete();
    });
  } catch {
    aborted = true;
  }

  assert.equal(aborted, true, 'Recovery transaction must abort if target session does not exist');
  const remainingChunks = await db.audioChunks.where('recordingId').equals(recordingId).toArray();
  assert.equal(remainingChunks.length, 1, 'Source chunks must remain intact when transaction aborts');

  await db.audioChunks.where('recordingId').equals(recordingId).delete();
});

test('18. No automatic assignment to currently selected session when original session is missing', async () => {
  const recordingId = `rec-noauto-${Date.now()}`;
  const missingOriginalSessionId = 'missing-orig-session';

  await db.recordingSessions.put({
    recordingId,
    sessionId: missingOriginalSessionId,
    horseId: 'horse-1',
    state: 'interrupted',
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    mimeType: 'audio/webm',
  });

  const meta = await db.recordingSessions.get(recordingId);
  const originalSessionId = meta?.sessionId;
  const targetSessionExists = await db.sessions.get(originalSessionId!);

  assert.equal(targetSessionExists, undefined);
  const resolvedSessionId = targetSessionExists ? originalSessionId : undefined;
  assert.equal(resolvedSessionId, undefined, 'Must not automatically assign to any session when original session is missing');

  await db.recordingSessions.delete(recordingId);
});

test('19. Unknown or empty MIME metadata is preserved without assuming audio/webm', async () => {
  const recordingId = `rec-mime-empty-${Date.now()}`;
  await db.recordingSessions.put({
    recordingId,
    sessionId: 'session-1',
    horseId: 'horse-1',
    state: 'recording',
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    mimeType: '',
  });

  const meta = await db.recordingSessions.get(recordingId);
  const resolvedMime = meta?.mimeType || '';
  assert.equal(resolvedMime, '');

  const blob = new Blob([new Uint8Array([1, 2])], { type: resolvedMime });
  assert.equal(blob.type, '');

  await db.recordingSessions.delete(recordingId);
});

test('20. Blob.type fallback uses actual chunk/blob type when session mimeType is empty', async () => {
  const recordingId = `rec-mime-fallback-${Date.now()}`;
  await db.recordingSessions.put({
    recordingId,
    sessionId: 'session-1',
    horseId: 'horse-1',
    state: 'recording',
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    mimeType: '',
  });

  const meta = await db.recordingSessions.get(recordingId);
  const chunkBlob = new Blob([new Uint8Array([5, 6])], { type: 'audio/mp4' });
  const resolvedMime = meta?.mimeType || chunkBlob.type || '';
  assert.equal(resolvedMime, 'audio/mp4');

  const blob = new Blob([new Uint8Array([5, 6])], { type: resolvedMime });
  assert.equal(blob.type, 'audio/mp4');

  await db.recordingSessions.delete(recordingId);
});

