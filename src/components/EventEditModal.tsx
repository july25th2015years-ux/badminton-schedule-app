import React, { useState, useEffect } from 'react';
import type { PracticeEvent, LocationPreset } from '../types';
import { X, Calendar, Clock, Link2, AlertCircle, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { saveEvent, subscribeToLocations, saveLocation, deleteLocation, getInitialLocationPresets } from '../services/storage';

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

/**
 * 既存のコート情報文字列（例: "2面　AB", "1面 E", "2面"）から
 * 面数（数字）とコート名（記号等）を抽出する
 */
export function parseCourtCount(raw?: string): { count: string; court: string } {
  if (!raw) return { count: '', court: '' };
  const str = raw.trim();
  const match = str.match(/^(\d+)\s*面(?:\s*[\s,、　]\s*(.*))?$/);
  if (match) {
    return {
      count: match[1] || '',
      court: (match[2] || '').trim(),
    };
  }
  if (/^\d+$/.test(str)) {
    return { count: str, court: '' };
  }
  return { count: '', court: str };
}

/**
 * 入力された面数とコート名から保存用文字列を生成
 */
export function formatCourtCount(count: string, court: string): string {
  const c = count.trim();
  const name = court.trim();
  if (c && name) {
    return `${c}面　${name}`;
  }
  if (c) {
    return `${c}面`;
  }
  if (name) {
    return name;
  }
  return '';
}

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
  const todayStr = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(initialDate || todayStr);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');

  // 開催場所プリセット一覧（リアルタイム同期）
  const [presets, setPresets] = useState<LocationPreset[]>(getInitialLocationPresets());
  const [selectedPresetId, setSelectedPresetId] = useState<string>('loc_kawaso');
  const [customLocation, setCustomLocation] = useState('');
  const [customMapUrl, setCustomMapUrl] = useState('');
  const [saveDirectToPreset, setSaveDirectToPreset] = useState(false);

  // 新規場所追加フォームの表示・入力ステート
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newLocMapUrl, setNewLocMapUrl] = useState('');
  const [isSavingLoc, setIsSavingLoc] = useState(false);

  const [courtNumber, setCourtNumber] = useState('2');
  const [courtName, setCourtName] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // プリセットのリアルタイム購読
  useEffect(() => {
    const unsub = subscribeToLocations((locs) => {
      setPresets(locs);
    });
    return () => unsub();
  }, []);

  // モーダルオープン時・イベント変更時の初期化
  useEffect(() => {
    if (editingEvent) {
      setDate(editingEvent.date);
      setStartTime(editingEvent.startTime);
      setEndTime(editingEvent.endTime);
      const parsedCourt = parseCourtCount(editingEvent.courtCount);
      setCourtNumber(parsedCourt.count);
      setCourtName(parsedCourt.court);
      setNotes(editingEvent.notes || '');

      // 編集中の場所がプリセットにあるか照合
      const matched = presets.find(p => p.name === editingEvent.location);
      if (matched) {
        setSelectedPresetId(matched.id);
        setCustomLocation('');
        setCustomMapUrl('');
      } else {
        setSelectedPresetId('other');
        setCustomLocation(editingEvent.location);
        setCustomMapUrl(editingEvent.mapUrl || '');
      }
    } else {
      setDate(initialDate || todayStr);
      setStartTime('09:00');
      setEndTime('12:00');
      const defaultPreset = presets.find(p => p.isDefault) || presets[0];
      setSelectedPresetId(defaultPreset ? defaultPreset.id : 'loc_kawaso');
      setCustomLocation('');
      setCustomMapUrl('');
      setCourtNumber('2');
      setCourtName('');
      setNotes('');
    }
    setIsAddingLocation(false);
    setNewLocName('');
    setNewLocMapUrl('');
    setErrorMsg('');
  }, [editingEvent, initialDate, isOpen, presets.length]);

  if (!isOpen) return null;

  // 現在選択中のプリセット
  const currentPreset = presets.find(p => p.id === selectedPresetId);

  // 「+」からの新しい開催場所登録
  const handleAddNewLocation = async () => {
    const trimmedName = newLocName.trim();
    if (!trimmedName) {
      setErrorMsg('場所・体育館の名前を入力してください');
      return;
    }

    setIsSavingLoc(true);
    setErrorMsg('');
    try {
      const newId = await saveLocation({
        name: trimmedName,
        mapUrl: newLocMapUrl.trim() || undefined,
        isDefault: false,
      });
      setSelectedPresetId(newId);
      setIsAddingLocation(false);
      setNewLocName('');
      setNewLocMapUrl('');
    } catch (err) {
      console.error(err);
      setErrorMsg('場所の保存に失敗しました');
    } finally {
      setIsSavingLoc(false);
    }
  };

  // 選択中プリセットの削除
  const handleDeleteCurrentLocation = async (preset: LocationPreset) => {
    if (preset.isDefault) {
      alert('デフォルトの場所は削除できません');
      return;
    }
    if (window.confirm(`「${preset.name}」をプルダウンの選択肢から削除しますか？`)) {
      try {
        await deleteLocation(preset.id);
        const defaultPreset = presets.find(p => p.isDefault) || presets[0];
        setSelectedPresetId(defaultPreset ? defaultPreset.id : 'other');
      } catch (err) {
        console.error(err);
        alert('削除に失敗しました');
      }
    }
  };

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

    let finalLocation = '';
    let finalMapUrl: string | undefined = undefined;

    if (selectedPresetId === 'other') {
      finalLocation = customLocation.trim();
      finalMapUrl = customMapUrl.trim() || undefined;

      // 「次回以降もプルダウンで使えるように保存」がチェックされている場合
      if (saveDirectToPreset && finalLocation) {
        try {
          await saveLocation({
            name: finalLocation,
            mapUrl: finalMapUrl,
            isDefault: false,
          });
        } catch (e) {
          console.error('Failed to auto-save location preset:', e);
        }
      }
    } else if (currentPreset) {
      finalLocation = currentPreset.name;
      finalMapUrl = currentPreset.mapUrl;
    }

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
        courtCount: formatCourtCount(courtNumber, courtName) || undefined,
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

          {/* 開催場所（プルダウン選択 ＆ 「+」追加・削除） */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                開催場所（施設名・体育館名） <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsAddingLocation(!isAddingLocation)}
                className="inline-flex items-center space-x-1 text-xs text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 font-bold px-2 py-0.5 rounded-md transition border border-emerald-200 active:scale-95"
                title="新しい場所とGoogleマップリンクを登録"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>場所を追加</span>
              </button>
            </div>

            {/* 「+」押下時の新規場所追加フォーム */}
            {isAddingLocation && (
              <div className="mb-3 p-3 rounded-xl bg-emerald-50/80 border border-emerald-300 animate-in fade-in slide-in-from-top-1 duration-150 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 flex items-center space-x-1">
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>プルダウンに新しい場所を追加</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingLocation(false);
                      setNewLocName('');
                      setNewLocMapUrl('');
                    }}
                    className="text-slate-400 hover:text-slate-600 text-xs p-0.5"
                    aria-label="閉じる"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                    施設名・体育館名 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newLocName}
                    onChange={(e) => setNewLocName(e.target.value)}
                    placeholder="例: 佐賀県総合体育館、〇〇市民体育館"
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                    GoogleマップのURL <span className="text-slate-400 font-normal">（任意）</span>
                  </label>
                  <input
                    type="url"
                    value={newLocMapUrl}
                    onChange={(e) => setNewLocMapUrl(e.target.value)}
                    placeholder="https://maps.app.goo.gl/... または空欄"
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    ※空欄の場合は施設名から自動的にGoogleマップの検索リンクが作られます
                  </p>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingLocation(false);
                      setNewLocName('');
                      setNewLocMapUrl('');
                    }}
                    className="px-2.5 py-1 text-xs text-slate-600 hover:bg-white rounded-md border border-slate-200 transition"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleAddNewLocation}
                    disabled={!newLocName.trim() || isSavingLoc}
                    className="px-3 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-2xs disabled:opacity-50 transition"
                  >
                    {isSavingLoc ? '保存中...' : 'プルダウンに登録して選択'}
                  </button>
                </div>
              </div>
            )}

            {/* プルダウン選択 & 削除ボタン */}
            <div className="flex items-center space-x-2">
              <select
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.isDefault ? '（デフォルト）' : ''}
                  </option>
                ))}
                <option value="other">その他の体育館（直接入力）</option>
              </select>

              {/* デフォルト以外のプリセット選択時は削除ボタンを表示 */}
              {currentPreset && !currentPreset.isDefault && (
                <button
                  type="button"
                  onClick={() => handleDeleteCurrentLocation(currentPreset)}
                  className="p-2.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition shrink-0"
                  title={`「${currentPreset.name}」をプルダウンから削除`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* 選択中プリセットの案内表示（GoogleマップURLリンク） */}
            {currentPreset && (
              <div className="mt-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
                <div className="flex items-center space-x-1.5 truncate mr-2">
                  <span className="text-sm shrink-0">📍</span>
                  <span className="font-semibold truncate">
                    Googleマップ: {currentPreset.mapUrl ? 'URL登録済み' : '施設名から自動検索'}
                  </span>
                </div>
                {currentPreset.mapUrl && (
                  <a
                    href={currentPreset.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 hover:text-emerald-900 font-semibold underline flex items-center space-x-0.5 text-[11px] shrink-0"
                  >
                    <span>マップを確認</span>
                    <ExternalLink className="w-3 h-3 ml-0.5" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* その他の体育館 選択時：手動入力フィールド */}
          {selectedPresetId === 'other' && (
            <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 animate-in fade-in slide-in-from-top-1 duration-150">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  体育館・施設名を入力 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  placeholder="例: 佐賀県総合体育館、〇〇市民体育館 など"
                  required={selectedPresetId === 'other'}
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

              {/* 次回以降も使えるようにプルダウンに保存するチェックボックス */}
              <div className="pt-1 flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="saveDirectToPreset"
                  checked={saveDirectToPreset}
                  onChange={(e) => setSaveDirectToPreset(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="saveDirectToPreset" className="text-xs text-slate-700 cursor-pointer font-medium select-none">
                  この場所を次回以降も選べるようにプルダウンに登録する
                </label>
              </div>
            </div>
          )}

          {/* コート数・コート記号 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              コート情報（任意）
            </label>
            <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200 space-y-2">
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
                {/* コート数 "数字を入力" 面 */}
                <div className="flex items-center space-x-1.5 shrink-0">
                  <span className="text-xs font-bold text-slate-700 shrink-0">コート数</span>
                  <div className="flex items-center bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 w-20">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={courtNumber}
                      onChange={(e) => setCourtNumber(e.target.value)}
                      placeholder="数字"
                      className="w-full text-center text-sm font-bold text-slate-800 bg-transparent focus:outline-none"
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-700 shrink-0">面</span>
                </div>

                <span className="hidden sm:inline text-slate-300 font-light">|</span>

                {/* コート "A,Bなど" */}
                <div className="flex items-center space-x-1.5 flex-1 min-w-[150px]">
                  <span className="text-xs font-bold text-slate-700 shrink-0">コート</span>
                  <div className="flex items-center bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 w-full">
                    <input
                      type="text"
                      value={courtName}
                      onChange={(e) => setCourtName(e.target.value)}
                      placeholder="A,Bなど"
                      className="w-full text-sm text-slate-800 bg-transparent focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* プレビュー表示 */}
              {(courtNumber.trim() || courtName.trim()) && (
                <div className="pt-1.5 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span>表示プレビュー:</span>
                  <span className="font-bold text-emerald-800 bg-emerald-100/80 border border-emerald-200 px-2 py-0.5 rounded">
                    {formatCourtCount(courtNumber, courtName)}
                  </span>
                </div>
              )}
            </div>
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
