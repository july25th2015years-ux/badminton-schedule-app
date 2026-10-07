import React from 'react';
import type { PracticeEvent, Attendance } from '../types';
import { formatDateJa, getEventAttendanceStats } from '../utils/helpers';
import { MapPin, Clock } from 'lucide-react';

interface MatrixViewProps {
  year: number;
  month: number;
  events: PracticeEvent[];
  attendances: Attendance[];
  onSelectEvent: (event: PracticeEvent) => void;
}

export const MatrixView: React.FC<MatrixViewProps> = ({
  year,
  month,
  events,
  attendances,
  onSelectEvent,
}) => {
  // 当月の日程のみ抽出
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const monthEvents = events.filter((e) => e.date.startsWith(monthPrefix));

  // 全参加者名のユニークリスト（名前順）
  const allUserNames = Array.from(
    new Set(
      attendances
        .filter((a) => monthEvents.some((e) => e.id === a.eventId))
        .map((a) => a.userName)
    )
  ).sort((a, b) => a.localeCompare(b, 'ja'));

  if (monthEvents.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400">
        <p className="text-sm">この月にはまだ練習日が登録されていません。</p>
        <p className="text-xs mt-1 text-slate-400">
          右上の「練習日を追加」ボタンから日程を登録してください🏸
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-xs sm:text-sm font-bold text-slate-700">
          {year}年{month}月 メンバー出欠一覧表
        </h3>
        <span className="text-xs text-slate-500">
          日程: {monthEvents.length}件 / 回答メンバー: {allUserNames.length}名
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
              <th className="py-2.5 px-3 min-w-[140px] font-bold sticky left-0 bg-slate-100 z-10 shadow-[1px_0_0_0_#e2e8f0]">
                日程・時間・場所
              </th>
              <th className="py-2.5 px-2 text-center min-w-[70px] font-bold text-emerald-800 bg-emerald-50">
                参加合計
              </th>
              {allUserNames.map((name) => (
                <th
                  key={name}
                  className="py-2.5 px-2 text-center min-w-[75px] font-bold text-slate-800 border-l border-slate-200"
                >
                  <span className="truncate block max-w-[90px] mx-auto" title={name}>
                    {name}
                  </span>
                </th>
              ))}
              {allUserNames.length === 0 && (
                <th className="py-2.5 px-4 text-center text-slate-400 font-normal">
                  まだ出欠の回答がありません
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {monthEvents.map((event) => {
              const stats = getEventAttendanceStats(attendances, event.id);

              return (
                <tr
                  key={event.id}
                  className="hover:bg-slate-50/80 transition group"
                >
                  {/* 日程・場所セル（固定列） */}
                  <td
                    onClick={() => onSelectEvent(event)}
                    className="py-2.5 px-3 sticky left-0 bg-white group-hover:bg-slate-50/80 z-10 cursor-pointer shadow-[1px_0_0_0_#e2e8f0]"
                  >
                    <div className="font-bold text-slate-900 group-hover:text-emerald-700 transition flex items-center space-x-1">
                      <span>{formatDateJa(event.date)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{event.startTime} - {event.endTime}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 flex items-center space-x-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                      <span className="truncate max-w-[130px]">{event.location}</span>
                    </div>
                  </td>

                  {/* 参加合計 */}
                  <td
                    onClick={() => onSelectEvent(event)}
                    className="py-2.5 px-2 text-center cursor-pointer bg-emerald-50/30 font-semibold"
                  >
                    <div className="text-emerald-700 font-bold">
                      ◯ {stats.circleCount}
                    </div>
                    {stats.triangleCount > 0 && (
                      <div className="text-[10px] text-amber-600 mt-0.5">
                        △ {stats.triangleCount}
                      </div>
                    )}
                  </td>

                  {/* 各ユーザーの回答 */}
                  {allUserNames.map((name) => {
                    const att = stats.attendances.find(
                      (a) => a.userName.toLowerCase() === name.toLowerCase()
                    );

                    return (
                      <td
                        key={name}
                        onClick={() => onSelectEvent(event)}
                        className="py-2.5 px-2 text-center border-l border-slate-100 cursor-pointer"
                      >
                        {att ? (
                          att.status === 'circle' ? (
                            <span className="inline-block w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-black leading-6 text-sm">
                              ◯
                            </span>
                          ) : (
                            <div className="flex flex-col items-center">
                              <span className="inline-block w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-black leading-6 text-xs">
                                △
                              </span>
                              {att.condition && (
                                <span
                                  className="text-[9px] text-amber-700 max-w-[65px] truncate mt-0.5"
                                  title={att.condition}
                                >
                                  {att.condition}
                                </span>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    );
                  })}

                  {allUserNames.length === 0 && (
                    <td className="py-2.5 px-4 text-center text-slate-400">
                      -
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
