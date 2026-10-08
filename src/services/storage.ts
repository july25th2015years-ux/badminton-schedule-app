import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import type { PracticeEvent, Attendance, SlotStatus, MonthlyNote, LocationPreset } from '../types';
import { initializeOctoberMigration } from '../utils/migration';
import { octoberSchedule, capturedAt } from '../data/october2026';

function ensureOctoberMigration() {
  initializeOctoberMigration(localStorage, octoberSchedule, capturedAt);
}

const STORAGE_KEYS = {
  EVENTS: 'badminton_events',
  ATTENDANCES: 'badminton_attendances',
  USER_NAME: 'badminton_user_name',
  MONTHLY_NOTES: 'badminton_monthly_notes',
  LOCATIONS: 'badminton_location_presets',
};

// サンプルの初期データ生成（今月の日程）
function getInitialSampleEvents(): PracticeEvent[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // 来週末などの日程を2件生成
  const day1 = Math.min(10, new Date(year, now.getMonth() + 1, 0).getDate());
  const day2 = Math.min(24, new Date(year, now.getMonth() + 1, 0).getDate());

  const date1Str = `${year}-${month}-${String(day1).padStart(2, '0')}`;
  const date2Str = `${year}-${month}-${String(day2).padStart(2, '0')}`;

  return [
    {
      id: 'sample-event-1',
      date: date1Str,
      startTime: '19:00',
      endTime: '21:00',
      location: 'スポーツパーク川副',
      mapUrl: 'https://maps.app.goo.gl/n3ZRedeMvSsXP6Lm6',
      courtCount: '2面',
      notes: '基礎打ち＆ダブルスゲーム中心。会費500円（シャトル代込）',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'sample-event-2',
      date: date2Str,
      startTime: '18:00',
      endTime: '21:00',
      location: 'スポーツパーク川副',
      mapUrl: 'https://maps.app.goo.gl/n3ZRedeMvSsXP6Lm6',
      courtCount: '3面',
      notes: '初心者から経験者まで歓迎！ラケット貸出可能。',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

function getInitialSampleAttendances(): Attendance[] {
  return [
    {
      id: 'sample-event-1_田中',
      eventId: 'sample-event-1',
      userName: '田中',
      morningStatus: 'circle',
      afternoonStatus: 'circle',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'sample-event-1_佐藤',
      eventId: 'sample-event-1',
      userName: '佐藤',
      morningStatus: 'triangle',
      morningCondition: '10:00から合流',
      afternoonStatus: 'circle',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'sample-event-1_鈴木',
      eventId: 'sample-event-1',
      userName: '鈴木',
      morningStatus: 'circle',
      afternoonStatus: 'none',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'sample-event-2_田中',
      eventId: 'sample-event-2',
      userName: '田中',
      morningStatus: 'circle',
      afternoonStatus: 'circle',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'sample-event-2_高橋',
      eventId: 'sample-event-2',
      userName: '高橋',
      morningStatus: 'none',
      afternoonStatus: 'triangle',
      afternoonCondition: '15:30早退予定',
      updatedAt: new Date().toISOString(),
    },
  ];
}

// LocalStorageの読み込み
function getLocalEvents(): PracticeEvent[] {
  ensureOctoberMigration();
  const raw = localStorage.getItem(STORAGE_KEYS.EVENTS);
  if (raw === null) {
    const samples = getInitialSampleEvents();
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(samples));
    return samples;
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getLocalAttendances(): Attendance[] {
  ensureOctoberMigration();
  const raw = localStorage.getItem(STORAGE_KEYS.ATTENDANCES);
  if (raw === null) {
    const samples = getInitialSampleAttendances();
    localStorage.setItem(STORAGE_KEYS.ATTENDANCES, JSON.stringify(samples));
    return samples;
  }
  try {
    const list: Attendance[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    // 既存データの正規化
    return list.map(a => ({
      ...a,
      morningStatus: a.morningStatus || (a.status as any) || 'none',
      afternoonStatus: a.afternoonStatus || (a.status as any) || 'none',
      morningCondition: a.morningCondition || (a.status === 'triangle' ? a.condition : undefined),
      afternoonCondition: a.afternoonCondition || (a.status === 'triangle' ? a.condition : undefined),
    }));
  } catch {
    return [];
  }
}

export function resetToSampleData(): void {
  const samples = getInitialSampleEvents();
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(samples));
  const attSamples = getInitialSampleAttendances();
  localStorage.setItem(STORAGE_KEYS.ATTENDANCES, JSON.stringify(attSamples));
  emitSync();
}

// カスタムイベントでローカル購読者に即時通知
const SYNC_EVENT = 'badminton_local_sync';
const NOTES_SYNC_EVENT = 'badminton_notes_sync';
function emitSync() {
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

function getLocalMonthlyNotes(): MonthlyNote[] {
  ensureOctoberMigration();
  try {
    const notes = JSON.parse(localStorage.getItem(STORAGE_KEYS.MONTHLY_NOTES) || '[]');
    return Array.isArray(notes) ? notes : [];
  } catch {
    return [];
  }
}

export function subscribeToMonthlyNotes(callback: (notes: MonthlyNote[]) => void): () => void {
  if (isFirebaseConfigured && db) {
    return onSnapshot(collection(db, 'monthlyNotes'), snapshot => {
      callback(snapshot.docs.map(note => ({ ...note.data(), id: note.id } as MonthlyNote)));
    }, () => callback(getLocalMonthlyNotes()));
  }
  const handler = () => callback(getLocalMonthlyNotes());
  handler();
  window.addEventListener(SYNC_EVENT, handler);
  window.addEventListener(NOTES_SYNC_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(SYNC_EVENT, handler);
    window.removeEventListener(NOTES_SYNC_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

export async function saveMonthlyNote(month: string, userName: string, note: string): Promise<void> {
  const name = userName.trim();
  if (!name || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || note.length > 500) {
    throw new Error('名前、対象月、備考の長さを確認してください');
  }
  const payload: MonthlyNote = {
    id: `${month}_${name}`, month, userName: name, note, updatedAt: new Date().toISOString(),
  };
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, 'monthlyNotes', payload.id), payload);
    return;
  }
  const notes = getLocalMonthlyNotes().filter(item => item.id !== payload.id);
  localStorage.setItem(STORAGE_KEYS.MONTHLY_NOTES, JSON.stringify([...notes, payload]));
  window.dispatchEvent(new CustomEvent(NOTES_SYNC_EVENT));
}

// ユーザー名保存・取得
export function getStoredUserName(): string {
  return localStorage.getItem(STORAGE_KEYS.USER_NAME) || '';
}

export function setStoredUserName(name: string): void {
  localStorage.setItem(STORAGE_KEYS.USER_NAME, name.trim());
}

/**
 * Firestoreはundefinedを受け付けないため、undefined値を除外する
 */
function cleanForFirestore<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

let isInitialSeedDone = false;
async function seedInitialFirestoreData() {
  if (isInitialSeedDone || !isFirebaseConfigured || !db) return;
  isInitialSeedDone = true;
  const firestore = db;
  try {
    const sampleEvents = getInitialSampleEvents();
    const sampleAttendances = getInitialSampleAttendances();
    const batch = writeBatch(firestore);
    sampleEvents.forEach(ev => {
      const docRef = doc(firestore, 'events', ev.id);
      batch.set(docRef, cleanForFirestore(ev), { merge: true });
    });
    sampleAttendances.forEach(att => {
      const docRef = doc(firestore, 'attendances', att.id);
      batch.set(docRef, cleanForFirestore(att), { merge: true });
    });
    await batch.commit();
  } catch (err) {
    console.error('Failed to seed initial Firestore data:', err);
  }
}

/**
 * 練習会イベントの一覧購読
 */
export function subscribeToEvents(callback: (events: PracticeEvent[]) => void): () => void {
  if (isFirebaseConfigured && db) {
    const eventsRef = collection(db, 'events');
    const unsubscribe = onSnapshot(eventsRef, (snapshot) => {
      if (snapshot.empty) {
        seedInitialFirestoreData();
      }
      const list: PracticeEvent[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data(), id: doc.id } as PracticeEvent);
      });
      list.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
      callback(list);
    }, (err) => {
      console.error('Firestore events sync error, falling back to local:', err);
      callback(getLocalEvents());
    });
    return unsubscribe;
  }

  // LocalStorage モード
  const handler = () => {
    const events = getLocalEvents();
    events.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    callback(events);
  };

  handler();
  window.addEventListener(SYNC_EVENT, handler);
  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener(SYNC_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

/**
 * 出欠一覧購読
 */
export function subscribeToAttendances(callback: (attendances: Attendance[]) => void): () => void {
  if (isFirebaseConfigured && db) {
    const attendancesRef = collection(db, 'attendances');
    const unsubscribe = onSnapshot(attendancesRef, (snapshot) => {
      const list: Attendance[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Attendance;
        list.push({
          ...data,
          id: doc.id,
          morningStatus: data.morningStatus || (data.status as any) || 'none',
          afternoonStatus: data.afternoonStatus || (data.status as any) || 'none',
        });
      });
      callback(list);
    }, (err) => {
      console.error('Firestore attendances sync error, falling back to local:', err);
      callback(getLocalAttendances());
    });
    return unsubscribe;
  }

  // LocalStorage モード
  const handler = () => {
    callback(getLocalAttendances());
  };

  handler();
  window.addEventListener(SYNC_EVENT, handler);
  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener(SYNC_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

/**
 * 練習会イベントの保存（新規または更新）
 */
export async function saveEvent(eventData: Omit<PracticeEvent, 'id' | 'createdAt' | 'updatedAt'>, id?: string): Promise<string> {
  const eventId = id || 'event_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();

  if (isFirebaseConfigured && db) {
    const docRef = doc(db, 'events', eventId);
    await setDoc(docRef, cleanForFirestore({
      ...eventData,
      createdAt: now,
      updatedAt: now,
    }), { merge: true });
    return eventId;
  }

  // LocalStorage
  const events = getLocalEvents();
  const existingIndex = events.findIndex(e => e.id === eventId);
  const fullEvent: PracticeEvent = {
    ...eventData,
    id: eventId,
    createdAt: existingIndex >= 0 ? events[existingIndex].createdAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    events[existingIndex] = fullEvent;
  } else {
    events.push(fullEvent);
  }

  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
  emitSync();
  return eventId;
}

/**
 * 練習会イベントの削除
 * ※個人の出欠一覧の回答は削除せず、開催日（eventDate）に引き継いで維持する
 */
export async function deleteEvent(eventId: string, eventDateParam?: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    const firestore = db;
    const docRef = doc(firestore, 'events', eventId);
    let eventDate = eventDateParam;
    if (!eventDate) {
      try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          eventDate = snap.data()?.date;
        }
      } catch (err) {
        console.warn('Failed to fetch event date before deletion:', err);
      }
    }

    // イベント情報のみを削除
    await deleteDoc(docRef);

    // 個人の出欠予定は絶対に削除しない！
    // 該当イベントに紐づく出欠がある場合は、開催日（eventDate）に引き継ぎ・付け替え
    if (eventDate) {
      try {
        const attQuery = query(collection(firestore, 'attendances'), where('eventId', '==', eventId));
        const attSnap = await getDocs(attQuery);
        if (!attSnap.empty) {
          const batch = writeBatch(firestore);
          attSnap.forEach(d => {
            const data = d.data() as Attendance;
            const newId = `${eventDate}_${data.userName.trim()}`;
            const newDocRef = doc(firestore, 'attendances', newId);
            batch.set(newDocRef, cleanForFirestore({
              ...data,
              id: newId,
              eventId: eventDate,
              updatedAt: new Date().toISOString()
            }), { merge: true });

            if (d.id !== newId) {
              batch.delete(d.ref);
            }
          });
          await batch.commit();
        }
      } catch (err) {
        console.error('Failed to migrate attendances to date on event delete:', err);
      }
    }
    return;
  }

  // LocalStorage モード
  const localEvents = getLocalEvents();
  const targetEvent = localEvents.find(e => e.id === eventId);
  const eventDate = eventDateParam || targetEvent?.date;

  // イベント情報のみを削除
  const events = localEvents.filter(e => e.id !== eventId);
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));

  // 個人の出欠予定は削除せず維持（eventId を eventDate に更新）
  const localAttendances = getLocalAttendances();
  const updatedAttendances = localAttendances.map(a => {
    if (a.eventId === eventId && eventDate) {
      return {
        ...a,
        id: `${eventDate}_${a.userName.trim()}`,
        eventId: eventDate,
        updatedAt: new Date().toISOString()
      };
    }
    return a;
  });
  localStorage.setItem(STORAGE_KEYS.ATTENDANCES, JSON.stringify(updatedAttendances));

  emitSync();
}

