import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Table as TableIcon,
  Cloud,
  HardDrive,
  Info
} from 'lucide-react';
import { formatYearMonthJa } from '../utils/helpers';
import { isFirebaseConfigured } from '../services/firebase';

interface HeaderProps {
  currentYear: number;
  currentMonth: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onOpenAddModal: () => void;
  viewMode: 'calendar' | 'matrix';
  onToggleViewMode: (mode: 'calendar' | 'matrix') => void;
  onOpenGuideModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentYear,
  currentMonth,
  onPrevMonth,
  onNextMonth,
  onToday,
  onOpenAddModal,
  viewMode,
  onToggleViewMode,
  onOpenGuideModal,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4">
        {/* 上部: タイトル ＆ アクション */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <span className="text-2xl sm:text-3xl select-none" role="img" aria-label="shuttlecock">🏸</span>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-800 leading-tight">
                  バドミントン練習会 出席カレンダー
                </h1>
                <p className="text-xs text-slate-500 hidden sm:block">
                  リンクを共有して全員で出欠確認・日程調整
                </p>
              </div>
            </div>

            {/* 同期ステータスバッジ（モバイル用） */}
            <button
              onClick={onOpenGuideModal}
              className="sm:hidden flex items-center space-x-1 text-xs px-2 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
              title="保存方式を確認"
            >
              {isFirebaseConfigured ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-medium">クラウド同期</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-amber-700 font-medium">ローカル保存</span>
                  <Info className="w-3 h-3 text-amber-600" />
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-end space-x-2">
            {/* クラウド同期ステータス（PC用） */}
            <button
              onClick={onOpenGuideModal}
              className="hidden sm:flex items-center space-x-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition"
              title="クラウド同期・デプロイ設定を確認"
            >
              {isFirebaseConfigured ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-medium">クラウド同期中</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-slate-600 font-medium">ローカルモード</span>
                  <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-medium">共有設定</span>
                </>
              )}
            </button>

            {/* 表示切替（カレンダー / 一覧表） */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => onToggleViewMode('calendar')}
                className={`flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition ${
                  viewMode === 'calendar'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                aria-label="カレンダー表示"
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>カレンダー</span>
              </button>
              <button
                onClick={() => onToggleViewMode('matrix')}
                className={`flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition ${
                  viewMode === 'matrix'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                aria-label="出欠一覧表表示"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>出欠一覧</span>
              </button>
            </div>

            {/* 練習日追加ボタン */}
            <button
              onClick={onOpenAddModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>練習日を追加</span>
            </button>
          </div>
        </div>

        {/* 下部: 月ナビゲーション */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">
              {formatYearMonthJa(currentYear, currentMonth)}
            </h2>
            <button
              onClick={onToday}
              className="px-2 py-0.5 text-xs font-medium rounded border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
            >
              今月
            </button>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={onPrevMonth}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
              title="前月へ"
              aria-label="前月"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={onNextMonth}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
              title="次月へ"
              aria-label="次月"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
