import React, { useState } from 'react';
import type { PracticeEvent, Attendance } from '../types';
import {
  formatDateJa,
  getGoogleMapsUrl,
  getEventAttendanceStats
} from '../utils/helpers';
import {
  X,
  Clock,
  MapPin,
  ExternalLink,
  Edit2,
  Trash2,
  Users,
  Sun,
  Moon,
  Info
} from 'lucide-react';

interface EventDetailModalProps {
  event: PracticeEvent | null;
  attendances: Attendance[];
  onClose: () => void;
  onEditEvent: (event: PracticeEvent) => void;
  onDeleteEvent: (eventId: string) => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  attendances,
  onClose,
  onEditEvent,
  onDeleteEvent,
}) => {
  if (!event) return null;

  // 出欠一覧カレンダーの回答（eventId & event.date の両方）から自動的に参加メンバーを集計
  const stats = getEventAttendanceStats(attendances, event.id, event.date);
  const mapUrl = getGoogleMapsUrl(event.location, event.mapUrl);

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden transform transition-all border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* モーダルヘッダー */}
        <div className="bg-emerald-600 px-4 sm:px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🏸</span>
            <h3 className="text-base sm:text-lg font-bold">
              {formatDateJa(event.date)} の練習会
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-emerald-700/80 transition text-emerald-100 hover:text-white"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* イベント基本情報カード */}
          <div className="bg-slate-50 rounded-xl p-3.5 sm:p-4 border border-slate-200 space-y-3">
            {/* 時間 */}
            <div className="flex items-start text-sm">
              <Clock className="w-4 h-4 text-emerald-600 mr-2.5 mt-0.5 shrink-0" />
              <div>
                <span className="text-xs text-slate-500 block font-medium">開催時間</span>
                <span className="font-bold text-slate-800 text-base">
                  {event.startTime} 〜 {event.endTime}
                </span>
              </div>
            </div>

            {/* 場所 ＆ Googleマップリンク */}
            <div className="flex items-start text-sm">
              <MapPin className="w-4 h-4 text-rose-500 mr-2.5 mt-0.5 shrink-0" />
              <div className="flex-1">
                <span className="text-xs text-slate-500 block font-medium">開催場所</span>
                <div className="font-bold text-slate-800">{event.location}</div>
                {event.courtCount && (
                  <span className="inline-block mt-0.5 text-xs bg-emerald-100 text-emerald-800 font-medium px-2 py-0.5 rounded">
                    {event.courtCount}
                  </span>
                )}
                <div className="mt-2">
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/50 text-slate-700 hover:text-emerald-700 text-xs font-semibold shadow-2xs transition group"
                  >
                    <span className="text-rose-500 font-bold">📍</span>
                    <span>Google マップで場所を確認</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition" />
                  </a>
                </div>
              </div>
            </div>

            {/* メモ・備考 */}
            {event.notes && (
              <div className="pt-2 border-t border-slate-200 text-xs text-slate-600 whitespace-pre-wrap bg-white/70 p-2.5 rounded-lg">
                <span className="font-semibold text-slate-700 block mb-0.5">備考・メモ:</span>
                {event.notes}
              </div>
            )}

            {/* 練習日の編集・削除アクション */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => onEditEvent(event)}
                className="inline-flex items-center space-x-1 text-xs text-slate-600 hover:text-emerald-700 hover:bg-white px-2 py-1 rounded border border-transparent hover:border-slate-200 transition"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>日程を編集</span>
              </button>
              {isConfirmingDelete ? (
                <div className="flex items-center space-x-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg animate-in fade-in">
                  <span className="text-[11px] text-rose-700 font-bold">本当に削除しますか？</span>
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteEvent(event.id);
                      onClose();
                    }}
                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded shadow-2xs transition"
                  >
                    削除する
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-2 py-0.5 bg-white text-slate-600 hover:bg-slate-100 text-[11px] font-medium rounded border border-slate-200 transition"
                  >
                    キャンセル
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="inline-flex items-center space-x-1 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>削除</span>
                </button>
              )}
            </div>
          </div>

          {/* 参加者一覧セクション（カレンダーの◯・△回答から自動反映） */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-slate-800 font-bold text-sm">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>参加予定メンバー</span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full ml-1">
                  計 {stats.totalAttendeesCount}名
                </span>
              </div>
            </div>

            {stats.totalAttendeesCount === 0 ? (
              <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 space-y-1">
                <p className="font-medium">まだ参加予定者がいません</p>
                <p className="text-[11px] text-slate-400">
                  出欠一覧タブのカレンダーで各自回答（◯・△）すると自動的にここに反映されます🏸
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 午前参加枠 */}
                <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-amber-200/60 pb-1.5">
                    <span className="text-xs font-bold text-amber-900 flex items-center space-x-1">
                      <Sun className="w-3.5 h-3.5 text-amber-600" />
                      <span>午前 ({stats.morningAttendees.length}名)</span>
                    </span>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded">
                      ◯ {stats.morningCircleCount} / △ {stats.morningTriangleCount}
                    </span>
                  </div>
                  {stats.morningAttendees.length === 0 ? (
                    <div className="text-[11px] text-slate-400 py-1.5 text-center">午前の参加者はいません</div>
                  ) : (
                    <div className="space-y-1.5">
                      {stats.morningAttendees.map((m) => (
                        <div
                          key={'m_' + m.userName}
                          className="text-xs flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-amber-200/70 shadow-2xs"
                        >
                          <span className="font-bold text-slate-800">{m.userName}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              m.status === 'circle'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            {m.status === 'circle' ? '◯ 参加' : `△ ${m.condition || '条件付き'}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 午後参加枠 */}
                <div className="bg-teal-50/50 border border-teal-200/80 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-teal-200/60 pb-1.5">
                    <span className="text-xs font-bold text-teal-900 flex items-center space-x-1">
                      <Moon className="w-3.5 h-3.5 text-teal-600" />
                      <span>午後 ({stats.afternoonAttendees.length}名)</span>
                    </span>
                    <span className="text-[10px] font-bold text-teal-800 bg-teal-100/80 px-1.5 py-0.5 rounded">
                      ◯ {stats.afternoonCircleCount} / △ {stats.afternoonTriangleCount}
                    </span>
                  </div>
                  {stats.afternoonAttendees.length === 0 ? (
                    <div className="text-[11px] text-slate-400 py-1.5 text-center">午後の参加者はいません</div>
                  ) : (
                    <div className="space-y-1.5">
                      {stats.afternoonAttendees.map((a) => (
                        <div
                          key={'a_' + a.userName}
                          className="text-xs flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-teal-200/70 shadow-2xs"
                        >
                          <span className="font-bold text-slate-800">{a.userName}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              a.status === 'circle'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            {a.status === 'circle' ? '◯ 参加' : `△ ${a.condition || '条件付き'}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 出欠入力案内バナー（各自カレンダーから回答する運用） */}
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-start space-x-2.5">
            <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">出欠の登録・変更について:</span>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                出欠は【出欠一覧】タブのカレンダーから各自ワンタップで入力・更新いただけます。カレンダーで回答した内容がこの画面に自動的に反映されます。
              </p>
            </div>
          </div>

          {/* 閉じるボタン */}
          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
