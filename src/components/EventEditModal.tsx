import React, { useState, useEffect } from 'react';
import type { PracticeEvent } from '../types';
import { X, Calendar, Clock, Link2, AlertCircle, ExternalLink } from 'lucide-react';
import { saveEvent } from '../services/storage';

export const DEFAULT_LOCATION = 'スポーツパーク川副';
export const DEFAULT_MAP_URL = 'https://maps.app.goo.gl/n3ZRedeMvSsXP6Lm6';

// 9:00〜17:00までの30分刻みオプション
export const TIME_OPTIONS = [
  '09:00', '09:30',
  '10:00', '10:30',
  '11:00', '11:30',
  '12:00', '12:30',
  '13:00', '13:30',
  '14:00', '14:30',
  '15:00', '15:30',
  '16:00', '16:30',
  '17:00'
];

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
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');

  // 開催場所の選択肢（'kawaso': スポーツパーク川副, 'other': その他・直接入力）
  const [locationType, setLocationType] = useState<'kawaso' | 'other'>('kawaso');
  const [customLocation, setCustomLocation] = useState('');
  const [customMapUrl, setCustomMapUrl] = useState('');

  const [courtCount, setCourtCount] = useState('2面');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingEvent) {
      setDate(editingEvent.date);
      setStartTime(editingEvent.startTime);
      setEndTime(editingEvent.endTime);
      setCourtCount(editingEvent.courtCount || '');
      setNotes(editingEvent.notes || '');

      if (editingEvent.location === DEFAULT_LOCATION) {
        setLocationType('kawaso');
        setCustomLocation('');
        setCustomMapUrl('');
      } else {
        setLocationType('other');
        setCustomLocation(editingEvent.location);
        setCustomMapUrl(editingEvent.mapUrl || '');
      }
    } else {
      setDate(initialDate || todayStr);
      setStartTime('09:00');
      setEndTime('12:00');
      setLocationType('kawaso');
      setCustomLocation('');
      setCustomMapUrl('');
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

    const finalLocation = locationType === 'kawaso' ? DEFAULT_LOCATION : customLocation.trim();
    const finalMapUrl = locationType === 'kawaso' ? DEFAULT_MAP_URL : (customMapUrl.trim() || undefined);

    if (!finalLocation) {
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
        location: finalLocation,
        mapUrl: finalMapUrl,
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
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* 時間帯（30分刻み 9:00〜17:00） */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                開始時間 <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center">
                <Clock className="w-4 h-4 text-slate-400 mr-1.5 shrink-0" />
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-full text-sm px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {!TIME_OPTIONS.includes(startTime) && (
                    <option value={startTime}>{startTime}</option>
                  )}
                  {TIME_OPTIONS.map((t) => (
                    <option key={'start_' + t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                終了時間 <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center">
                <Clock className="w-4 h-4 text-slate-400 mr-1.5 shrink-0" />
                <select
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="w-full text-sm px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {!TIME_OPTIONS.includes(endTime) && (
                    <option value={endTime}>{endTime}</option>
                  )}
                  {TIME_OPTIONS.map((t) => (
                    <option key={'end_' + t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 開催場所（プルダウン選択） */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              開催場所（施設名・体育館名） <span className="text-rose-500">*</span>
            </label>
            <select
              value={locationType}
              onChange={(e) => setLocationType(e.target.value as 'kawaso' | 'other')}
              className="w-full text-sm px-3 py-2.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="kawaso">スポーツパーク川副（デフォルト）</option>
              <option value="other">その他の体育館（直接入力）</option>
            </select>

            {/* スポーツパーク川副 選択時：自動設定の案内 */}
            {locationType === 'kawaso' && (
              <div className="mt-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <span className="text-sm">📍</span>
                  <span className="font-semibold">GoogleマップURL: 自動設定済み</span>
                </div>
                <a
                  href={DEFAULT_MAP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 hover:text-emerald-900 font-semibold underline flex items-center space-x-0.5 text-[11px]"
                >
                  <span>マップを確認</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              </div>
            )}
          </div>

          {/* その他の体育館 選択時：手動入力フィールド */}
          {locationType === 'other' && (
            <div className="space-y-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 animate-in fade-in slide-in-from-top-1 duration-150">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  体育館・施設名を入力 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  placeholder="例: 佐賀県総合体育館、〇〇市民体育館 など"
                  required
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Google マップURL（任意）
                </label>
                <div className="flex items-center">
                  <Link2 className="w-4 h-4 text-slate-400 mr-1.5 shrink-0" />
                  <input
                    type="url"
                    value={customMapUrl}
                    onChange={(e) => setCustomMapUrl(e.target.value)}
                    placeholder="https://maps.app.goo.gl/... または空欄"
                    className="w-full text-sm px-2.5 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  ※空欄の場合は、上記施設名をもとにGoogleマップの検索リンクが自動生成されます。
                </p>
              </div>
            </div>
          )}

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