/**
 * 出欠の保存（午前・午後対応）
 */
export async function saveAttendance(attData: Omit<Attendance, 'id' | 'updatedAt'>): Promise<void> {
  const id = `${attData.eventId}_${attData.userName.trim()}`;
  const now = new Date().toISOString();
  const payload: Attendance = {
    ...attData,
    id,
    userName: attData.userName.trim(),
    updatedAt: now,
  };

  if (isFirebaseConfigured && db) {
    const docRef = doc(db, 'attendances', id);
    await setDoc(docRef, cleanForFirestore(payload), { merge: true });
    return;
  }

  // LocalStorage
  const list = getLocalAttendances();
  const idx = list.findIndex(a => a.eventId === attData.eventId && a.userName === attData.userName.trim());
  if (idx >= 0) {
    list[idx] = payload;
  } else {
    list.push(payload);
  }

  localStorage.setItem(STORAGE_KEYS.ATTENDANCES, JSON.stringify(list));
  emitSync();
}

/**
 * 複数イベントの出欠一括保存
 */
export async function saveBulkAttendances(attendances: Omit<Attendance, 'id' | 'updatedAt'>[]): Promise<void> {
  if (attendances.length === 0) return;
  const now = new Date().toISOString();

  if (isFirebaseConfigured && db) {
    const firestore = db;
    const batch = writeBatch(firestore);
    attendances.forEach(att => {
      const id = `${att.eventId}_${att.userName.trim()}`;
      const docRef = doc(firestore, 'attendances', id);
      batch.set(docRef, cleanForFirestore({
        ...att,
        id,
        userName: att.userName.trim(),
        updatedAt: now,
      }), { merge: true });
    });
    await batch.commit();
    return;
  }

  // LocalStorage
  const list = getLocalAttendances();
  attendances.forEach(att => {
    const id = `${att.eventId}_${att.userName.trim()}`;
    const payload: Attendance = {
      ...att,
      id,
      userName: att.userName.trim(),
      updatedAt: now,
    };
    const idx = list.findIndex(a => a.eventId === att.eventId && a.userName === att.userName.trim());
    if (idx >= 0) {
      list[idx] = payload;
    } else {
      list.push(payload);
    }
  });

  localStorage.setItem(STORAGE_KEYS.ATTENDANCES, JSON.stringify(list));
  emitSync();
}

