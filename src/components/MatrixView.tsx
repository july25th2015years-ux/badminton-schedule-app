import React, { useState, useEffect, useRef } from 'react';
import type { PracticeEvent, Attendance, SlotStatus } from '../types';
import {
  formatDateJa,
  getMonthDaysList,
  getDateAttendanceStats,
  getCalendarGrid,
  WEEKDAYS_JA
} from '../utils/helpers';
import {
  Sparkles,
  Check,
  AlertCircle,
  Save,
  Plus,
  Award,
  Pencil
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

interface MissingConditionItem {
  date: string;
  formattedDate: string;
  slotText: string;
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

  // カレンダー形式表示用のグリッド（日曜始まり7列、前月・翌月パディングを含む）
  const calendarDays = getCalendarGrid(year, month, events);

  // 全参加者名のユニークリスト（名前順）
  const allUserNames = Array.from(
    new Set(
      attendances
        .filter((a) => a.userName && a.userName.trim())
        .map((a) => a.userName.trim())
    )
  ).sort((a, b) => a.localeCompare(b, 'ja'));

  // --- ポチポチ一括入力用の状態 ---
  const inputCardRef = useRef<HTMLDivElement>(null);
  const [userName, setUserName] = useState('');
  const [draftSlots, setDraftSlots] = useState<{ [dateStr: string]: DraftSlot }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [editingUserNotice, setEditingUserNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [missingConditionModalData, setMissingConditionModalData] = useState<MissingConditionItem[] | null>(null);

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

  // 表の名前をクリックして再編集モードに切り替え
  const handleSelectUserToEdit = (name: string) => {
    handleNameChange(name);
    setEditingUserNotice(`${name} さんの出欠回答を呼び出しました。カレンダーで修正し、下の［この内容で出欠を一括保存する］を押してください。`);
    if (inputCardRef.current) {
      inputCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setTimeout(() => {
      setEditingUserNotice('');
    }, 7000);
  };

  const todayObj = new Date();
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

  // スロットの切り替え（none -> circle -> triangle -> none）※過去日は操作不可
  const toggleSlot = (dateStr: string, slot: 'morning' | 'afternoon') => {
    if (dateStr < todayStr) return;

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

  // 土日の午前・午後をすべて◯（今日以降のみ）
  const handleSelectWeekends = () => {
    setDraftSlots(prev => {
      const updated = { ...prev };
      daysList.forEach(day => {
        if (day.isWeekend && day.date >= todayStr) {
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

  // 土曜の午後だけ◯（今日以降のみ）
  const handleSelectSaturdayAfternoons = () => {
    setDraftSlots(prev => {
      const updated = { ...prev };
      daysList.forEach(day => {
        if (day.isSaturday && day.date >= todayStr) {
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

  // 日曜の午前だけ◯（今日以降のみ）
  const handleSelectSundayMornings = () => {
    setDraftSlots(prev => {
      const updated = { ...prev };
      daysList.forEach(day => {
        if (day.isSunday && day.date >= todayStr) {
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

  // 全日終日◯（今日以降のみ）
  const handleSelectAllFullDay = () => {
    setDraftSlots(prev => {
      const updated = { ...prev };
      daysList.forEach(day => {
        if (day.date >= todayStr) {
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

  // クリア（今日以降のみ）
  const handleClearAll = () => {
    setDraftSlots(prev => {
      const updated = { ...prev };
      daysList.forEach(day => {
        if (day.date >= todayStr) {
          updated[day.date] = {
            morningStatus: 'none',
            morningCondition: '',
            afternoonStatus: 'none',
            afternoonCondition: '',
          };
        }
      });
      return updated;
    });
  };

  // 一括保存
  const handleSaveBulk = async () => {
    const trimmedName = userName.trim();
    if (!trimmedName) {
      setErrorMsg('あなたのお名前を入力してください');
      return;
    }

    // △で条件未入力のものがないか検証（未入力があればポップアップで注意を促し保存をブロック）
    const missingItems: MissingConditionItem[] = [];
    for (const day of daysList) {
      const slot = draftSlots[day.date];
      if (slot) {
        const isMorningMissing = slot.morningStatus === 'triangle' && !slot.morningCondition.trim();
        const isAfternoonMissing = slot.afternoonStatus === 'triangle' && !slot.afternoonCondition.trim();

        if (isMorningMissing || isAfternoonMissing) {
          let slotText = '';
          if (isMorningMissing && isAfternoonMissing) slotText = '午前・午後';
          else if (isMorningMissing) slotText = '午前';
          else slotText = '午後';

          missingItems.push({
            date: day.date,
            formattedDate: formatDateJa(day.date),
            slotText,
          });
        }
      }
    }

    if (missingItems.length > 0) {
      setMissingConditionModalData(missingItems);
      return; // 条件が入力されていないまま保存は絶対にできないようにブロック
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

  // 「ヨッシー」の表記ゆれ判定ヘルパー
  const isYosshyName = (n: string) => {
    const norm = n.trim().toLowerCase();
    return norm === 'ヨッシー' || norm === 'よっしー' || norm === 'yosshy' || norm === 'yossy';
  };

  // 「ヨッシーが参加できる日で、ヨッシー以外が2人以上参加できる日」を判定
  const checkIsYosshyAndTwoOthers = (dateStr: string) => {
    const dayEvent = events.find(e => e.date === dateStr);
    const relevantIds = [dateStr];
    if (dayEvent) relevantIds.push(dayEvent.id);

    // ヨッシーの出欠
    const yosshyAtt = attendances.find(
      a => relevantIds.includes(a.eventId) && isYosshyName(a.userName)
    );
    const yosshyM = yosshyAtt?.morningStatus || (yosshyAtt?.status as any) || 'none';
    const yosshyA = yosshyAtt?.afternoonStatus || (yosshyAtt?.status as any) || 'none';
    const isYosshyAttending = yosshyM === 'circle' || yosshyM === 'triangle' || yosshyA === 'circle' || yosshyA === 'triangle';

    if (!isYosshyAttending) return false;

    // ヨッシー以外の参加者数（午前または午後に◯または△）
    const otherAttendees = allUserNames.filter(name => {
      if (isYosshyName(name)) return false;
      const att = attendances.find(
        a => relevantIds.includes(a.eventId) && a.userName.toLowerCase() === name.toLowerCase()
      );
      const m = att?.morningStatus || (att?.status as any) || 'none';
      const a = att?.afternoonStatus || (att?.status as any) || 'none';
      return m === 'circle' || m === 'triangle' || a === 'circle' || a === 'triangle';
    });

    return otherAttendees.length >= 2;
  };

  // 最多参加者数の算出（ハイライト用）
  const maxAttendanceCount = Math.max(
    ...daysList.map(d => getDateAttendanceStats(d.date, events, attendances).totalAttendeesCount),
    0
  );

  return (
    <div className="space-y-5">
      {/* 1. ポチポチ出欠一括入力カード（その月の全日程1日〜末日） */}
      <div ref={inputCardRef} className="bg-white rounded-2xl shadow-sm border-2 border-emerald-500/30 overflow-hidden">
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

          {editingUserNotice && (
            <div className="bg-sky-50 border border-sky-300 p-3 rounded-xl text-xs font-semibold text-sky-900 flex items-center space-x-2 animate-in fade-in">
              <Pencil className="w-4 h-4 text-sky-600 shrink-0" />
              <span>{editingUserNotice}</span>
            </div>
          )}

          {/* お名前入力欄 */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pb-3 border-b border-slate-100 bg-slate-50 p-3 rounded-xl">
            <label className="text-xs font-bold text-slate-800 sm:w-28 shrink-0">
              あなたのお名前 <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center space-x-2 flex-1 max-w-sm">
              <input
                type="text"
                value={userName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="例: 田中、サトウ、ヨッシー"
                className="text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full font-semibold"
              />
              {userName && allUserNames.some(n => n.toLowerCase() === userName.trim().toLowerCase()) && (
                <span className="shrink-0 inline-flex items-center space-x-1 px-2 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                  <Pencil className="w-3 h-3 text-emerald-600" />
                  <span>修正中</span>
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500">
              （入力または下の名前クリックで過去の回答を復元）
            </span>
          </div>

          {/* カレンダー形式（日曜始まり7列）の出欠入力グリッド */}
          <div className="space-y-3">
            <div className="overflow-x-auto pb-1">
              <div className="min-w-[620px] bg-white rounded-xl border-2 border-slate-400 overflow-hidden shadow-xs">
                {/* 曜日ヘッダー（境界線をはっきり濃く） */}
                <div className="grid grid-cols-7 border-b-2 border-slate-400 bg-slate-200 divide-x divide-slate-400 text-center text-xs font-bold">
                  {WEEKDAYS_JA.map((dayName, idx) => {
                    let textColor = 'text-slate-800';
                    if (idx === 0) textColor = 'text-rose-600 bg-rose-100/50';
                    if (idx === 6) textColor = 'text-sky-600 bg-sky-100/50';
                    return (
                      <div key={dayName} className={`py-2 ${textColor}`}>
                        {dayName}
                      </div>
                    );
                  })}
                </div>

                {/* カレンダー日付グリッド（縦線・横線をはっきり濃く） */}
                <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-400">
                  {calendarDays.map((day) => {
                    // 当月外のパディングセル
                    if (!day.isCurrentMonth) {
                      return (
                        <div
                          key={'pad_' + day.date}
                          className="min-h-[92px] p-1.5 bg-slate-100/60 flex flex-col justify-between"
                        >
                          <span className="text-xs text-slate-400 font-medium select-none">
                            {day.dayNumber}
                          </span>
                        </div>
                      );
                    }

                    // 当月セル
                    const [y, m, d] = day.date.split('-').map(Number);
                    const dayOfWeek = new Date(y, m - 1, d).getDay();
                    const isSunday = dayOfWeek === 0;
                    const isSaturday = dayOfWeek === 6;
                    const isPast = day.date < todayStr; // 過去日付の判定

                    const slot = draftSlots[day.date] || {
                      morningStatus: 'none',
                      morningCondition: '',
                      afternoonStatus: 'none',
                      afternoonCondition: '',
                    };

                    const dayEvent = events.find((e) => e.date === day.date);

                    let dayNumberStyle = 'text-slate-800 font-semibold';
                    if (isPast) {
                      dayNumberStyle = 'text-slate-400 font-normal';
                    } else if (day.isToday) {
                      dayNumberStyle = 'bg-emerald-600 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs shadow-xs';
                    } else if (isSunday) {
                      dayNumberStyle = 'text-rose-600 font-bold';
                    } else if (isSaturday) {
                      dayNumberStyle = 'text-sky-600 font-bold';
                    }

                    let cellBg = 'bg-white';
                    if (isPast) {
                      cellBg = 'bg-slate-100/80';
                    } else if (day.isToday) {
                      cellBg = 'bg-emerald-50/40 ring-1 ring-inset ring-emerald-400';
                    } else if (isSunday) {
                      cellBg = 'bg-rose-50/20';
                    } else if (isSaturday) {
                      cellBg = 'bg-sky-50/20';
                    }

                    return (
                      <div
                        key={'cal_input_' + day.date}
                        className={`min-h-[92px] p-1.5 flex flex-col justify-between transition ${cellBg}`}
                      >
                        {/* 日付ヘッダー */}
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs ${dayNumberStyle}`}>
                            {day.dayNumber}
                          </span>
                          <div className="flex items-center space-x-1">
                            {isPast && (
                              <span className="text-[9px] text-slate-400 bg-slate-200/80 px-1 py-0.2 rounded font-medium">
                                過去
                              </span>
                            )}
                            {dayEvent && (
                              <span
                                className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded truncate max-w-[55px]"
                                title={`🏸 ${dayEvent.startTime}~ ${dayEvent.location}`}
                              >
                                🏸
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 午前・午後トグルボタン ＆ セル内条件表示 */}
                        <div className="space-y-1">
                          {/* 午前ボタン */}
                          <button
                            type="button"
                            disabled={isPast}
                            onClick={() => toggleSlot(day.date, 'morning')}
                            title={isPast ? '過去の日付は入力できません' : '午前: タップで ◯ / △ / - を切り替え'}
                            className={`w-full py-1 px-1 rounded text-[11px] font-bold border transition flex items-center justify-between shadow-2xs ${
                              isPast
                                ? 'bg-slate-200/60 border-slate-300 text-slate-400 cursor-not-allowed opacity-60'
                                : slot.morningStatus === 'circle'
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : slot.morningStatus === 'triangle'
                                ? 'bg-amber-500 border-amber-500 text-white'
                                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <span className="text-[10px] opacity-90">前</span>
                            <span className="font-extrabold">
                              {slot.morningStatus === 'circle' ? '◯' : slot.morningStatus === 'triangle' ? '△' : '-'}
                            </span>
                          </button>

                          {/* 午前△のセル内条件表示・入力 */}
                          {!isPast && slot.morningStatus === 'triangle' && (
                            <div className="pt-0.5">
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
                                placeholder="午前△の条件"
                                title="午前の参加条件を入力してください"
                                className="w-full px-1 py-0.5 rounded border border-amber-400 bg-amber-50 text-[10px] text-amber-950 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                              />
                            </div>
                          )}

                          {/* 午後ボタン */}
                          <button
                            type="button"
                            disabled={isPast}
                            onClick={() => toggleSlot(day.date, 'afternoon')}
                            title={isPast ? '過去の日付は入力できません' : '午後: タップで ◯ / △ / - を切り替え'}
                            className={`w-full py-1 px-1 rounded text-[11px] font-bold border transition flex items-center justify-between shadow-2xs ${
                              isPast
                                ? 'bg-slate-200/60 border-slate-300 text-slate-400 cursor-not-allowed opacity-60'
                                : slot.afternoonStatus === 'circle'
                                ? 'bg-teal-600 border-teal-600 text-white'
                                : slot.afternoonStatus === 'triangle'
                                ? 'bg-amber-500 border-amber-500 text-white'
                                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <span className="text-[10px] opacity-90">後</span>
                            <span className="font-extrabold">
                              {slot.afternoonStatus === 'circle' ? '◯' : slot.afternoonStatus === 'triangle' ? '△' : '-'}
                            </span>
                          </button>

                          {/* 午後△のセル内条件表示・入力 */}
                          {!isPast && slot.afternoonStatus === 'triangle' && (
                            <div className="pt-0.5">
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
                                placeholder="午後△の条件"
                                title="午後の参加条件を入力してください"
                                className="w-full px-1 py-0.5 rounded border border-teal-400 bg-teal-50 text-[10px] text-teal-950 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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
            <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>1日〜月末までの全日程の参加希望人数が集計されています。</span>
              <span className="text-emerald-700 font-semibold inline-block">
                💡 お名前をクリックすると出欠を再度修正できます
              </span>
              <span className="inline-flex items-center space-x-1 bg-yellow-100 text-yellow-900 border border-yellow-300 px-2 py-0.5 rounded font-bold">
                <span>⭐ 黄色ハイライト: ヨッシー＋他2名以上が参加できる日</span>
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs text-slate-600">
            <span className="font-semibold bg-emerald-50 text-emerald-800 px-2 py-1 rounded border border-emerald-200">
              回答メンバー: {allUserNames.length}名
            </span>
          </div>
        </div>

        {/* スクロールコンテナ（縦・横スクロール可能、最大高さ指定） */}
        <div className="overflow-auto max-h-[520px] border-b border-slate-200 relative">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-100 shadow-xs">
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                <th className="py-2.5 px-3 min-w-[130px] font-bold sticky left-0 top-0 bg-slate-100 z-30 shadow-[1px_0_0_0_#e2e8f0]">
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
                {allUserNames.map((name) => {
                  const isCurrent = userName.trim().toLowerCase() === name.toLowerCase();
                  return (
                    <th
                      key={name}
                      className={`py-2 px-1 text-center min-w-[100px] font-bold border-l border-slate-200 transition ${
                        isCurrent ? 'bg-emerald-50' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectUserToEdit(name)}
                        className={`group/btn inline-flex items-center justify-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold transition mx-auto shadow-2xs ${
                          isCurrent
                            ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                            : 'bg-white hover:bg-emerald-50 text-slate-800 hover:text-emerald-700 border border-slate-300 hover:border-emerald-400'
                        }`}
                        title={`${name} さんの出欠を再修正する（クリックでフォームに呼び出し）`}
                      >
                        <span className="truncate max-w-[70px]">{name}</span>
                        <Pencil
                          className={`w-3 h-3 shrink-0 ${
                            isCurrent
                              ? 'text-white'
                              : 'text-slate-400 group-hover/btn:text-emerald-600'
                          }`}
                        />
                      </button>
                    </th>
                  );
                })}
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
                const isYosshyAndTwoOthers = checkIsYosshyAndTwoOthers(day.date);

                let rowBg = 'hover:bg-slate-50/80';
                let stickyColBg = 'bg-white group-hover:bg-slate-50';
                let morningColBg = 'bg-amber-50/20';
                let afternoonColBg = 'bg-teal-50/20';
                let totalColBg = 'bg-emerald-50/30';

                if (isYosshyAndTwoOthers) {
                  // ヨッシーが参加でき、他2名以上が参加できる日を黄色で背景をぬる
                  rowBg = 'bg-yellow-100/90 hover:bg-yellow-200/90 font-medium';
                  stickyColBg = 'bg-yellow-100 group-hover:bg-yellow-200';
                  morningColBg = 'bg-yellow-200/40';
                  afternoonColBg = 'bg-yellow-200/40';
                  totalColBg = 'bg-yellow-300/40';
                } else if (day.isToday) {
                  rowBg = 'bg-emerald-50/30 hover:bg-emerald-50/60';
                  stickyColBg = 'bg-emerald-50/50 group-hover:bg-emerald-100/50';
                } else if (isMax && maxAttendanceCount >= 3) {
                  rowBg = 'bg-amber-50/30 hover:bg-amber-50/60';
                  stickyColBg = 'bg-amber-50/40 group-hover:bg-amber-100/40';
                }

                let dayTextColor = 'text-slate-800';
                if (day.isSunday) dayTextColor = 'text-rose-600 font-bold';
                else if (day.isSaturday) dayTextColor = 'text-sky-600 font-bold';

                return (
                  <tr key={day.date} className={`${rowBg} transition group`}>
                    {/* 日程セル（固定列） */}
                    <td className={`py-2.5 px-3 sticky left-0 ${stickyColBg} z-10 shadow-[1px_0_0_0_#e2e8f0] transition`}>
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <span className={`text-xs ${dayTextColor}`}>
                          {day.dayNumber}日({day.weekday})
                        </span>
                        {isYosshyAndTwoOthers && (
                          <span className="text-[9px] bg-yellow-400 text-yellow-950 px-1.5 py-0.5 rounded font-black border border-yellow-500 shadow-2xs whitespace-nowrap">
                            ⭐ヨッシー+2名
                          </span>
                        )}
                        {day.isToday && (
                          <span className="text-[9px] bg-emerald-600 text-white px-1 rounded font-bold">
                            今日
                          </span>
                        )}
                        {isMax && maxAttendanceCount >= 3 && !isYosshyAndTwoOthers && (
                          <span className="inline-flex items-center text-[9px] bg-amber-400 text-amber-950 px-1 rounded font-bold">
                            <Award className="w-2.5 h-2.5 mr-0.5" />最多
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 午前 合計 */}
                    <td className={`py-2.5 px-2 text-center ${morningColBg}`}>
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
                    <td className={`py-2.5 px-2 text-center ${afternoonColBg}`}>
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
                    <td className={`py-2.5 px-2 text-center font-bold ${totalColBg}`}>
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
                          className="py-2 px-1.5 text-center border-l border-slate-200"
                        >
                          {mStatus === 'none' && aStatus === 'none' ? (
                            <span className="text-slate-300">-</span>
                          ) : (
                            <div className="flex flex-col items-center justify-center space-y-1">
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

                              {/* △の条件テキスト表示 */}
                              {(mCond || aCond) && (
                                <div className="space-y-0.5 w-full">
                                  {mCond && (
                                    <div
                                      className="text-[9px] text-amber-900 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded truncate max-w-[85px] mx-auto"
                                      title={`午前: ${mCond}`}
                                    >
                                      前:{mCond}
                                    </div>
                                  )}
                                  {aCond && (
                                    <div
                                      className="text-[9px] text-teal-900 bg-teal-50 border border-teal-200 px-1 py-0.2 rounded truncate max-w-[85px] mx-auto"
                                      title={`午後: ${aCond}`}
                                    >
                                      後:{aCond}
                                    </div>
                                  )}
                                </div>
                              )}
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

      {/* △条件未入力の警告ポップアップモーダル */}
      {missingConditionModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border-2 border-amber-400 overflow-hidden transform animate-in zoom-in-95 duration-150">
            <div className="bg-amber-500 text-white p-4 flex items-center space-x-3">
              <AlertCircle className="w-6 h-6 text-white shrink-0" />
              <div>
                <h3 className="font-bold text-base">参加条件を入力してください</h3>
                <p className="text-xs text-amber-100">
                  「△」を選択している日程の条件が未入力です
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">
                出欠で「△」を選んだ場合は、参加可能な条件（例: 「10時以降なら可」「用事次第」など）の入力が必要です。
                <br />
                以下の日程の条件を入力してから再度保存してください。
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2">
                <div className="text-[11px] font-bold text-amber-900 mb-1">
                  【条件が未入力の日程】
                </div>
                {missingConditionModalData.map((item) => (
                  <div
                    key={item.date}
                    className="flex items-center justify-between text-xs bg-white px-3 py-2 rounded-lg border border-amber-200 text-slate-800"
                  >
                    <span className="font-bold text-amber-950">
                      📅 {item.formattedDate}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      {item.slotText}：△ 未入力
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setMissingConditionModalData(null)}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-bold text-xs shadow-md transition"
                >
                  カレンダーに戻って入力する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
