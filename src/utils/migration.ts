import type { Attendance, MonthlyNote, PracticeEvent } from '../types/index.ts';

export const MIGRATED_MEMBERS = ['ヨッシー', 'ゆめ', 'ねりこ', 'ひびき', 'たに', 'ケロ', 'まき', 'かっとし', 'ここね'];
export const MIGRATED_MONTH = '2026-10';
export const MIGRATION_KEY = 'badminton_migration_workers_2026_10_v1';

export interface SourceSchedule {
  marks: { day: number; slot: string; member: string }[];
  notes: { member: string; note: string }[];
}

export function convertOctoberSchedule(source: SourceSchedule, capturedAt: string) {
  const unavailable = new Set<string>();
  for (const mark of source.marks) {
    if (!Number.isInteger(mark.day) || mark.day < 1 || mark.day > 31 ||
        !['AM', 'PM'].includes(mark.slot) || !MIGRATED_MEMBERS.includes(mark.member)) {
      throw new Error('移行元の出欠データが不正です');
    }
    unavailable.add(`${mark.day}_${mark.slot}_${mark.member}`);
  }
  const attendances: Attendance[] = [];
  for (let day = 1; day <= 31; day++) {
    const date = `${MIGRATED_MONTH}-${String(day).padStart(2, '0')}`;
    for (const userName of MIGRATED_MEMBERS) {
      attendances.push({
        id: `${date}_${userName}`, eventId: date, userName,
        morningStatus: unavailable.has(`${day}_AM_${userName}`) ? 'none' : 'circle',
        afternoonStatus: unavailable.has(`${day}_PM_${userName}`) ? 'none' : 'circle',
        updatedAt: capturedAt,
      });
    }
  }
  const notes: MonthlyNote[] = source.notes.map(item => {
    if (!MIGRATED_MEMBERS.includes(item.member) || typeof item.note !== 'string') {
      throw new Error('移行元の備考データが不正です');
    }
    return {
      id: `${MIGRATED_MONTH}_${item.member}`, month: MIGRATED_MONTH,
      userName: item.member, note: item.note, updatedAt: capturedAt,
    };
  });
  return { attendances, notes };
}

// Remove only the original demo events; user-edited events are retained.
function isUntouchedSampleEvent(event: PracticeEvent): boolean {
  const sample = event.id === 'sample-event-1'
    ? { startTime: '19:00', endTime: '21:00', courtCount: '2面', notes: '基礎打ち＆ダブルスゲーム中心。会費500円（シャトル代込）' }
    : event.id === 'sample-event-2'
    ? { startTime: '18:00', endTime: '21:00', courtCount: '3面', notes: '初心者から経験者まで歓迎！ラケット貸出可能。' }
    : null;
  return !!sample && event.location === 'スポーツパーク川副' &&
    event.date === `${MIGRATED_MONTH}-${event.id === 'sample-event-1' ? '10' : '24'}` &&
    event.mapUrl === 'https://maps.app.goo.gl/n3ZRedeMvSsXP6Lm6' &&
    event.startTime === sample.startTime && event.endTime === sample.endTime &&
    event.courtCount === sample.courtCount && event.notes === sample.notes;
}

function isSampleAttendance(att: Attendance): boolean {
  const samples: Record<string, [string, string, string?, string?]> = {
    'sample-event-1_田中': ['circle', 'circle'],
    'sample-event-1_佐藤': ['triangle', 'circle', '10:00から合流'],
    'sample-event-1_鈴木': ['circle', 'none'],
    'sample-event-2_田中': ['circle', 'circle'],
    'sample-event-2_高橋': ['none', 'triangle', undefined, '15:30早退予定'],
  };
  const sample = samples[att.id];
  return !!sample && att.id === `${att.eventId}_${att.userName}` &&
    att.morningStatus === sample[0] && att.afternoonStatus === sample[1] &&
    att.morningCondition === sample[2] && att.afternoonCondition === sample[3];
}

export function initializeOctoberMigration(storage: Pick<Storage, 'getItem' | 'setItem'>, source: SourceSchedule, capturedAt: string): void {
  if (storage.getItem(MIGRATION_KEY)) return;
  const keys = ['badminton_events', 'badminton_attendances', 'badminton_monthly_notes'] as const;
  const raw = keys.map(key => storage.getItem(key));
  const parsed = raw.map(value => {
    const result = value === null ? [] : JSON.parse(value);
    if (!Array.isArray(result)) throw new Error('既存データの形式を確認してください');
    return result;
  });
  const previousEvents: PracticeEvent[] = parsed[0];
  const previousAttendances: Attendance[] = parsed[1];
  // Keep a demo event if an associated response has been changed.
  const events = previousEvents.filter(event => !isUntouchedSampleEvent(event) ||
    previousAttendances.some(att => att.eventId === event.id && !isSampleAttendance(att)));
  const removedIds = new Set(previousEvents.filter(event => !events.includes(event)).map(event => event.id));
  const existingAttendances = previousAttendances.filter(att => !removedIds.has(att.eventId));
  const existingNotes: MonthlyNote[] = parsed[2];
  const converted = convertOctoberSchedule(source, capturedAt);
  const migratedAttendances = converted.attendances.flatMap(att => {
    const event = events.find(item => item.date === att.eventId);
    const eventId = event?.id || att.eventId;
    // Existing real answers take precedence over the imported snapshot.
    if (existingAttendances.some(item => item.userName === att.userName &&
        (item.eventId === att.eventId || item.eventId === eventId))) return [];
    return [{ ...att, eventId, id: `${eventId}_${att.userName}` }];
  });
  const migratedNotes = converted.notes.filter(note => !existingNotes.some(item => item.id === note.id));
  if (!storage.getItem(`${MIGRATION_KEY}_backup`)) {
    storage.setItem(`${MIGRATION_KEY}_backup`, JSON.stringify(Object.fromEntries(keys.map((key, i) => [key, raw[i]]))));
  }
  storage.setItem(keys[0], JSON.stringify(events));
  storage.setItem(keys[1], JSON.stringify([...existingAttendances, ...migratedAttendances]));
  storage.setItem(keys[2], JSON.stringify([...existingNotes, ...migratedNotes]));
  // Written last, so an interrupted migration can be safely resumed.
  storage.setItem(MIGRATION_KEY, capturedAt);
}