/**
 * 特定ユーザーの当月全日程に対する出欠を一括保存・更新（削除・変更の完全同期）
 * @param userName 対象ユーザー名
 * @param targetDays 当月の全日程情報
 * @param events 登録済みのイベント一覧
 * @param slotsMap 各日付の出欠入力スロット
 */
export async function saveUserMonthBulkAttendances(
  userName: string,
  targetDays: { date: string }[],
  events: PracticeEvent[],
  slotsMap: { [dateStr: string]: { morningStatus: SlotStatus; morningCondition: string; afternoonStatus: SlotStatus; afternoonCondition: string } }
): Promise<void> {
  const trimmedName = userName.trim();
  if (!trimmedName) return;

  const now = new Date().toISOString();

  // 対象月に含まれるすべての関連イベントID（日付文字列 & 登録済みイベントID）
  const allTargetEventIds = new Set<string>();
  targetDays.forEach(day => {
    allTargetEventIds.add(day.date);
    const ev = events.find(e => e.date === day.date);
    if (ev) allTargetEventIds.add(ev.id);
  });

  // 有効な（◯または△がある）新規保存用リスト
  const validAttendances: Attendance[] = [];
  targetDays.forEach(day => {
    const slot = slotsMap[day.date];
    if (slot && (slot.morningStatus !== 'none' || slot.afternoonStatus !== 'none')) {
      // 出欠は練習会の有無に関わらず、日付（day.date）に紐づけて保存
      // これにより、練習会が追加・削除・変更されても個人の予定が影響を受けない
      const targetId = day.date;
      const id = `${targetId}_${trimmedName}`;
      validAttendances.push({
        id,
        eventId: targetId,
        userName: trimmedName,
        morningStatus: slot.morningStatus,
        morningCondition: slot.morningStatus === 'triangle' ? slot.morningCondition.trim() : undefined,
        afternoonStatus: slot.afternoonStatus,
        afternoonCondition: slot.afternoonStatus === 'triangle' ? slot.afternoonCondition.trim() : undefined,
        updatedAt: now,
      });
    }
  });

  if (isFirebaseConfigured && db) {
    const firestore = db;
    const batch = writeBatch(firestore);

    // 1. このユーザーの該当月関連ドキュメントをすべて削除
    allTargetEventIds.forEach(targetId => {
      const docId = `${targetId}_${trimmedName}`;
      const docRef = doc(firestore, 'attendances', docId);
      batch.delete(docRef);
    });

    // 2. 有効な出席データを新規書き込み
    validAttendances.forEach(att => {
      const docRef = doc(firestore, 'attendances', att.id);
      batch.set(docRef, cleanForFirestore(att));
    });

    await batch.commit();
    return;
  }

  // LocalStorage モード
  const currentList = getLocalAttendances();
  // このユーザーかつ該当月に関連する全レコードを除外（削除・変更の完全反映）
  const filtered = currentList.filter(a => {
    const isSameUser = a.userName.trim().toLowerCase() === trimmedName.toLowerCase();
    const isTargetMonth = allTargetEventIds.has(a.eventId);
    return !(isSameUser && isTargetMonth);
  });

  // 有効な新しい出欠レコードを追加
  const updatedList = [...filtered, ...validAttendances];
  localStorage.setItem(STORAGE_KEYS.ATTENDANCES, JSON.stringify(updatedList));
  emitSync();
}

