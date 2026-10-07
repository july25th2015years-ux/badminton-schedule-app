import React, { useState, useEffect } from 'react';
import type {
  PracticeEvent,
  Attendance,
  SlotStatus
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
  CheckCircle2,
  Sun,
  Moon,
  Sparkles
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
  const [morningStatus, setMorningStatus] = useState<SlotStatus>('circle');
  const [morningCondition, setMorningCondition] = useState('');
  const [afternoonStatus, setAfternoonStatus] = useState<SlotStatus>('circle');
  const [afternoonCondition, setAfternoonCondition] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  // 以前のユーザー名、またはこのイベントに回答済みのデータがあれば復元
  useEffect(() => {
    const savedName = getStoredUserName();
    if (savedName) {
      setUserName(savedName);
      loadExistingUserAttendance(savedName);
    }
  }, [event.id]);

  const loadExistingUserAttendance = (name: string) => {
    const existing = attendances.find(
      (a) => a.eventId === event.id && a.userName.toLowerCase() === name.trim().toLowerCase()
    );
    if (existing) {
      setMorningStatus(existing.morningStatus || (existing.status as any) || 'circle');
      setMorningCondition(existing.morningCondition || (existing.status === 'triangle' ? existing.condition || '' : ''));
      setAfternoonStatus(existing.afternoonStatus || (existing.status as any) || 'circle');
      setAfternoonCondition(existing.afternoonCondition || (existing.status === 'triangle' ? existing.condition || '' : ''));
    }
  };

  const handleNameChange = (name: string) => {
    setUserName(name);
    setErrorMsg('');
    loadExistingUserAttendance(name);
  };

  // 終日参加クイック選択
  const handleSelectFullDay = () => {
    setMorningStatus('circle');
    setMorningCondition('');
    setAfternoonStatus('circle');
    setAfternoonCondition('');
    setErrorMsg('');
  };

  // フォーム送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = userName.trim();

    if (!trimmedName) {
      setErrorMsg('お名前を入力してください');
      return;
    }

    if (morningStatus === 'none' && afternoonStatus === 'none') {
      setErrorMsg('午前または午後のいずれかの参加状況（◯ または △）を選択してください');
      return;
    }

    if (morningStatus === 'triangle' && !morningCondition.trim()) {
      setErrorMsg('午前の「△ 条件付き参加」の場合は、参加条件を入力してください');
      return;
    }

    if (afternoonStatus === 'triangle' && !afternoonCondition.trim()) {
      setErrorMsg('午後の「△ 条件付き参加」の場合は、参加条件を入力してください');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await saveAttendance({
        eventId: event.id,
        userName: trimmedName,
        morningStatus,
        morningCondition: morningStatus === 'triangle' ? morningCondition.trim() : undefined,
        afternoonStatus,
        afternoonCondition: afternoonStatus === 'triangle' ? afternoonCondition.trim() : undefined,
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
      setMorningStatus('none');
      setMorningCondition('');
      setAfternoonStatus('none');
      setAfternoonCondition('');
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
  const myExistingAttendance = attendances.find(
    (a) => a.eventId === event.id && a.userName.toLowerCase() === userName.trim().toLowerCase()
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

          {/* 参加者一覧セクション（午前・午後） */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-slate-800 font-bold text-sm">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>参加予定メンバー</span>
                <span className="text-xs font-normal text-slate-500">
                  (合計 {stats.totalAttendeesCount}名)
                </span>
              </div>
            </div>

            {stats.totalAttendeesCount === 0 ? (
              <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                まだ参加予定者がいません。下のフォームから出欠を登録してください🏸
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 午前参加枠 */}
                <div className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-amber-900 flex items-center space-x-1">
                      <Sun className="w-3.5 h-3.5 text-amber-600" />
                      <span>午前 ({stats.morningAttendees.length}名)</span>
                    </span>
                    <span className="text-[10px] text-amber-700">
                      ◯{stats.morningCircleCount} / △{stats.morningTriangleCount}
                    </span>
                  </div>
                  {stats.morningAttendees.length === 0 ? (
                    <div className="text-[11px] text-slate-400 py-1">午前の参加者はいません</div>
                  ) : (
                    <div className="space-y-1">
                      {stats.morningAttendees.map(m => (
                        <div key={'m_' + m.userName} className="text-xs flex items-center justify-between bg-white px-2 py-1 rounded border border-amber-100">
                          <span className="font-semibold text-slate-800">{m.userName}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${m.status === 'circle' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {m.status === 'circle' ? '◯' : `△ ${m.condition || ''}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 午後参加枠 */}
                <div className="bg-teal-50/40 border border-teal-200/80 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-teal-900 flex items-center space-x-1">
                      <Moon className="w-3.5 h-3.5 text-teal-600" />
                      <span>午後 ({stats.afternoonAttendees.length}名)</span>
                    </span>
                    <span className="text-[10px] text-teal-700">
                      ◯{stats.afternoonCircleCount} / △{stats.afternoonTriangleCount}
                    </span>
                  </div>
                  {stats.afternoonAttendees.length === 0 ? (
                    <div className="text-[11px] text-slate-400 py-1">午後の参加者はいません</div>
                  ) : (
                    <div className="space-y-1">
                      {stats.afternoonAttendees.map(a => (
                        <div key={'a_' + a.userName} className="text-xs flex items-center justify-between bg-white px-2 py-1 rounded border border-teal-100">
                          <span className="font-semibold text-slate-800">{a.userName}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${a.status === 'circle' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {a.status === 'circle' ? '◯' : `△ ${a.condition || ''}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 出欠回答フォームセクション */}
          <div className="bg-white rounded-xl border-2 border-emerald-500/20 p-4 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800">
                出欠を登録・変更する
              </h4>
              <button
                type="button"
                onClick={handleSelectFullDay}
                className="inline-flex items-center space-x-1 text-[11px] text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-md font-semibold transition"
              >
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>終日参加（午前・午後ともに◯）</span>
              </button>
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg text-xs text-rose-700 flex items-center space-x-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
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

              {/* 午前枠の出欠 */}
              <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-200/70 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-900 flex items-center space-x-1">
                    <Sun className="w-3.5 h-3.5 text-amber-600" />
                    <span>午前の参加状況</span>
                  </label>
                  <span className="text-[10px] text-amber-700 font-medium">
                    選択: {morningStatus === 'circle' ? '◯ 参加' : morningStatus === 'triangle' ? '△ 条件付き' : '不参加/なし'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setMorningStatus('circle'); setErrorMsg(''); }}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition flex items-center justify-center space-x-1 ${
                      morningStatus === 'circle'
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>◯</span>
                    <span>参加</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMorningStatus('triangle'); setErrorMsg(''); }}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition flex items-center justify-center space-x-1 ${
                      morningStatus === 'triangle'
                        ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>△</span>
                    <span>条件付き</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMorningStatus('none'); setErrorMsg(''); }}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition flex items-center justify-center space-x-1 ${
                      morningStatus === 'none'
                        ? 'bg-slate-600 border-slate-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>✕</span>
                    <span>なし</span>
                  </button>
                </div>

                {morningStatus === 'triangle' && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-150 pt-1">
                    <input
                      type="text"
                      value={morningCondition}
                      onChange={(e) => { setMorningCondition(e.target.value); setErrorMsg(''); }}
                      placeholder="午前の条件（例: 10:00から参加 など）*必須"
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>
                )}
              </div>

              {/* 午後枠の出欠 */}
              <div className="p-3 bg-teal-50/40 rounded-xl border border-teal-200/70 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-teal-900 flex items-center space-x-1">
                    <Moon className="w-3.5 h-3.5 text-teal-600" />
                    <span>午後の参加状況</span>
                  </label>
                  <span className="text-[10px] text-teal-700 font-medium">
                    選択: {afternoonStatus === 'circle' ? '◯ 参加' : afternoonStatus === 'triangle' ? '△ 条件付き' : '不参加/なし'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setAfternoonStatus('circle'); setErrorMsg(''); }}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition flex items-center justify-center space-x-1 ${
                      afternoonStatus === 'circle'
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>◯</span>
                    <span>参加</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAfternoonStatus('triangle'); setErrorMsg(''); }}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition flex items-center justify-center space-x-1 ${
                      afternoonStatus === 'triangle'
                        ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>△</span>
                    <span>条件付き</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAfternoonStatus('none'); setErrorMsg(''); }}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition flex items-center justify-center space-x-1 ${
                      afternoonStatus === 'none'
                        ? 'bg-slate-600 border-slate-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>✕</span>
                    <span>なし</span>
                  </button>
                </div>

                {afternoonStatus === 'triangle' && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-150 pt-1">
                    <input
                      type="text"
                      value={afternoonCondition}
                      onChange={(e) => { setAfternoonCondition(e.target.value); setErrorMsg(''); }}
                      placeholder="午後の条件（例: 15:30早退予定 など）*必須"
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-teal-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>
                )}
              </div>

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
