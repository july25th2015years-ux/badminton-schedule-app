import React, { useState, useEffect } from 'react';
import type {
  PracticeEvent,
  Attendance,
  AttendanceStatus
} from '../types';
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
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import {
  getStoredUserName,
  setStoredUserName,
  saveAttendance,
  deleteAttendance
} from '../services/storage';

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

  const stats = getEventAttendanceStats(attendances, event.id);
  const mapUrl = getGoogleMapsUrl(event.location, event.mapUrl);

  // 出欠フォームの状態
  const [userName, setUserName] = useState('');
  const [status, setStatus] = useState<AttendanceStatus>('circle');
  const [condition, setCondition] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  // 以前のユーザー名、またはこのイベントに回答済みのデータがあれば復元
  useEffect(() => {
    const savedName = getStoredUserName();
    if (savedName) {
      setUserName(savedName);
      const existing = stats.attendances.find(
        (a) => a.userName.toLowerCase() === savedName.toLowerCase()
      );
      if (existing) {
        setStatus(existing.status);
        setCondition(existing.condition || '');
      }
    }
  }, [event.id]);

  // ユーザー名が変わった時、その人の既存回答があれば同期
  const handleNameChange = (name: string) => {
    setUserName(name);
    setErrorMsg('');
    const existing = stats.attendances.find(
      (a) => a.userName.toLowerCase() === name.trim().toLowerCase()
    );
    if (existing) {
      setStatus(existing.status);
      setCondition(existing.condition || '');
    }
  };

  // フォーム送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = userName.trim();

    if (!trimmedName) {
      setErrorMsg('お名前を入力してください');
      return;
    }

    if (status === 'triangle' && !condition.trim()) {
      setErrorMsg('「△ 条件付き参加」の場合は、参加条件（例: 19:30から参加など）を入力してください');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await saveAttendance({
        eventId: event.id,
        userName: trimmedName,
        status,
        condition: status === 'triangle' ? condition.trim() : undefined,
      });

      setStoredUserName(trimmedName);
      setSuccessToast('出欠を登録しました！');
      setTimeout(() => setSuccessToast(''), 3000);
    } catch (err) {
      console.error(err);
      setErrorMsg('保存に失敗しました。もう一度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 出欠取り消し
  const handleDeleteAttendance = async () => {
    const trimmedName = userName.trim();
    if (!trimmedName) return;

    if (!window.confirm(`${trimmedName} さんの回答を取り消しますか？`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteAttendance(event.id, trimmedName);
      setCondition('');
      setStatus('circle');
      setSuccessToast('出欠を取り消しました');
      setTimeout(() => setSuccessToast(''), 3000);
    } catch (err) {
      console.error(err);
      setErrorMsg('取り消しに失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 既存回答の確認
  const myExistingAttendance = stats.attendances.find(
    (a) => a.userName.toLowerCase() === userName.trim().toLowerCase()
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
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

        {/* トースト通知 */}
        {successToast && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 flex items-center space-x-2 text-emerald-800 text-xs sm:text-sm font-medium animate-in slide-in-from-top duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        <div className="p-4 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
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
                {/* Googleマップへの直接リンクボタン */}
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
                onClick={() => onEditEvent(event)}
                className="inline-flex items-center space-x-1 text-xs text-slate-600 hover:text-emerald-700 hover:bg-white px-2 py-1 rounded border border-transparent hover:border-slate-200 transition"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>日程を編集</span>
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`${formatDateJa(event.date)} の練習会を削除しますか？`)) {
                    onDeleteEvent(event.id);
                    onClose();
                  }
                }}
                className="inline-flex items-center space-x-1 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>削除</span>
              </button>
            </div>
          </div>

          {/* 参加者一覧セクション */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-slate-800 font-bold text-sm">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>参加予定者</span>
                <span className="text-xs font-normal text-slate-500">
                  (計{stats.totalCount}名)
                </span>
              </div>
              <div className="text-xs font-semibold space-x-2">
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  ◯ 参加 {stats.circleCount}名
                </span>
                {stats.triangleCount > 0 && (
                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    △ 条件付き {stats.triangleCount}名
                  </span>
                )}
              </div>
            </div>

            {stats.totalCount === 0 ? (
              <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                まだ参加予定者がいません。下のフォームから出欠を登録してください🏸
              </div>
            ) : (
              <div className="space-y-2">
                {/* ◯ 参加者 */}
                {stats.circles.length > 0 && (
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-2.5">
                    <div className="text-[11px] font-bold text-emerald-800 mb-1.5 flex items-center">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span>
                      ◯ 参加予定 ({stats.circles.length}名)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {stats.circles.map((att) => (
                        <span
                          key={att.id}
                          className="inline-flex items-center text-xs font-medium bg-white text-slate-800 border border-emerald-200 px-2.5 py-1 rounded-md shadow-2xs"
                        >
                          {att.userName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* △ 条件付き参加者 */}
                {stats.triangles.length > 0 && (
                  <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-2.5">
                    <div className="text-[11px] font-bold text-amber-800 mb-1.5 flex items-center">
                      <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5"></span>
                      △ 条件付き参加 ({stats.triangles.length}名)
                    </div>
                    <div className="space-y-1.5">
                      {stats.triangles.map((att) => (
                        <div
                          key={att.id}
                          className="bg-white border border-amber-200 rounded-md p-2 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 shadow-2xs"
                        >
                          <span className="font-bold text-slate-800">{att.userName}</span>
                          <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-100">
                            {att.condition}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 出欠回答フォームセクション */}
          <div className="bg-white rounded-xl border-2 border-emerald-500/20 p-4 shadow-sm space-y-3">
            <h4 className="text-sm font-bold text-slate-800 flex items-center justify-between">
              <span>出欠を登録・変更する</span>
              {myExistingAttendance && (
                <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  回答済み ({myExistingAttendance.status === 'circle' ? '◯' : '△'})
                </span>
              )}
            </h4>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg text-xs text-rose-700 flex items-center space-x-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* 名前入力 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  お名前 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="例: 田中、サトウ"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
              </div>

              {/* 出欠ステータス選択（◯ / △ のみ） */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  参加状況 <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStatus('circle');
                      setErrorMsg('');
                    }}
                    className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg border text-sm font-bold transition ${
                      status === 'circle'
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-base">◯</span>
                    <span>参加する</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStatus('triangle');
                      setErrorMsg('');
                    }}
                    className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg border text-sm font-bold transition ${
                      status === 'triangle'
                        ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-base">△</span>
                    <span>条件付き参加</span>
                  </button>
                </div>
              </div>

              {/* △の場合の条件入力欄（必須） */}
              {status === 'triangle' && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                  <label className="block text-xs font-semibold text-amber-900 mb-1">
                    参加条件 <span className="text-rose-500">*必須</span>
                  </label>
                  <input
                    type="text"
                    value={condition}
                    onChange={(e) => {
                      setCondition(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="例: 19:30から遅れて参加、20:30早退 など"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-amber-300 bg-amber-50/30 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    required
                  />
                  <p className="text-[11px] text-amber-700 mt-1">
                    ※遅刻・早退の時間など、参加可能な条件を入力してください。
                  </p>
                </div>
              )}

              {/* ボタンエリア */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-sm transition active:scale-98 disabled:opacity-50"
                >
                  {isSubmitting ? '保存中...' : myExistingAttendance ? '出欠を更新する' : '出欠を登録する'}
                </button>

                {myExistingAttendance && (
                  <button
                    type="button"
                    onClick={handleDeleteAttendance}
                    disabled={isSubmitting}
                    className="py-2.5 px-3 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 text-xs font-semibold rounded-lg border border-slate-200 hover:border-rose-200 transition"
                    title="この回答を取り消す"
                  >
                    取消
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