/**
 * 出欠の取り消し・削除
 */
export async function deleteAttendance(eventId: string, userName: string): Promise<void> {
  const id = `${eventId}_${userName.trim()}`;

  if (isFirebaseConfigured && db) {
    const docRef = doc(db, 'attendances', id);
    await deleteDoc(docRef);
    return;
  }

  // LocalStorage
  const list = getLocalAttendances().filter(
    a => !(a.eventId === eventId && a.userName.toLowerCase() === userName.trim().toLowerCase())
  );
  localStorage.setItem(STORAGE_KEYS.ATTENDANCES, JSON.stringify(list));
  emitSync();
}

/**
 * 開催場所の初期プリセット
 */
export function getInitialLocationPresets(): LocationPreset[] {
  return [
    {
      id: 'loc_kawaso',
      name: 'スポーツパーク川副',
      mapUrl: 'https://maps.app.goo.gl/n3ZRedeMvSsXP6Lm6',
      isDefault: true,
    },
  ];
}

/**
 * ローカルストレージの開催場所プリセット取得
 */
export function getLocalLocations(): LocationPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCATIONS);
    if (!raw) {
      const initial = getInitialLocationPresets();
      localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : getInitialLocationPresets();
  } catch {
    return getInitialLocationPresets();
  }
}

