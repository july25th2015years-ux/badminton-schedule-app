import React, { useState, useEffect } from 'react';
import type { PracticeEvent, Attendance, SlotStatus } from '../types';
import {
  formatDateJa,
  getMonthDaysList,
  getDateAttendanceStats
} from '../utils/helpers';
import {
  Sun,
  Moon,
  Sparkles,
  Check,
  AlertCircle,
  Save,
  Plus,
  Award
} from 'lucide-react';
import { getStoredUserName, setStoredUserName, saveBulkAttendances } from '../services/storage';

interface MatrixViewProps {
  year: number;
  month: number;
  events: PracticeEvent[];
  attendances: Attendance[];
  onSelectEvent: (event: PracticeEvent) => void;
  onOpenAddModal: (dateStr?: string) => void;
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
  // その月の1日〜末日までの全日程リスト（30日または31日分）
  const daysList = getMonthDaysList(year, month);

  // 全参加者名のユニークリスト（名前順）
  const allUserNames = Array.from(
    new Set(
      attendances
        .filter((a) => a.userName && a.userName.trim())
        .map((a) => a.userName.trim())
    )
  ).sort((a, b) => a.localeCompare(b, 'ja'));

  // --- ポチポチ一括入力用の状態 ---
  const [userName, setUserName] = useState('');
  const [draftSlots, setDraftSlots] = useState<{ [dateStr: string]: DraftSlot }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // ユーザー名の復元と初期スロット設定
  useEffect(() => {
    const savedName = getStoredUserName();
    if (savedName) {
      setUserName(savedName);
      loadUserSlots(savedName);
    } else {
      loadUserSlots('');
    }
  }, [year, month, attendances]);

