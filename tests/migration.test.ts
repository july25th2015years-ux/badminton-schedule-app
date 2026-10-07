import assert from 'node:assert/strict';
import test from 'node:test';
import { convertOctoberSchedule, initializeOctoberMigration, MIGRATION_KEY } from '../src/utils/migration.ts';
import type { SourceSchedule } from '../src/utils/migration.ts';

const capturedAt = '2026-10-07T13:00:00.000Z';
const source: SourceSchedule = {
  marks: [{ day: 7, slot: 'AM', member: 'ヨッシー' }, { day: 31, slot: 'PM', member: 'ゆめ' }],
  notes: [{ member: 'ねりこ', note: '予定の補足\n改行を保持' }, { member: 'ここね', note: '' }],
};
function memoryStorage(entries: Record<string, string> = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

test('October conversion keeps all 9 members, both slots and the original notes', () => {
  const converted = convertOctoberSchedule(source, capturedAt);
  assert.equal(converted.attendances.length, 279);
  assert.equal(new Set(converted.attendances.map(item => item.id)).size, 279);
  assert.ok(converted.attendances.every(item => item.eventId.startsWith('2026-10-')));
  const yosshy = converted.attendances.find(item => item.id === '2026-10-07_ヨッシー')!;
  assert.equal(yosshy.morningStatus, 'none');
  assert.equal(yosshy.afternoonStatus, 'circle');
  const yume = converted.attendances.find(item => item.id === '2026-10-31_ゆめ')!;
  assert.equal(yume.morningStatus, 'circle');
  assert.equal(yume.afternoonStatus, 'none');
  assert.equal(converted.notes[0].note, source.notes[0].note);
  assert.equal(converted.notes[1].note, '');
});

test('migration preserves real answers, other months and notes, and does not resurrect edited data', () => {
  const existing = [
    { id: 'real_ヨッシー', eventId: 'real', userName: 'ヨッシー', morningStatus: 'triangle', afternoonStatus: 'none' },
    { id: '2026-09-07_ヨッシー', eventId: '2026-09-07', userName: 'ヨッシー', morningStatus: 'circle', afternoonStatus: 'none' },
  ];
  const existingNotes = [{ id: '2026-10_ここね', month: '2026-10', userName: 'ここね', note: '新しい備考' }];
  const storage = memoryStorage({
    badminton_events: JSON.stringify([{ id: 'real', date: '2026-10-07' }]),
    badminton_attendances: JSON.stringify(existing),
    badminton_monthly_notes: JSON.stringify(existingNotes),
  });
  initializeOctoberMigration(storage, source, capturedAt);
  const attendees = JSON.parse(storage.getItem('badminton_attendances')!);
  assert.deepEqual(attendees.slice(0, 2), existing);
  assert.equal(attendees.filter((item: { eventId: string; userName: string }) => item.eventId === 'real' && item.userName === 'ヨッシー').length, 1);
  assert.equal(JSON.parse(storage.getItem('badminton_monthly_notes')!)[0].note, '新しい備考');
  const backup = JSON.parse(storage.getItem(`${MIGRATION_KEY}_backup`)!);
  assert.equal(backup.badminton_attendances, JSON.stringify(existing));
  storage.setItem('badminton_attendances', '[]');
  storage.setItem('badminton_monthly_notes', '[]');
  initializeOctoberMigration(storage, source, capturedAt);
  assert.equal(storage.getItem('badminton_attendances'), '[]');
  assert.equal(storage.getItem('badminton_monthly_notes'), '[]');
});

test('unchanged sample data is backed up and removed while user-edited demo events remain', () => {
  const sample = {
    id: 'sample-event-1', date: '2026-10-10', startTime: '19:00', endTime: '21:00',
    location: 'スポーツパーク川副', mapUrl: 'https://maps.app.goo.gl/n3ZRedeMvSsXP6Lm6',
    courtCount: '2面', notes: '基礎打ち＆ダブルスゲーム中心。会費500円（シャトル代込）',
  };
  const att = { id: 'sample-event-1_田中', eventId: 'sample-event-1', userName: '田中', morningStatus: 'circle', afternoonStatus: 'circle' };
  const storage = memoryStorage({ badminton_events: JSON.stringify([sample]), badminton_attendances: JSON.stringify([att]) });
  initializeOctoberMigration(storage, source, capturedAt);
  assert.equal(storage.getItem('badminton_events'), '[]');
  assert.ok(JSON.parse(storage.getItem('badminton_attendances')!).every((item: { userName: string }) => item.userName !== '田中'));
  assert.equal(JSON.parse(storage.getItem(`${MIGRATION_KEY}_backup`)!).badminton_events, JSON.stringify([sample]));

  const edited = memoryStorage({ badminton_events: JSON.stringify([{ ...sample, notes: '変更済み' }]), badminton_attendances: JSON.stringify([att]) });
  initializeOctoberMigration(edited, source, capturedAt);
  assert.equal(JSON.parse(edited.getItem('badminton_events')!)[0].notes, '変更済み');
  assert.ok(JSON.parse(edited.getItem('badminton_attendances')!).some((item: { userName: string }) => item.userName === '田中'));
});

test('invalid source or damaged existing data never overwrites stored content', () => {
  assert.throws(() => convertOctoberSchedule({ ...source, marks: [{ day: 32, slot: 'AM', member: 'ヨッシー' }] }, capturedAt));
  const storage = memoryStorage({ badminton_attendances: 'damaged-json' });
  assert.throws(() => initializeOctoberMigration(storage, source, capturedAt));
  assert.equal(storage.getItem('badminton_attendances'), 'damaged-json');
  assert.equal(storage.getItem(MIGRATION_KEY), null);
});