/**
 * 開催場所プリセットの購読（リアルタイム同期）
 */
export function subscribeToLocations(callback: (locations: LocationPreset[]) => void): () => void {
  if (isFirebaseConfigured && db) {
    const firestore = db;
    const locRef = collection(firestore, 'locations');
    const unsubscribe = onSnapshot(locRef, (snapshot) => {
      if (snapshot.empty) {
        // 初期データを投入
        const initial = getInitialLocationPresets();
        const batch = writeBatch(firestore);
        initial.forEach(locItem => {
          const docRef = doc(firestore, 'locations', locItem.id);
          batch.set(docRef, cleanForFirestore(locItem), { merge: true });
        });
        batch.commit().catch(console.error);
        callback(initial);
        return;
      }
      const list: LocationPreset[] = [];
      snapshot.forEach(docSnap => {
        list.push({ ...docSnap.data(), id: docSnap.id } as LocationPreset);
      });
      // デフォルト優先、以降は名前順
      list.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || a.name.localeCompare(b.name));
      callback(list);
    }, (err) => {
      console.error('Firestore locations sync error, fallback to local:', err);
      callback(getLocalLocations());
    });
    return unsubscribe;
  }

  // LocalStorage モード
  const handler = () => {
    callback(getLocalLocations());
  };
  handler();
  window.addEventListener(SYNC_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(SYNC_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

/**
 * 開催場所プリセットの保存（新規または更新）
 */
export async function saveLocation(
  locationData: Omit<LocationPreset, 'id' | 'createdAt'>,
  id?: string
): Promise<string> {
  const locId = id || 'loc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();
  const payload: LocationPreset = {
    ...locationData,
    id: locId,
    createdAt: now,
  };

  if (isFirebaseConfigured && db) {
    const docRef = doc(db, 'locations', locId);
    await setDoc(docRef, cleanForFirestore(payload), { merge: true });
    return locId;
  }

  const list = getLocalLocations();
  const idx = list.findIndex(l => l.id === locId);
  if (idx >= 0) {
    list[idx] = payload;
  } else {
    list.push(payload);
  }
  localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(list));
  emitSync();
  return locId;
}

/**
 * 開催場所プリセットの削除
 */
export async function deleteLocation(id: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    const docRef = doc(db, 'locations', id);
    await deleteDoc(docRef);
    return;
  }

  const list = getLocalLocations().filter(l => l.id !== id);
  localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(list));
  emitSync();
}