  const loadUserSlots = (name: string) => {
    const slots: { [dateStr: string]: DraftSlot } = {};
    const trimmed = name.trim().toLowerCase();

    daysList.forEach(day => {
      const event = events.find(e => e.date === day.date);
      const relevantIds = [day.date];
      if (event) relevantIds.push(event.id);

      const existing = trimmed ? attendances.find(
        a => relevantIds.includes(a.eventId) && a.userName.toLowerCase() === trimmed
      ) : null;

      if (existing) {
        slots[day.date] = {
          morningStatus: existing.morningStatus || (existing.status as any) || 'none',
          morningCondition: existing.morningCondition || (existing.status === 'triangle' ? existing.condition || '' : ''),
          afternoonStatus: existing.afternoonStatus || (existing.status as any) || 'none',
          afternoonCondition: existing.afternoonCondition || (existing.status === 'triangle' ? existing.condition || '' : ''),
        };
      } else {
        slots[day.date] = {
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
  const toggleSlot = (dateStr: string, slot: 'morning' | 'afternoon') => {
    setDraftSlots(prev => {
      const current = prev[dateStr] || {
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
        [dateStr]: {
          ...current,
          [`${slot}Status`]: nextStatus,
        },
      };
    });
  };

  // 土日の午前・午後をすべて◯
  const handleSelectWeekends = () => {
    setDraftSlots(prev => {
      const updated = { ...prev };
      daysList.forEach(day => {
        if (day.isWeekend) {
          updated[day.date] = {
            morningStatus: 'circle',
            morningCondition: '',
            afternoonStatus: 'circle',
            afternoonCondition: '',
          };
        }
      });
      return updated;
    });
  };

  // 土曜の午後だけ◯
  const handleSelectSaturdayAfternoons = () => {
    setDraftSlots(prev => {
      const updated = { ...prev };
      daysList.forEach(day => {
        if (day.isSaturday) {
          updated[day.date] = {
            ...(updated[day.date] || { morningStatus: 'none', morningCondition: '' }),
            afternoonStatus: 'circle',
            afternoonCondition: '',
          };
        }
      });
      return updated;
    });
  };

  // 日曜の午前だけ◯
  const handleSelectSundayMornings = () => {
    setDraftSlots(prev => {
      const updated = { ...prev };
      daysList.forEach(day => {
        if (day.isSunday) {
          updated[day.date] = {
            ...(updated[day.date] || { afternoonStatus: 'none', afternoonCondition: '' }),
            morningStatus: 'circle',
            morningCondition: '',
          };
        }
      });
      return updated;
    });
  };

  // 全日終日◯
  const handleSelectAllFullDay = () => {
    const slots: { [dateStr: string]: DraftSlot } = {};
    daysList.forEach(day => {
      slots[day.date] = {
        morningStatus: 'circle',
        morningCondition: '',
        afternoonStatus: 'circle',
        afternoonCondition: '',
      };
    });
    setDraftSlots(slots);
  };

  // クリア
  const handleClearAll = () => {
    const slots: { [dateStr: string]: DraftSlot } = {};
    daysList.forEach(day => {
      slots[day.date] = {
        morningStatus: 'none',
        morningCondition: '',
        afternoonStatus: 'none',
        afternoonCondition: '',
      };
    });
    setDraftSlots(slots);
  };

  // 一括保存
  const handleSaveBulk = async () => {
    const trimmedName = userName.trim();
    if (!trimmedName) {
      setErrorMsg('あなたのお名前を入力してください');
      return;
    }

    // △で条件未入力のものがないか検証
    for (const day of daysList) {
      const slot = draftSlots[day.date];
      if (slot) {
        if (slot.morningStatus === 'triangle' && !slot.morningCondition.trim()) {
          setErrorMsg(`${formatDateJa(day.date)} 午前の参加条件を入力してください`);
          return;
        }
        if (slot.afternoonStatus === 'triangle' && !slot.afternoonCondition.trim()) {
          setErrorMsg(`${formatDateJa(day.date)} 午後の参加条件を入力してください`);
          return;
        }
      }
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      const payload: Omit<Attendance, 'id' | 'updatedAt'>[] = [];
      daysList.forEach(day => {
        const slot = draftSlots[day.date];
        if (slot && (slot.morningStatus !== 'none' || slot.afternoonStatus !== 'none')) {
          const event = events.find(e => e.date === day.date);
          const targetId = event ? event.id : day.date;

          payload.push({
            eventId: targetId,
            userName: trimmedName,
            morningStatus: slot.morningStatus,
            morningCondition: slot.morningStatus === 'triangle' ? slot.morningCondition.trim() : undefined,
            afternoonStatus: slot.afternoonStatus,
            afternoonCondition: slot.afternoonStatus === 'triangle' ? slot.afternoonCondition.trim() : undefined,
          });
        }
      });

      await saveBulkAttendances(payload);
      setStoredUserName(trimmedName);
      setSaveSuccessMsg(`${trimmedName} さんの出欠を保存しました！下の表に反映されました。`);
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err) {
      console.error(err);
      setErrorMsg('保存中にエラーが発生しました');
    } finally {
      setIsSaving(false);
    }
  };

  // 最多参加者数の算出（ハイライト用）
  const maxAttendanceCount = Math.max(
    ...daysList.map(d => getDateAttendanceStats(d.date, events, attendances).totalAttendeesCount),
    0
  );

  return (
    <div className="space-y-5">
      {/* 1. ポチポチ出欠一括入力カード（その月の全日程1日〜末日） */}
      <div className="bg-white rounded-2xl shadow-sm border-2 border-emerald-500/30 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-3.5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <span className="text-xl">✍️</span>
            <div>
              <h3 className="text-sm sm:text-base font-bold">
                {year}年{month}月 あなたの出欠をポチポチ入力
              </h3>
              <p className="text-xs text-emerald-100">
                1日〜月末の来れる日（午前・午後）をタップして「◯」「△」をつけてください
              </p>
            </div>
          </div>

          {/* クイック選択ボタングループ */}
          <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto text-xs">
            <button
              type="button"
              onClick={handleSelectWeekends}
              className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-lg transition flex items-center space-x-1"
              title="土日の午前・午後をすべて◯にします"
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>土日を◯</span>
            </button>
            <button
              type="button"
              onClick={handleSelectSaturdayAfternoons}
              className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-lg transition"
              title="土曜日の午後だけを◯にします"
            >
              <span>土曜午後◯</span>
            </button>
            <button
              type="button"
              onClick={handleSelectSundayMornings}
              className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-lg transition"
              title="日曜日の午前だけを◯にします"
            >
              <span>日曜午前◯</span>
            </button>
            <button
              type="button"
              onClick={handleSelectAllFullDay}
              className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-lg transition"
            >
              <span>全日終日◯</span>
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="px-2 py-1 bg-black/20 hover:bg-black/30 text-emerald-100 rounded-lg transition text-[11px]"
            >
              <span>クリア</span>
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg text-xs text-rose-700 flex items-center space-x-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {saveSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-xs font-semibold text-emerald-800 flex items-center space-x-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* お名前入力欄 */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pb-3 border-b border-slate-100 bg-slate-50 p-3 rounded-xl">
            <label className="text-xs font-bold text-slate-800 sm:w-28 shrink-0">
              あなたのお名前 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="例: 田中、サトウ、ヨッシー"
              className="text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 max-w-sm font-semibold"
            />
            <span className="text-xs text-slate-500">
              （入力すると過去に回答した内容が自動復元されます）
            </span>
          </div>

          {/* 1日〜月末の全日程ボタングリッド */}
          <div className="max-h-[380px] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {daysList.map(day => {
                const slot = draftSlots[day.date] || {
                  morningStatus: 'none',
                  morningCondition: '',
                  afternoonStatus: 'none',
                  afternoonCondition: '',
                };

                const dayEvent = events.find(e => e.date === day.date);

                let badgeColor = 'text-slate-800';
                if (day.isSunday) badgeColor = 'text-rose-600 font-bold';
                if (day.isSaturday) badgeColor = 'text-sky-600 font-bold';

                return (
                  <div
                    key={'input_' + day.date}
                    className={`p-2.5 rounded-xl border transition flex flex-col justify-between space-y-1.5 ${
                      day.isToday
                        ? 'border-emerald-500 bg-emerald-50/30'
                        : day.isWeekend
                        ? 'border-slate-300 bg-slate-50/70'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {/* 日程ヘッダー */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-1.5">
                        <span className={`text-sm ${badgeColor}`}>
                          {day.dayNumber}日({day.weekday})
                        </span>
                        {day.isToday && (
                          <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded">
                            今日
                          </span>
                        )}
                      </div>
                      {dayEvent && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded truncate max-w-[120px]" title={dayEvent.location}>
                          🏸 {dayEvent.startTime}~ {dayEvent.location}
                        </span>
                      )}
                    </div>

                    {/* 午前・午後ポチポチボタン */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {/* 午前 */}
                      <button
                        type="button"
                        onClick={() => toggleSlot(day.date, 'morning')}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition flex items-center justify-between ${
                          slot.morningStatus === 'circle'
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                            : slot.morningStatus === 'triangle'
                            ? 'bg-amber-500 border-amber-500 text-white shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span className="flex items-center space-x-0.5 text-[11px]">
                          <Sun className="w-3 h-3 text-amber-400" />
                          <span>午前</span>
                        </span>
                        <span>{slot.morningStatus === 'circle' ? '◯ 参加' : slot.morningStatus === 'triangle' ? '△' : '-'}</span>
                      </button>

                      {/* 午後 */}
                      <button
                        type="button"
                        onClick={() => toggleSlot(day.date, 'afternoon')}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition flex items-center justify-between ${
                          slot.afternoonStatus === 'circle'
                            ? 'bg-teal-600 border-teal-600 text-white shadow-2xs'
                            : slot.afternoonStatus === 'triangle'
                            ? 'bg-amber-500 border-amber-500 text-white shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span className="flex items-center space-x-0.5 text-[11px]">
                          <Moon className="w-3 h-3 text-teal-400" />
                          <span>午後</span>
                        </span>
                        <span>{slot.afternoonStatus === 'circle' ? '◯ 参加' : slot.afternoonStatus === 'triangle' ? '△' : '-'}</span>
                      </button>
                    </div>

                    {/* △の場合の条件入力インライン */}
                    {(slot.morningStatus === 'triangle' || slot.afternoonStatus === 'triangle') && (
                      <div className="space-y-1 pt-0.5 text-[11px]">
                        {slot.morningStatus === 'triangle' && (
                          <input
                            type="text"
                            value={slot.morningCondition}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraftSlots(prev => ({
                                ...prev,
                                [day.date]: { ...prev[day.date], morningCondition: val }
                              }));
                            }}
                            placeholder="午前条件（例: 10:00から）*必須"
                            className="w-full px-2 py-0.5 rounded border border-amber-300 bg-white text-[11px]"
                          />
                        )}
                        {slot.afternoonStatus === 'triangle' && (
                          <input
                            type="text"
                            value={slot.afternoonCondition}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraftSlots(prev => ({
                                ...prev,
                                [day.date]: { ...prev[day.date], afternoonCondition: val }
                              }));
                            }}
                            placeholder="午後条件（例: 15:00早退）*必須"
                            className="w-full px-2 py-0.5 rounded border border-teal-300 bg-white text-[11px]"
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 保存ボタン */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              ※行ける日・来れる時間帯に◯をつけて下のボタンを押してください
            </span>
            <button
              type="button"
              onClick={handleSaveBulk}
              disabled={isSaving}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-8 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition active:scale-98 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? '保存中...' : 'この内容で出欠を一括保存する'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. 全体出欠マトリクス表（1日〜月末の全日程 × 全参加メンバー） */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center space-x-2">
              <span>📊 {year}年{month}月 メンバー出欠確認・日程調整表</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              1日〜月末までの全日程の参加希望人数が集計されています。人数が多い日を選んで開催できます！
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs text-slate-600">
            <span className="font-semibold bg-emerald-50 text-emerald-800 px-2 py-1 rounded border border-emerald-200">
              回答メンバー: {allUserNames.length}名
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                <th className="py-2.5 px-3 min-w-[130px] font-bold sticky left-0 bg-slate-100 z-10 shadow-[1px_0_0_0_#e2e8f0]">
                  日程・曜日
                </th>
                <th className="py-2.5 px-2 text-center min-w-[85px] font-bold text-amber-900 bg-amber-50/80">
                  午前 参加
                </th>
                <th className="py-2.5 px-2 text-center min-w-[85px] font-bold text-teal-900 bg-teal-50/80">
                  午後 参加
                </th>
                <th className="py-2.5 px-2 text-center min-w-[85px] font-bold text-emerald-900 bg-emerald-50/80">
                  合計人数
                </th>
                <th className="py-2.5 px-3 min-w-[170px] font-semibold text-slate-600">
                  開催設定（場所・時間）
                </th>
                {allUserNames.map((name) => (
                  <th
                    key={name}
                    className="py-2.5 px-2 text-center min-w-[95px] font-bold text-slate-800 border-l border-slate-200"
                  >
                    <span className="truncate block max-w-[85px] mx-auto" title={name}>
                      {name}
                    </span>
                  </th>
                ))}
                {allUserNames.length === 0 && (
                  <th className="py-2.5 px-4 text-center text-slate-400 font-normal">
                    上のフォームから最初のお名前と出欠を登録してください🏸
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {daysList.map((day) => {
                const stats = getDateAttendanceStats(day.date, events, attendances);
                const dayEvent = events.find(e => e.date === day.date);
                const isMax = maxAttendanceCount > 0 && stats.totalAttendeesCount === maxAttendanceCount;

                let rowBg = 'hover:bg-slate-50/80';
                if (day.isToday) rowBg = 'bg-emerald-50/30 hover:bg-emerald-50/60';
                else if (isMax && maxAttendanceCount >= 3) rowBg = 'bg-amber-50/30 hover:bg-amber-50/60';

                let dayTextColor = 'text-slate-800';
                if (day.isSunday) dayTextColor = 'text-rose-600 font-bold';
                else if (day.isSaturday) dayTextColor = 'text-sky-600 font-bold';

                return (
                  <tr key={day.date} className={`${rowBg} transition group`}>
                    {/* 日程セル（固定列） */}
                    <td className="py-2.5 px-3 sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[1px_0_0_0_#e2e8f0]">
                      <div className="flex items-center space-x-1.5">
                        <span className={`text-xs ${dayTextColor}`}>
                          {day.dayNumber}日({day.weekday})
                        </span>
                        {day.isToday && (
                          <span className="text-[9px] bg-emerald-600 text-white px-1 rounded font-bold">
                            今日
                          </span>
                        )}
                        {isMax && maxAttendanceCount >= 3 && (
                          <span className="inline-flex items-center text-[9px] bg-amber-400 text-amber-950 px-1 rounded font-bold">
                            <Award className="w-2.5 h-2.5 mr-0.5" />最多
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 午前 合計 */}
                    <td className="py-2.5 px-2 text-center bg-amber-50/20">
                      {stats.morningCircleCount > 0 || stats.morningTriangleCount > 0 ? (
                        <div>
                          <span className="font-bold text-emerald-700">◯ {stats.morningCircleCount}</span>
                          {stats.morningTriangleCount > 0 && (
                            <span className="text-[10px] text-amber-700 ml-1">△ {stats.morningTriangleCount}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* 午後 合計 */}
                    <td className="py-2.5 px-2 text-center bg-teal-50/20">
                      {stats.afternoonCircleCount > 0 || stats.afternoonTriangleCount > 0 ? (
                        <div>
                          <span className="font-bold text-teal-700">◯ {stats.afternoonCircleCount}</span>
                          {stats.afternoonTriangleCount > 0 && (
                            <span className="text-[10px] text-amber-700 ml-1">△ {stats.afternoonTriangleCount}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* 合計人数 */}
                    <td className="py-2.5 px-2 text-center font-bold bg-emerald-50/30">
                      {stats.totalAttendeesCount > 0 ? (
                        <span className="text-emerald-700 text-xs font-black">
                          {stats.totalAttendeesCount}名
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* 開催設定セル（イベントがある場合は表示、ない場合は作成ボタン） */}
                    <td className="py-2 px-3 text-xs">
                      {dayEvent ? (
                        <div
                          onClick={() => onSelectEvent(dayEvent)}
                          className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded p-1 cursor-pointer transition"
                        >
                          <div className="font-bold text-emerald-900 flex items-center justify-between">
                            <span>{dayEvent.startTime} - {dayEvent.endTime}</span>
                            <span className="text-[10px] text-emerald-700 underline">詳細</span>
                          </div>
                          <div className="text-[10px] text-slate-600 truncate max-w-[150px]">
                            {dayEvent.location}
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenAddModal(day.date)}
                          className="opacity-60 group-hover:opacity-100 inline-flex items-center space-x-1 text-[11px] text-emerald-700 hover:text-emerald-800 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 px-2 py-0.5 rounded transition"
                        >
                          <Plus className="w-3 h-3" />
                          <span>開催に決定する</span>
                        </button>
                      )}
                    </td>

                    {/* 各メンバーの回答（前 / 後） */}
                    {allUserNames.map((name) => {
                      const relevantIds = [day.date];
                      if (dayEvent) relevantIds.push(dayEvent.id);

                      const att = attendances.find(
                        a => relevantIds.includes(a.eventId) && a.userName.toLowerCase() === name.toLowerCase()
                      );

                      const mStatus = att?.morningStatus || (att?.status as any) || 'none';
                      const aStatus = att?.afternoonStatus || (att?.status as any) || 'none';
                      const mCond = att?.morningCondition || (att?.status === 'triangle' ? att?.condition : undefined);
                      const aCond = att?.afternoonCondition || (att?.status === 'triangle' ? att?.condition : undefined);

                      return (
                        <td
                          key={name}
                          className="py-2.5 px-2 text-center border-l border-slate-100"
                        >
                          {mStatus === 'none' && aStatus === 'none' ? (
                            <span className="text-slate-300">-</span>
                          ) : (
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
    </div>
  );
};
