import type { PracticeEvent, Attendance, AttendanceStats, AttendeeDetail } from '../types';

/**
 * Googleマップ検索URLを生成または取得
 */
export function getGoogleMapsUrl(location: string, customMapUrl?: string): string {
  if (customMapUrl && customMapUrl.trim().startsWith('http')) {
    return customMapUrl.trim();
  }
  const query = encodeURIComponent(location.trim());
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/**
 * 日本語曜日名
 */
export const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * YYYY-MM-DD から曜日（日本語）を取得
 */
export function getWeekdayJa(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return WEEKDAYS_JA[date.getDay()];
}

/**
 * 日付のフォーマット例: 2026-10-15 -> 10月15日(木)
 */
export function formatDateJa(dateString: string): string {
  const [, month, day] = dateString.split('-').map(Number);
  const weekday = getWeekdayJa(dateString);
  return `${month}月${day}日(${weekday})`;
}

/**
 * 年月フォーマット例: 2026年10月
 */
export function formatYearMonthJa(year: number, month: number): string {
  return `${year}年${month}月`;
}

/**
 * カレンダーのグリッドセル用インターフェース
 */
export interface CalendarDay {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: PracticeEvent[];
}

/**
 * 対象年月のカレンダーグリッド（日曜日〜土曜日）の日付一覧を生成
 */
export function getCalendarGrid(year: number, month: number, events: PracticeEvent[]): CalendarDay[] {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = new Date(year, month, 0);

  const startDayOfWeek = firstDayOfMonth.getDay(); // 0(日) - 6(土)
  const daysInMonth = lastDayOfMonth.getDate();

  // 前月末の日付
  const prevMonthLastDay = new Date(year, month - 1, 0).getDate();

  const grid: CalendarDay[] = [];

  // 前月のパディング
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    const prevMonthDate = new Date(year, month - 2, dayNum);
    const dateStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    grid.push({
      date: dateStr,
      dayNumber: dayNum,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      events: events.filter(e => e.date === dateStr),
    });
  }

  // 当月
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    grid.push({
      date: dateStr,
      dayNumber: day,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      events: events.filter(e => e.date === dateStr),
    });
  }

  // 翌月のパディング（合計マス数が7の倍数になるまで）
  const remainingCells = (7 - (grid.length % 7)) % 7;
  for (let day = 1; day <= remainingCells; day++) {
    const nextMonthDate = new Date(year, month, day);
    const dateStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    grid.push({
      date: dateStr,
      dayNumber: day,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      events: events.filter(e => e.date === dateStr),
    });
  }

  return grid;
}

/**
 * 出欠集計（午前・午後対応 & 過去データ互換 & 日付直接紐付け対応）
 */
export function getEventAttendanceStats(
  attendances: Attendance[],
  eventId: string,
  eventDate?: string
): AttendanceStats {
  const relevantIds = [eventId];
  if (eventDate && !relevantIds.includes(eventDate)) {
    relevantIds.push(eventDate);
  }

  const eventAttendances = attendances.filter(a => relevantIds.includes(a.eventId));

  const morningAttendees: AttendeeDetail[] = [];
  const afternoonAttendees: AttendeeDetail[] = [];
  const uniqueAttendeeNames = new Set<string>();

  // ユーザー名ごとにまとめる（eventIdとeventDateの重複登録対策）
  const userMap = new Map<string, Attendance>();
  eventAttendances.forEach(att => {
    const key = att.userName?.trim().toLowerCase();
    if (!key) return;
    const existing = userMap.get(key);
    if (!existing) {
      userMap.set(key, att);
    } else {
      userMap.set(key, {
        ...existing,
        morningStatus: (att.morningStatus && att.morningStatus !== 'none') ? att.morningStatus : existing.morningStatus,
        morningCondition: att.morningCondition || existing.morningCondition,
        afternoonStatus: (att.afternoonStatus && att.afternoonStatus !== 'none') ? att.afternoonStatus : existing.afternoonStatus,
        afternoonCondition: att.afternoonCondition || existing.afternoonCondition,
      });
    }
  });

  Array.from(userMap.values()).forEach(att => {
    // 過去データ（morningStatus未設定時）の互換処理
    const mStatus = att.morningStatus || (att.status as any) || 'none';
    const aStatus = att.afternoonStatus || (att.status as any) || 'none';
    const mCond = att.morningCondition || att.condition;
    const aCond = att.afternoonCondition || att.condition;

    if (mStatus === 'circle' || mStatus === 'triangle') {
      morningAttendees.push({
        userName: att.userName,
        status: mStatus,
        condition: mCond,
      });
      uniqueAttendeeNames.add(att.userName);
    }

    if (aStatus === 'circle' || aStatus === 'triangle') {
      afternoonAttendees.push({
        userName: att.userName,
        status: aStatus,
        condition: aCond,
      });
      uniqueAttendeeNames.add(att.userName);
    }
  });

  const morningCircleCount = morningAttendees.filter(a => a.status === 'circle').length;
  const morningTriangleCount = morningAttendees.filter(a => a.status === 'triangle').length;
  const afternoonCircleCount = afternoonAttendees.filter(a => a.status === 'circle').length;
  const afternoonTriangleCount = afternoonAttendees.filter(a => a.status === 'triangle').length;

  const allAttendees: AttendeeDetail[] = Array.from(uniqueAttendeeNames).map(name => {
    const m = morningAttendees.find(a => a.userName === name);
    const a = afternoonAttendees.find(a => a.userName === name);
    // 代表ステータス
    const isCircle = m?.status === 'circle' || a?.status === 'circle';
    const condition = [
      m?.condition ? `午前: ${m.condition}` : '',
      a?.condition ? `午後: ${a.condition}` : ''
    ].filter(Boolean).join(' / ');

    return {
      userName: name,
      status: isCircle ? 'circle' : 'triangle',
      condition: condition || undefined,
    };
  });

  return {
    morningCircleCount,
    morningTriangleCount,
    afternoonCircleCount,
    afternoonTriangleCount,
    totalAttendeesCount: uniqueAttendeeNames.size,
    morningAttendees,
    afternoonAttendees,
    allAttendees,
  };
}

