import type { PracticeEvent, Attendance } from '../types';

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
 * 出欠集計
 */
export function getEventAttendanceStats(attendances: Attendance[], eventId: string) {
  const eventAttendances = attendances.filter(a => a.eventId === eventId);
  const circles = eventAttendances.filter(a => a.status === 'circle');
  const triangles = eventAttendances.filter(a => a.status === 'triangle');
  return {
    circleCount: circles.length,
    triangleCount: triangles.length,
    totalCount: eventAttendances.length,
    circles,
    triangles,
    attendances: eventAttendances,
  };
}
