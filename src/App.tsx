import React, { useState, useEffect } from 'react';
import type { PracticeEvent, Attendance } from './types';
import {
  subscribeToEvents,
  subscribeToAttendances,
  deleteEvent
} from './services/storage';
import { Header } from './components/Header';
import { CalendarView } from './components/CalendarView';
import { MatrixView } from './components/MatrixView';
import { EventDetailModal } from './components/EventDetailModal';
import { EventEditModal } from './components/EventEditModal';
import { NextEventBanner } from './components/NextEventBanner';
import { FirebaseGuideModal } from './components/FirebaseGuideModal';
import { Plus } from 'lucide-react';

export const App: React.FC = () => {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);

  // データ状態
  const [events, setEvents] = useState<PracticeEvent[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);

  // 表示モード
  const [viewMode, setViewMode] = useState<'calendar' | 'matrix'>('calendar');

  // モーダル状態
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PracticeEvent | null>(null);
  const [newDateInitial, setNewDateInitial] = useState<string | undefined>(undefined);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  // リアルタイム購読（FirebaseまたはLocalStorage）
  useEffect(() => {
    const unsubEvents = subscribeToEvents((data) => {
      setEvents(data);
    });
    const unsubAttendances = subscribeToAttendances((data) => {
      setAttendances(data);
    });

    return () => {
      unsubEvents();
      unsubAttendances();
    };
  }, []);

  // 月ナビゲーション
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth() + 1);
  };

  // 練習日の新規追加
  const handleOpenAddModal = (dateStr?: string) => {
    setEditingEvent(null);
    setNewDateInitial(dateStr);
    setIsEditModalOpen(true);
  };

  // 練習日の編集
  const handleOpenEditModal = (event: PracticeEvent) => {
    setEditingEvent(event);
    setNewDateInitial(undefined);
    setIsEditModalOpen(true);
  };

  // 練習日の削除
  const handleDeleteEvent = async (eventId: string) => {
    await deleteEvent(eventId);
    if (selectedEventId === eventId) {
      setSelectedEventId(null);
    }
  };

  // 保存後のコールバック
  const handleEventSaved = (savedId: string) => {
    // 新規作成または編集したイベントを詳細表示
    setSelectedEventId(savedId);
  };

  // 現在選択中のイベント
  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* ヘッダー */}
      <Header
        currentYear={currentYear}
        currentMonth={currentMonth}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onToday={handleToday}
        onOpenAddModal={() => handleOpenAddModal()}
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
        onOpenGuideModal={() => setIsGuideModalOpen(true)}
      />

      {/* メインコンテンツエリア */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-2.5 sm:px-4 py-4 sm:py-6">
        {/* 次回開催予定カード（常時表示） */}
        <NextEventBanner
          events={events}
          attendances={attendances}
          onSelectEvent={(event) => setSelectedEventId(event.id)}
          onOpenAddModal={() => handleOpenAddModal()}
        />

        {viewMode === 'calendar' ? (
          <CalendarView
            year={currentYear}
            month={currentMonth}
            events={events}
            attendances={attendances}
            onSelectEvent={(event) => setSelectedEventId(event.id)}
            onSelectEmptyDate={(dateStr) => handleOpenAddModal(dateStr)}
          />
        ) : (
          <MatrixView
            year={currentYear}
            month={currentMonth}
            events={events}
            attendances={attendances}
            onSelectEvent={(event) => setSelectedEventId(event.id)}
            onOpenAddModal={(dateStr) => handleOpenAddModal(dateStr)}
          />
        )}
      </main>

      {/* モバイル向けフローティングアクションボタン（練習日追加） */}
      <div className="sm:hidden fixed bottom-5 right-5 z-20">
        <button
          onClick={() => handleOpenAddModal()}
          className="w-13 h-13 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg flex items-center justify-center transition active:scale-95"
          aria-label="練習日を追加"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* フッター */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span>🏸 バドミントン練習会 出席カレンダー</span>
            <span className="mx-2 text-slate-300">|</span>
            <span>ログイン不要・出欠リアルタイム管理</span>
          </div>
          <button
            onClick={() => setIsGuideModalOpen(true)}
            className="text-emerald-700 hover:underline font-medium"
          >
            共有設定・クラウド同期について
          </button>
        </div>
      </footer>

      {/* 日付詳細 ＆ 出欠回答モーダル */}
      <EventDetailModal
        event={selectedEvent}
        attendances={attendances}
        onClose={() => setSelectedEventId(null)}
        onEditEvent={handleOpenEditModal}
        onDeleteEvent={handleDeleteEvent}
      />

      {/* 練習日追加・編集モーダル */}
      <EventEditModal
        isOpen={isEditModalOpen}
        initialDate={newDateInitial}
        editingEvent={editingEvent}
        onClose={() => setIsEditModalOpen(false)}
        onSaved={handleEventSaved}
      />

      {/* クラウド同期設定モーダル */}
      <FirebaseGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />
    </div>
  );
};

export default App;