/**
 * 今日以降（本日含む）で最も直近の練習会を取得
 */
export function getNextUpcomingEvent(events: PracticeEvent[]): PracticeEvent | null {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const upcoming = events
    .filter(e => e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  return upcoming.length > 0 ? upcoming[0] : null;
}

/**
 * ある年月の全日程情報（1日〜月末）
 */
export interface MonthDayInfo {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  weekday: string;
  isSunday: boolean;
  isSaturday: boolean;
  isWeekend: boolean;
  isToday: boolean;
}

/**
 * 1日〜月末までの全日程リストを取得
 */
export function getMonthDaysList(year: number, month: number): MonthDayInfo[] {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const list: MonthDayInfo[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const weekday = getWeekdayJa(dateStr);
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    list.push({
      date: dateStr,
      dayNumber: day,
      weekday,
      isSunday: dayOfWeek === 0,
      isSaturday: dayOfWeek === 6,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isToday: dateStr === todayStr,
    });
  }

  return list;
}

/**
 * 日付単位での出欠集計（イベント紐付け & 直接日付紐付けの両方に対応）
 */
export function getDateAttendanceStats(
  dateStr: string,
  events: PracticeEvent[],
  attendances: Attendance[]
): AttendanceStats {
  const event = events.find(e => e.date === dateStr);
  const relevantEventIds = [dateStr];
  if (event) {
    relevantEventIds.push(event.id);
  }

  const dateAttendances = attendances.filter(a => relevantEventIds.includes(a.eventId));
  
  // eventIdを仮に dateStr に統一して集計
  const normalizedAttendances = dateAttendances.map(a => ({ ...a, eventId: dateStr }));
  return getEventAttendanceStats(normalizedAttendances, dateStr);
}

export type EventTimeSlot = 'morning' | 'afternoon' | 'allDay';

/**
 * 開催時間（HH:mm）から午前・午後・終日（跨ぎ）を判定
 */
export function getEventTimeSlot(startTime?: string, endTime?: string): EventTimeSlot {
  if (!startTime) return 'allDay';
  const startHour = parseInt(startTime.split(':')[0], 10) || 0;
  const startMin = parseInt(startTime.split(':')[1] || '0', 10) || 0;
  const startTotalMin = startHour * 60 + startMin;

  const endHour = endTime ? parseInt(endTime.split(':')[0], 10) || 0 : startHour + 2;
  const endMin = endTime ? parseInt(endTime.split(':')[1] || '0', 10) || 0 : 0;
  const endTotalMin = endHour * 60 + endMin;

  // 終了時間が12:30以下なら午前中開催
  if (endTotalMin <= 12 * 60 + 30) {
    return 'morning';
  }

  // 開始時間が12:00以降なら午後開催
  if (startTotalMin >= 12 * 60) {
    return 'afternoon';
  }

  // 午前から始まり午後まで跨ぐ場合
  return 'allDay';
}


