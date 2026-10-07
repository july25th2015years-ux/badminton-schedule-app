import { useEffect, useState } from 'react';
import type { MonthlyNote } from '../types';
import { saveMonthlyNote, subscribeToMonthlyNotes } from '../services/storage';

interface Props {
  month: string;
  userName: string;
}

export function MonthlyNotes({ month, userName }: Props) {
  const [notes, setNotes] = useState<MonthlyNote[]>([]);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const name = userName.trim();
  const savedNote = notes.find(item => item.month === month && item.userName === name)?.note || '';

  useEffect(() => subscribeToMonthlyNotes(setNotes), []);
  useEffect(() => {
    setDraft(savedNote);
    setMessage('');
  }, [month, name, savedNote]);

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      await saveMonthlyNote(month, name, draft);
      setMessage('備考を保存しました。');
    } catch {
      setMessage('備考を保存できませんでした。再度お試しください。');
    } finally {
      setSaving(false);
    }
  }

  const visibleNotes = notes.filter(item => item.month === month && item.note.trim());
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3" aria-labelledby="monthly-notes-title">
      <h3 id="monthly-notes-title" className="text-sm sm:text-base font-bold text-slate-800">{month.replace('-', '年')}月 メンバーの備考</h3>
      <p className="text-xs text-slate-500">月ごとのメモです。参加条件や予定の補足を保存できます。</p>
      {name ? (
        <div className="space-y-2 bg-slate-50 p-3 rounded-xl">
          <label htmlFor="monthly-note" className="block text-sm font-semibold">{name} さんの備考</label>
          <textarea id="monthly-note" value={draft} onChange={event => setDraft(event.target.value)} maxLength={500} rows={3}
            className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500"
            placeholder="例：夜なら参加可能／シフトが出たら更新します" />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={saving}
              className="rounded-lg bg-emerald-600 text-white text-sm font-bold px-4 py-2 disabled:opacity-50">{saving ? '保存中…' : '備考を保存'}</button>
            <span className="text-xs text-slate-500">{draft.length}/500文字</span>
            <span role="status" className="text-xs text-slate-700">{message}</span>
          </div>
        </div>
      ) : <p className="text-xs text-slate-500">上のフォームで名前を入力するか、一覧の名前を選ぶと備考を編集できます。</p>}
      {visibleNotes.length ? (
        <dl className="space-y-3">
          {visibleNotes.map(item => <div key={item.id} className="border-t border-slate-100 pt-3">
            <dt className="text-sm font-bold text-emerald-800">{item.userName}</dt>
            <dd className="text-sm text-slate-700 whitespace-pre-wrap break-words mt-1">{item.note}</dd>
          </div>)}
        </dl>
      ) : <p className="text-xs text-slate-400">この月の備考はまだありません。</p>}
    </section>
  );
}
