import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyEvaluationTable } from '../data/anatomicalAreas';
import { MORE_RELEASE_SIGNS, QUICK_RELEASE_CHIPS } from '../data/translations';
import { AreaSideObservation } from '../types';
import {
  bodyPartForRegionPolygon,
  countMarkedZoneSides,
  getAdjacentAreaId,
  toggleSignChip,
} from './zoneEditing';

const EMPTY: AreaSideObservation = {
  reaction: null,
  restriction: false,
  released: false,
  note: '',
};

describe('quick chip groups', () => {
  it('tags exactly Blink, Lip twitch and Fidgeting as response signs', () => {
    const response = QUICK_RELEASE_CHIPS.filter((c) => c.group === 'response').map((c) => c.id);
    const release = QUICK_RELEASE_CHIPS.filter((c) => c.group === 'release').map((c) => c.id);
    assert.deepEqual(response, ['blink_soft_eye', 'lip_twitch', 'fidgeting']);
    assert.deepEqual(release, [
      'lick_chew',
      'yawn',
      'snort_sneeze',
      'head_drop',
      'deep_sigh_shake',
    ]);
  });

  it('response chips record the sign without setting Released', () => {
    for (const chip of QUICK_RELEASE_CHIPS.filter((c) => c.group === 'response')) {
      const next = toggleSignChip(EMPTY, chip);
      assert.deepEqual(next.releaseSigns, [chip.en]);
      assert.equal(next.released, false, `${chip.id} must not set released`);
    }
  });

  it('release chips set Released', () => {
    for (const chip of QUICK_RELEASE_CHIPS.filter((c) => c.group === 'release')) {
      const next = toggleSignChip(EMPTY, chip);
      assert.deepEqual(next.releaseSigns, [chip.en]);
      assert.equal(next.released, true, `${chip.id} must set released`);
    }
  });

  it('More release signs keep auto-release', () => {
    const next = toggleSignChip(EMPTY, MORE_RELEASE_SIGNS[0]);
    assert.equal(next.released, true);
  });

  it('a response chip does not clear an existing Released flag', () => {
    const blink = QUICK_RELEASE_CHIPS[0];
    const next = toggleSignChip({ ...EMPTY, released: true }, blink);
    assert.equal(next.released, true);
  });

  it('removing a chip leaves Released as the practitioner set it', () => {
    const lick = QUICK_RELEASE_CHIPS.find((c) => c.id === 'lick_chew')!;
    const on = toggleSignChip(EMPTY, lick);
    const off = toggleSignChip(on, lick);
    assert.deepEqual(off.releaseSigns, []);
    assert.equal(off.released, true);
  });

  it('yawn starts its counter at 1 and drops it when removed', () => {
    const yawn = QUICK_RELEASE_CHIPS.find((c) => c.id === 'yawn')!;
    const on = toggleSignChip(EMPTY, yawn);
    assert.equal(on.yawnCount, 1);
    const off = toggleSignChip({ ...on, yawnCount: 3 }, yawn);
    assert.equal(off.yawnCount, undefined);
  });
});

describe('getAdjacentAreaId', () => {
  const ids = ['shoulder', 'withers', 'ribs'] as const;

  it('walks forward and backward in list order', () => {
    assert.equal(getAdjacentAreaId([...ids], 'shoulder', 1), 'withers');
    assert.equal(getAdjacentAreaId([...ids], 'ribs', -1), 'withers');
  });

  it('returns null at both ends', () => {
    assert.equal(getAdjacentAreaId([...ids], 'ribs', 1), null);
    assert.equal(getAdjacentAreaId([...ids], 'shoulder', -1), null);
  });

  it('returns null when the current area is not in the list', () => {
    assert.equal(getAdjacentAreaId([...ids], 'hock', 1), null);
  });
});

describe('bodyPartForRegionPolygon', () => {
  it('maps diagram regions to body-part filters', () => {
    assert.equal(bodyPartForRegionPolygon('head_poll', 0), 'head');
    assert.equal(bodyPartForRegionPolygon('neck_shoulder', 0), 'torso');
    assert.equal(bodyPartForRegionPolygon('back_torso', 0), 'torso');
    assert.equal(bodyPartForRegionPolygon('pelvis_hindquarters', 0), 'hind');
    assert.equal(bodyPartForRegionPolygon('limbs_joints', 0), 'front');
    assert.equal(bodyPartForRegionPolygon('limbs_joints', 1), 'hind');
  });
});

describe('countMarkedZoneSides', () => {
  it('counts each side that carries any observation', () => {
    const table = createEmptyEvaluationTable();
    assert.equal(countMarkedZoneSides(table), 0);
    table.neck.left = { ...EMPTY, reaction: 2 };
    table.neck.right = { ...EMPTY, note: '  ' };
    table.hock.right = { ...EMPTY, releaseSigns: ['Lip twitch'] };
    table.ribs.left = { ...EMPTY, note: 'tight' };
    assert.equal(countMarkedZoneSides(table), 3);
  });
});
