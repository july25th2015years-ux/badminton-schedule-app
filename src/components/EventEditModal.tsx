import React, { useState, useEffect } from 'react';
import type { PracticeEvent } from '../types';
import { X, Calendar, Clock, Link2, AlertCircle } from 'lucide-react';
import { saveEvent } from '../services/storage';

interface EventEditModalProps {
  isOpen: boolean;
  initialDate?: string;
  editingEvent?: PracticeEvent | null;
  onClose: () => void;
  onSaved: (eventId: string) => void;
}

export const EventEditModal: React.FC<EventEditModalProps> = ({
  isOpen,
  initialDate,
  editingEvent,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(initialDate || todayStr);
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('21:00');
  const [location, setLocation] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [courtCount, setCourtCount] = useState('2面');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingEvent) {
      setDate(editingEvent.date);
      setStartTime(editingEvent.startTime);
      setEndTime(editingEvent.endTime);
      setLocation(editingEvent.location);
      setMapUrl(editingEvent.mapUrl || '');
      setCourtCount(editingEvent.courtCount || '');
      setNotes(editingEvent.notes || '');
    } else {
      setDate(initialDate || todayStr);
      setStartTime('19:00');
      setEndTime('21:00');
      setLocation('');
      setMapUrl('');
      setCourtCount('2面');
      setNotes('');
    }
    setErrorMsg('');
  }, [editingEvent, initialDate, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!date) {
      setErrorMsg('開催日を入力してください');
      return;
    }
    if (!startTime || !endTime) {
      setErrorMsg('開始時間と終了時間を入力してください');
      return;
    }
    if (startTime >= endTime) {
      setErrorMsg('終了時間は開始時間より後の時間を指定してください');
      return;
    }
    if (!location.trim()) {
      setErrorMsg('開催場所（体育館名など）を入力してください');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const savedId = await saveEvent({
        date,
        startTime,
        endTime,
        location: location.trim(),
        mapUrl: mapUrl.trim() || undefined,
        courtCount: courtCount.trim() || undefined,
        notes: notes.trim() || undefined,
      }, editingEvent?.id);

      onSaved(savedId);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('保存中にエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden transform transition-all border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="bg-slate-900 px-4 sm:px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base sm:text-lg font-bold">
              {editingEvent ? '練習日の内容を編集' : '新しい練習日を追加'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-800 transition text-slate-400 hover:text-white"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg text-xs text-rose-700 flex items-center space-x-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 開催日 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              開催日 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* 時間帯 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                開始時間 <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center">
                <Clock className="w-4 h-4 text-slate-400 mr-1.5 shrink-0" />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-full text-sm px-2.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                終了時間 <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center">
                <Clock className="w-4 h-4 text-slate-400 mr-1.5 shrink-0" />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="w-full text-sm px-2.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* 開催場所 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              開催場所（施設名・体育館名） <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例: 世田谷区総合運動場 温水プール体育館"
                required
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* GoogleマップURL（任意） */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Google マップURL（任意）
            </label>
            <div className="flex items-center">
              <Link2 className="w-4 h-4 text-slate-400 mr-1.5 shrink-0" />
              <input
                type="url"
                value={mapUrl}
                onChange={(e) => setMapUrl(e.target.value)}
                placeholder="https://maps.app.goo.gl/... または空欄"
                className="w-full text-sm px-2.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              ※空欄の場合は、上記「開催場所」の名前をもとにGoogleマップの検索リンクが自動生成されます。
            </p>
          </div>

          {/* コート面数 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              コート面数・枠（任意）
            </label>
            <input
              type="text"
              value={courtCount}
              onChange={(e) => setCourtCount(e.target.value)}
              placeholder="例: 2面、第3コート"
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* メモ・備考 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              メモ・備考（任意）
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="例: 参加費500円（シャトル代込）、基礎打ち＆ダブルスゲーム形式、ラケット持参"
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* フッターアクション */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs sm:text-sm font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? '保存中...' : editingEvent ? '更新する' : '練習日を追加する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
