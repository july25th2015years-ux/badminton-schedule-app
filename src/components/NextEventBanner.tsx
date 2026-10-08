import React from 'react';
import type { PracticeEvent, Attendance } from '../types';
import {
  formatDateJa,
  getGoogleMapsUrl,
  getEventAttendanceStats,
  getNextUpcomingEvent,
  getEventTimeSlot,
  isSlotQualifiedWithYosshy
} from '../utils/helpers';
import { Clock, MapPin, ExternalLink, Calendar, Plus, ChevronRight, UserCheck } from 'lucide-react';

interface NextEventBannerProps {
  events: PracticeEvent[];
  attendances: Attendance[];
  onSelectEvent: (event: PracticeEvent) => void;
  onOpenAddModal: () => void;
}

export const NextEventBanner: React.FC<NextEventBannerProps> = ({
  events,
  attendances,
  onSelectEvent,
  onOpenAddModal,
}) => {
  const nextEvent = getNextUpcomingEvent(events);

  if (!nextEvent) {
    return (
      <div className="mb-4 bg-white border border-slate-200/80 rounded-xl p-3 sm:p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
            <Calendar className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-700">次回の練習会予定</div>
            <div className="text-xs text-slate-400">現在予定されている練習会はありません</div>
          </div>
        </div>
        <button
          onClick={onOpenAddModal}
          className="inline-flex items-center justify-center space-x-1 text-xs px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>練習日を追加</span>
        </button>
      </div>
    );
  }

  const stats = getEventAttendanceStats(attendances, nextEvent.id, nextEvent.date);
  let timeSlot = getEventTimeSlot(nextEvent.startTime, nextEvent.endTime);

  // 跨ぎ開催の場合でも、ヨッシー条件（ヨッシー+他2名以上）を満たす枠のみに絞り込む
  if (timeSlot === 'allDay') {
    const isMorningQualified = isSlotQualifiedWithYosshy(stats.morningAttendees);
    const isAfternoonQualified = isSlotQualifiedWithYosshy(stats.afternoonAttendees);

    if (isMorningQualified && !isAfternoonQualified) {
      timeSlot = 'morning';
    } else if (!isMorningQualified && isAfternoonQualified) {
      timeSlot = 'afternoon';
    }
  }

  const mapUrl = getGoogleMapsUrl(nextEvent.location, nextEvent.mapUrl);

  const attendeeCount =
    timeSlot === 'morning'
      ? stats.morningAttendees.length
      : timeSlot === 'afternoon'
      ? stats.afternoonAttendees.length
      : stats.totalAttendeesCount;

  return (
    <div className="mb-4 bg-gradient-to-r from-emerald-700 to-teal-800 rounded-2xl shadow-sm text-white p-3.5 sm:p-4.5 transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* 左側: バッジ & 日時 & 場所 */}
        <div className="space-y-2 flex-1">
          <div className="flex items-center space-x-2">
            <span className="bg-emerald-500/30 text-emerald-100 border border-emerald-400/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center space-x-1">
              <span>🏸</span>
              <span>次回の練習予定</span>
            </span>
            <span className="text-xs text-emerald-100 font-medium">
              参加予定: {timeSlot === 'morning' ? '午前 ' : timeSlot === 'afternoon' ? '午後 ' : '計'}{attendeeCount}名
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-baseline sm:space-x-3 gap-1">
            <div className="text-lg sm:text-2xl font-black tracking-tight text-white">
              {formatDateJa(nextEvent.date)}
            </div>
            <div className="flex items-center text-xs sm:text-sm font-semibold text-emerald-100">
              <Clock className="w-3.5 h-3.5 mr-1 text-emerald-300 shrink-0" />
              <span>{nextEvent.startTime} 〜 {nextEvent.endTime}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-emerald-100">
            <div className="flex items-center">
              <MapPin className="w-3.5 h-3.5 mr-1 text-rose-300 shrink-0" />
              <span className="font-bold text-white">{nextEvent.location}</span>
              {nextEvent.courtCount && (
                <span className="ml-1.5 text-[10px] bg-white/20 px-1.5 py-0.2 rounded font-medium">
                  {nextEvent.courtCount}
                </span>
              )}
            </div>
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center space-x-0.5 text-[11px] text-emerald-200 hover:text-white underline underline-offset-2"
            >
              <span>Googleマップで開く</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>
          </div>
        </div>

        {/* 右側: 参加者一覧 ＆ 出欠回答ボタン */}
        <div className="md:max-w-md w-full bg-black/15 backdrop-blur-xs rounded-xl p-3 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-emerald-100 flex items-center space-x-1">
              <UserCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span>参加予定メンバー {timeSlot === 'morning' ? '(午前)' : timeSlot === 'afternoon' ? '(午後)' : ''}</span>
            </span>
            <span className="text-[10px] text-emerald-200">
              {timeSlot === 'morning'
                ? `計 ${stats.morningAttendees.length}名`
                : timeSlot === 'afternoon'
                ? `計 ${stats.afternoonAttendees.length}名`
                : `前: ${stats.morningAttendees.length}名 / 後: ${stats.afternoonAttendees.length}名`}
            </span>
          </div>

          {attendeeCount === 0 ? (
            <div className="text-xs text-emerald-200/80 py-1">
              {timeSlot === 'morning'
                ? '午前の参加登録がまだありません。出欠を登録しましょう！'
                : timeSlot === 'afternoon'
                ? '午後の参加登録がまだありません。出欠を登録しましょう！'
                : 'まだ参加登録がありません。出欠を登録しましょう！'}
            </div>
          ) : (
            <div className="space-y-1.5">
              {/* 午前枠：午後限定開催でない場合に表示 */}
              {timeSlot !== 'afternoon' && stats.morningAttendees.length > 0 && (
                <div className="text-[11px] flex items-start space-x-1.5">
                  <span className="shrink-0 font-bold text-emerald-200 bg-white/10 px-1 rounded text-[10px]">
                    {timeSlot === 'allDay' ? '午前' : '参加'}
                  </span>
                  <div className="flex flex-wrap gap-1 items-center">
                    {stats.morningAttendees.map(m => (
                      <span
                        key={'m_' + m.userName}
                        className="bg-white/90 text-slate-800 text-[11px] font-semibold px-2 py-0.5 rounded shadow-2xs"
                        title={m.condition}
                      >
                        {m.userName}{m.status === 'triangle' ? '△' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 午後枠：午前限定開催でない場合に表示 */}
              {timeSlot !== 'morning' && stats.afternoonAttendees.length > 0 && (
                <div className="text-[11px] flex items-start space-x-1.5">
                  <span className="shrink-0 font-bold text-teal-200 bg-white/10 px-1 rounded text-[10px]">
                    {timeSlot === 'allDay' ? '午後' : '参加'}
                  </span>
                  <div className="flex flex-wrap gap-1 items-center">
                    {stats.afternoonAttendees.map(a => (
                      <span
                        key={'a_' + a.userName}
                        className="bg-white/90 text-slate-800 text-[11px] font-semibold px-2 py-0.5 rounded shadow-2xs"
                        title={a.condition}
                      >
                        {a.userName}{a.status === 'triangle' ? '△' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 出欠を登録・変更するボタン */}
          <button
            onClick={() => onSelectEvent(nextEvent)}
            className="w-full mt-1.5 py-1.5 px-3 bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-bold rounded-lg shadow-sm transition flex items-center justify-center space-x-1 active:scale-98"
          >
            <span>この日の出欠を登録・確認する</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
