import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import type { PracticeEvent, Attendance } from '../types';

const STORAGE_KEYS = {
  EVENTS: 'badminton_events',
  ATTENDANCES: 'badminton_attendances',
  USER_NAME: 'badminton_user_name',
};

// サンプルの初期データ生成（今月の日程）
function getInitialSampleEvents(): PracticeEvent[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // 来週末などの現実的な日程を2件生成
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
      status: 'circle',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'sample-event-1_佐藤',
      eventId: 'sample-event-1',
      userName: '佐藤',
      status: 'triangle',
      condition: '19:45から遅れて参加します',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'sample-event-1_鈴木',
      eventId: 'sample-event-1',
      userName: '鈴木',
      status: 'circle',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'sample-event-2_田中',
      eventId: 'sample-event-2',
      userName: '田中',
      status: 'circle',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'sample-event-2_高橋',
      eventId: 'sample-event-2',
      userName: '高橋',
      status: 'triangle',
      condition: '20:15早退予定です',
      updatedAt: new Date().toISOString(),
    },
  ];
}

// LocalStorageの読み込み
function getLocalEvents(): PracticeEvent[] {
  const raw = localStorage.getItem(STORAGE_KEYS.EVENTS);
  if (!raw) {
    const samples = getInitialSampleEvents();
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(samples));
    return samples;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function getLocalAttendances(): Attendance[] {
  const raw = localStorage.getItem(STORAGE_KEYS.ATTENDANCES);
  if (!raw) {
    const samples = getInitialSampleAttendances();
    localStorage.setItem(STORAGE_KEYS.ATTENDANCES, JSON.stringify(samples));
    return samples;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// カスタムイベントでローカル購読者に即時通知
const SYNC_EVENT = 'badminton_local_sync';
function emitSync() {
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

// ユーザー名保存・取得
export function getStoredUserName(): string {
  return localStorage.getItem(STORAGE_KEYS.USER_NAME) || '';
}

export function setStoredUserName(name: string): void {
  localStorage.setItem(STORAGE_KEYS.USER_NAME, name.trim());
}

/**
 * 練習会イベントの一覧購読
 */
export function subscribeToEvents(callback: (events: PracticeEvent[]) => void): () => void {
  if (isFirebaseConfigured && db) {
    const eventsRef = collection(db, 'events');
    const unsubscribe = onSnapshot(eventsRef, (snapshot) => {
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
        list.push({ ...doc.data(), id: doc.id } as Attendance);
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
    await setDoc(docRef, {
      ...eventData,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
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
 * 練習会イベントの削除（関連出欠も削除）
 */
export async function deleteEvent(eventId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    const docRef = doc(db, 'events', eventId);
    await deleteDoc(docRef);

    // 関連する出席データも削除
    const attQuery = query(collection(db, 'attendances'), where('eventId', '==', eventId));
    const attSnap = await getDocs(attQuery);
    const batch = writeBatch(db);
    attSnap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return;
  }

  // LocalStorage
  const events = getLocalEvents().filter(e => e.id !== eventId);
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));

  const attendances = getLocalAttendances().filter(a => a.eventId !== eventId);
  localStorage.setItem(STORAGE_KEYS.ATTENDANCES, JSON.stringify(attendances));

  emitSync();
}

/**
 * 出欠の保存（名前単位で登録・更新）
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
    await setDoc(docRef, payload, { merge: true });
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
