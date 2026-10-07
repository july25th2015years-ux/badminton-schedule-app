import React, { useState, useEffect } from 'react';
import type { PracticeEvent, Attendance, SlotStatus } from '../types';
import { formatDateJa, getEventAttendanceStats } from '../utils/helpers';
import { MapPin, Clock, Sun, Moon, Sparkles, Check, AlertCircle, Save, Plus, RefreshCw } from 'lucide-react';
import { getStoredUserName, setStoredUserName, saveBulkAttendances, resetToSampleData } from '../services/storage';

interface MatrixViewProps {
  year: number;
  month: number;
  events: PracticeEvent[];
  attendances: Attendance[];
  onSelectEvent: (event: PracticeEvent) => void;
  onOpenAddModal: () => void;
}

interface DraftSlot {
  morningStatus: SlotStatus;
  morningCondition: string;
  afternoonStatus: SlotStatus;
  afternoonCondition: string;
}

export const MatrixView: React.FC<MatrixViewProps> = ({
  year,
  month,
  events,
  attendances,
  onSelectEvent,
  onOpenAddModal,
}) => {
  // 当月の日程のみ抽出
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const monthEvents = events
    .filter((e) => e.date.startsWith(monthPrefix))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  // 全参加者名のユニークリスト（名前順）
  const allUserNames = Array.from(
    new Set(
      attendances
        .filter((a) => monthEvents.some((e) => e.id === a.eventId))
        .map((a) => a.userName)
    )
  ).sort((a, b) => a.localeCompare(b, 'ja'));

  // --- ポチポチ一括入力用の状態 ---
  const [userName, setUserName] = useState('');
  const [draftSlots, setDraftSlots] = useState<{ [eventId: string]: DraftSlot }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // ユーザー名の復元と初期スロット設定
  useEffect(() => {
    const savedName = getStoredUserName();
    if (savedName) {
      setUserName(savedName);
      loadUserSlots(savedName);
    }
  }, [monthEvents.map(e => e.id).join(','), attendances]);

  const loadUserSlots = (name: string) => {
    const slots: { [eventId: string]: DraftSlot } = {};
    monthEvents.forEach(e => {
      const existing = attendances.find(
        a => a.eventId === e.id && a.userName.toLowerCase() === name.trim().toLowerCase()
      );
      if (existing) {
        slots[e.id] = {
          morningStatus: existing.morningStatus || (existing.status as any) || 'none',
          morningCondition: existing.morningCondition || (existing.status === 'triangle' ? existing.condition || '' : ''),
          afternoonStatus: existing.afternoonStatus || (existing.status as any) || 'none',
          afternoonCondition: existing.afternoonCondition || (existing.status === 'triangle' ? existing.condition || '' : ''),
        };
      } else {
        slots[e.id] = {
          morningStatus: 'none',
          morningCondition: '',
          afternoonStatus: 'none',
          afternoonCondition: '',
        };
      }
    });
    setDraftSlots(slots);
  };

  const handleNameChange = (name: string) => {
    setUserName(name);
    setErrorMsg('');
    loadUserSlots(name);
  };

  // スロットの切り替え（none -> circle -> triangle -> none）
  const toggleSlot = (eventId: string, slot: 'morning' | 'afternoon') => {
    setDraftSlots(prev => {
      const current = prev[eventId] || {
        morningStatus: 'none',
        morningCondition: '',
        afternoonStatus: 'none',
        afternoonCondition: '',
      };

      const currentStatus = slot === 'morning' ? current.morningStatus : current.afternoonStatus;
      let nextStatus: SlotStatus = 'circle';
      if (currentStatus === 'none') nextStatus = 'circle';
      else if (currentStatus === 'circle') nextStatus = 'triangle';
      else nextStatus = 'none';

      return {
        ...prev,
        [eventId]: {
          ...current,
          [`${slot}Status`]: nextStatus,
        },
      };
    });
  };

  // 全日程を一括で「終日参加」にする
  const handleSelectAllFullDay = () => {
    const slots: { [eventId: string]: DraftSlot } = {};
    monthEvents.forEach(e => {
      slots[e.id] = {
        morningStatus: 'circle',
        morningCondition: '',
        afternoonStatus: 'circle',
        afternoonCondition: '',
      };
    });
    setDraftSlots(slots);
  };

  // 一括保存
  const handleSaveBulk = async () => {
    const trimmedName = userName.trim();
    if (!trimmedName) {
      setErrorMsg('お名前を入力してください');
      return;
    }

    // △で条件未入力のものがないか検証
    for (const event of monthEvents) {
      const slot = draftSlots[event.id];
      if (slot) {
        if (slot.morningStatus === 'triangle' && !slot.morningCondition.trim()) {
          setErrorMsg(`${formatDateJa(event.date)} 午前の参加条件を入力してください`);
          return;
        }
        if (slot.afternoonStatus === 'triangle' && !slot.afternoonCondition.trim()) {
          setErrorMsg(`${formatDateJa(event.date)} 午後の参加条件を入力してください`);
          return;
        }
      }
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      const payload = monthEvents.map(event => {
        const slot = draftSlots[event.id] || {
          morningStatus: 'none',
          morningCondition: '',
          afternoonStatus: 'none',
          afternoonCondition: '',
        };
        return {
          eventId: event.id,
          userName: trimmedName,
          morningStatus: slot.morningStatus,
          morningCondition: slot.morningStatus === 'triangle' ? slot.morningCondition.trim() : undefined,
          afternoonStatus: slot.afternoonStatus,
          afternoonCondition: slot.afternoonStatus === 'triangle' ? slot.afternoonCondition.trim() : undefined,
        };
      });

      await saveBulkAttendances(payload);
      setStoredUserName(trimmedName);
      setSaveSuccessMsg('出欠を一括保存しました！');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
      setErrorMsg('保存中にエラーが発生しました');
    } finally {
      setIsSaving(false);
    }
  };

  if (monthEvents.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-10 text-center space-y-4">
        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-2xs">
          🏸
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800">
            {year}年{month}月の練習日（候補日）がまだ登録されていません
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            練習日を追加すると、ここに午前・午後の「ポチポチ出欠一括入力」フォームと、メンバー全員の出欠一覧表が表示されます。
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          <button
            onClick={onOpenAddModal}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-sm transition active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>この月に練習日を追加する</span>
          </button>
          <button
            onClick={() => resetToSampleData()}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>サンプル日程（スポーツパーク川副）をセット</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. ポチポチ出欠一括入力カード */}
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-500/30 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-3 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-lg">✍️</span>
            <div>
              <h3 className="text-sm font-bold">出欠をまとめて登録・ポチポチ入力</h3>
              <p className="text-[11px] text-emerald-100">
                ボタンをタップして「◯」「△」「-」を切り替えられます
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={onOpenAddModal}
              className="inline-flex items-center space-x-1 text-xs bg-white text-emerald-900 hover:bg-emerald-50 font-bold px-2.5 py-1 rounded-lg transition shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>練習日を追加</span>
            </button>
            <button
              type="button"
              onClick={handleSelectAllFullDay}
              className="inline-flex items-center space-x-1 text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-2.5 py-1 rounded-lg transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>すべて終日◯</span>
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg text-xs text-rose-700 flex items-center space-x-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {saveSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-xs text-emerald-800 flex items-center space-x-1.5 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* お名前入力 */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pb-2 border-b border-slate-100">
            <label className="text-xs font-bold text-slate-700 sm:w-24 shrink-0">
              あなたのお名前 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="例: 田中、サトウ"
              className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 max-w-xs"
            />
          </div>

          {/* 各日程の午前・午後ボタングリッド */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
            {monthEvents.map(event => {
              const slot = draftSlots[event.id] || {
                morningStatus: 'none',
                morningCondition: '',
                afternoonStatus: 'none',
                afternoonCondition: '',
              };

              return (
                <div
                  key={'bulk_' + event.id}
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition flex flex-col justify-between space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{formatDateJa(event.date)}</span>
                    <span className="text-[11px] text-slate-500">{event.startTime} - {event.endTime}</span>
                  </div>

                  {/* 午前・午後切り替えボタン */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* 午前ボタン */}
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => toggleSlot(event.id, 'morning')}
                        className={`w-full py-1.5 px-2 rounded-lg text-xs font-bold border transition flex items-center justify-between ${
                          slot.morningStatus === 'circle'
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                            : slot.morningStatus === 'triangle'
                            ? 'bg-amber-500 border-amber-500 text-white shadow-2xs'
                            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span className="flex items-center space-x-1">
                          <Sun className="w-3 h-3" />
                          <span>午前</span>
                        </span>
                        <span>{slot.morningStatus === 'circle' ? '◯ 参加' : slot.morningStatus === 'triangle' ? '△ 条件' : '- なし'}</span>
                      </button>

                      {slot.morningStatus === 'triangle' && (
                        <input
                          type="text"
                          value={slot.morningCondition}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraftSlots(prev => ({
                              ...prev,
                              [event.id]: { ...prev[event.id], morningCondition: val }
                            }));
                          }}
                          placeholder="午前の条件（必須）"
                          className="w-full text-[11px] px-2 py-1 rounded border border-amber-300 bg-white"
                        />
                      )}
                    </div>

                    {/* 午後ボタン */}
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => toggleSlot(event.id, 'afternoon')}
                        className={`w-full py-1.5 px-2 rounded-lg text-xs font-bold border transition flex items-center justify-between ${
                          slot.afternoonStatus === 'circle'
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                            : slot.afternoonStatus === 'triangle'
                            ? 'bg-amber-500 border-amber-500 text-white shadow-2xs'
                            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span className="flex items-center space-x-1">
                          <Moon className="w-3 h-3" />
                          <span>午後</span>
                        </span>
                        <span>{slot.afternoonStatus === 'circle' ? '◯ 参加' : slot.afternoonStatus === 'triangle' ? '△ 条件' : '- なし'}</span>
                      </button>

                      {slot.afternoonStatus === 'triangle' && (
                        <input
                          type="text"
                          value={slot.afternoonCondition}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraftSlots(prev => ({
                              ...prev,
                              [event.id]: { ...prev[event.id], afternoonCondition: val }
                            }));
                          }}
                          placeholder="午後の条件（必須）"
                          className="w-full text-[11px] px-2 py-1 rounded border border-teal-300 bg-white"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleSaveBulk}
              disabled={isSaving}
              className="inline-flex items-center space-x-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-sm transition active:scale-98 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? '保存中...' : 'この内容で出欠を一括保存する'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. 全体メンバー出欠マトリクス表 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-bold text-slate-700">
            {year}年{month}月 全体出欠一覧表
          </h3>
          <span className="text-xs text-slate-500">
            日程: {monthEvents.length}件 / 回答メンバー: {allUserNames.length}名
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                <th className="py-2.5 px-3 min-w-[150px] font-bold sticky left-0 bg-slate-100 z-10 shadow-[1px_0_0_0_#e2e8f0]">
                  日程・時間・場所
                </th>
                <th className="py-2.5 px-2 text-center min-w-[90px] font-bold text-amber-900 bg-amber-50/80">
                  午前 合計
                </th>
                <th className="py-2.5 px-2 text-center min-w-[90px] font-bold text-teal-900 bg-teal-50/80">
                  午後 合計
                </th>
                {allUserNames.map((name) => (
                  <th
                    key={name}
                    className="py-2.5 px-2 text-center min-w-[100px] font-bold text-slate-800 border-l border-slate-200"
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
                  <tr key={event.id} className="hover:bg-slate-50/80 transition group">
                    {/* 日程セル */}
                    <td
                      onClick={() => onSelectEvent(event)}
                      className="py-2.5 px-3 sticky left-0 bg-white group-hover:bg-slate-50/80 z-10 cursor-pointer shadow-[1px_0_0_0_#e2e8f0]"
                    >
                      <div className="font-bold text-slate-900 group-hover:text-emerald-700 transition">
                        {formatDateJa(event.date)}
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

                    {/* 午前 合計 */}
                    <td
                      onClick={() => onSelectEvent(event)}
                      className="py-2.5 px-2 text-center cursor-pointer bg-amber-50/30"
                    >
                      <span className="font-bold text-emerald-700">◯ {stats.morningCircleCount}</span>
                      {stats.morningTriangleCount > 0 && (
                        <span className="text-[10px] text-amber-700 ml-1">△ {stats.morningTriangleCount}</span>
                      )}
                    </td>

                    {/* 午後 合計 */}
                    <td
                      onClick={() => onSelectEvent(event)}
                      className="py-2.5 px-2 text-center cursor-pointer bg-teal-50/30"
                    >
                      <span className="font-bold text-emerald-700">◯ {stats.afternoonCircleCount}</span>
                      {stats.afternoonTriangleCount > 0 && (
                        <span className="text-[10px] text-teal-700 ml-1">△ {stats.afternoonTriangleCount}</span>
                      )}
                    </td>

                    {/* 各メンバーの回答（前 / 後） */}
                    {allUserNames.map((name) => {
                      const att = attendances.find(
                        a => a.eventId === event.id && a.userName.toLowerCase() === name.toLowerCase()
                      );

                      const mStatus = att?.morningStatus || (att?.status as any) || 'none';
                      const aStatus = att?.afternoonStatus || (att?.status as any) || 'none';
                      const mCond = att?.morningCondition || (att?.status === 'triangle' ? att?.condition : undefined);
                      const aCond = att?.afternoonCondition || (att?.status === 'triangle' ? att?.condition : undefined);

                      return (
                        <td
                          key={name}
                          onClick={() => onSelectEvent(event)}
                          className="py-2.5 px-2 text-center border-l border-slate-100 cursor-pointer"
                        >
                          <div className="flex items-center justify-center space-x-1">
                            {/* 午前バッジ */}
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                mStatus === 'circle'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : mStatus === 'triangle'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'text-slate-300'
                              }`}
                              title={mCond ? `午前: ${mCond}` : undefined}
                            >
                              前:{mStatus === 'circle' ? '◯' : mStatus === 'triangle' ? '△' : '-'}
                            </span>

                            {/* 午後バッジ */}
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                aStatus === 'circle'
                                  ? 'bg-teal-100 text-teal-800'
                                  : aStatus === 'triangle'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'text-slate-300'
                              }`}
                              title={aCond ? `午後: ${aCond}` : undefined}
                            >
                              後:{aStatus === 'circle' ? '◯' : aStatus === 'triangle' ? '△' : '-'}
                            </span>
                          </div>
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
    </div>
  );
};
