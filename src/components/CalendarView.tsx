import React from 'react';
import type { PracticeEvent, Attendance } from '../types';
import { getCalendarGrid, WEEKDAYS_JA, getEventAttendanceStats, getEventTimeSlot } from '../utils/helpers';
import { MapPin, Clock, Plus } from 'lucide-react';

interface CalendarViewProps {
  year: number;
  month: number;
  events: PracticeEvent[];
  attendances: Attendance[];
  onSelectEvent: (event: PracticeEvent) => void;
  onSelectEmptyDate: (dateString: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  year,
  month,
  events,
  attendances,
  onSelectEvent,
  onSelectEmptyDate,
}) => {
  const calendarDays = getCalendarGrid(year, month, events);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold">
        {WEEKDAYS_JA.map((day, idx) => {
          let textColor = 'text-slate-600';
          if (idx === 0) textColor = 'text-rose-600'; // 日曜日
          if (idx === 6) textColor = 'text-sky-600';  // 土曜日
          return (
            <div key={day} className={`py-2.5 ${textColor}`}>
              {day}
            </div>
          );
        })}
      </div>

      {/* カレンダー本体グリッド */}
      <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100">
        {calendarDays.map((day) => {
          const [y, m, d] = day.date.split('-').map(Number);
          const dayOfWeek = new Date(y, m - 1, d).getDay();
          const isSunday = dayOfWeek === 0;
          const isSaturday = dayOfWeek === 6;

          let dayNumberColor = 'text-slate-700';
          if (!day.isCurrentMonth) {
            dayNumberColor = 'text-slate-300';
          } else if (day.isToday) {
            dayNumberColor = 'text-white bg-emerald-600 rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-sm';
          } else if (isSunday) {
            dayNumberColor = 'text-rose-600 font-semibold';
          } else if (isSaturday) {
            dayNumberColor = 'text-sky-600 font-semibold';
          }

          const hasEvents = day.events.length > 0;

          return (
            <div
              key={day.date}
              onClick={() => {
                if (day.events.length === 1) {
                  onSelectEvent(day.events[0]);
                } else if (day.events.length === 0) {
                  onSelectEmptyDate(day.date);
                }
              }}
              className={`min-h-[85px] sm:min-h-[115px] p-1 sm:p-2 transition flex flex-col justify-between group ${
                day.isCurrentMonth ? 'bg-white hover:bg-emerald-50/40' : 'bg-slate-50/50 hover:bg-slate-100/50'
              } cursor-pointer relative`}
            >
              {/* 日付ヘッダー */}
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs sm:text-sm select-none ${dayNumberColor}`}>
                  {day.dayNumber}
                </span>

                {/* ホバー時の「＋追加」ボタン */}
                {!hasEvents && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEmptyDate(day.date);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-emerald-600 hover:bg-emerald-100 transition"
                    title="この日に練習日を追加"
                    aria-label="練習日を追加"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* イベント一覧 */}
              <div className="space-y-1 flex-1 flex flex-col justify-start">
                {day.events.map((event) => {
                  const stats = getEventAttendanceStats(attendances, event.id, event.date);
                  const timeSlot = getEventTimeSlot(event.startTime, event.endTime);
                  const attendeeCount =
                    timeSlot === 'morning'
                      ? stats.morningAttendees.length
                      : timeSlot === 'afternoon'
                      ? stats.afternoonAttendees.length
                      : stats.totalAttendeesCount;

                  return (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(event);
                      }}
                      className="bg-emerald-50 border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100/80 rounded-md p-1 sm:p-1.5 transition text-left shadow-2xs group/card"
                    >
                      {/* 時間帯 */}
                      <div className="flex items-center text-[10px] sm:text-xs font-semibold text-emerald-900 leading-tight">
                        <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1 text-emerald-700 shrink-0" />
                        <span className="truncate">{event.startTime} - {event.endTime}</span>
                      </div>

                      {/* 開催場所 */}
                      <div className="flex items-center text-[10px] sm:text-xs text-slate-600 mt-0.5">
                        <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1 text-slate-400 shrink-0" />
                        <span className="truncate font-medium">{event.location}</span>
                      </div>

                      {/* 出欠バッジ */}
                      <div className="flex items-center gap-1 mt-1">
                        <span className="inline-flex items-center text-[10px] sm:text-xs bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded leading-tight">
                          {timeSlot === 'morning' ? '午前 ' : timeSlot === 'afternoon' ? '午後 ' : ''}参加 {attendeeCount}人
                        </span>
                        {timeSlot === 'allDay' && (
                          <span className="text-[10px] text-slate-500 hidden sm:inline ml-auto font-medium">
                            前:{stats.morningAttendees.length} 後:{stats.afternoonAttendees.length}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 複数イベントがある場合の余白調整 */}
              {day.events.length > 2 && (
                <div className="text-[10px] text-slate-500 text-center font-medium">
                  他 {day.events.length - 2} 件
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
