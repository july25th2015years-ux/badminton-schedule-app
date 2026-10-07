import React from 'react';
import { X, Cloud, HardDrive, Copy, RefreshCw } from 'lucide-react';
import { isFirebaseConfigured } from '../services/firebase';

interface FirebaseGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseGuideModal: React.FC<FirebaseGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const copyEnvTemplate = () => {
    const template = `VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id`;
    navigator.clipboard.writeText(template);
    alert('環境変数テンプレートをクリップボードにコピーしました！');
  };

  const handleResetData = () => {
    if (window.confirm('ローカルの保存データを初期状態（サンプルデータ）にリセットしますか？')) {
      localStorage.removeItem('badminton_events');
      localStorage.removeItem('badminton_attendances');
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Cloud className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold">データ保存・共有について</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-800 transition text-slate-400 hover:text-white"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs sm:text-sm text-slate-600">
          {/* 現在の動作モード */}
          <div className="p-3.5 rounded-xl border bg-slate-50 flex items-start space-x-3">
            {isFirebaseConfigured ? (
              <>
                <Cloud className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-800 text-sm">
                    クラウド同期モード（Firebase有効）
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    クラウド上のデータベース（Firestore）とリアルタイムに同期しています。共有リンクを開いた全員に即座に反映されます。
                  </p>
                </div>
              </>
            ) : (
              <>
                <HardDrive className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-800 text-sm">
                    ローカル保存モード（ブラウザ保存）
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    現在は手元のブラウザ（LocalStorage）にデータが保存されています。この端末・ブラウザ上で自由にお試しいただけます。
                  </p>
                </div>
              </>
            )}
          </div>

          {/* 全員で共有するための案内 */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-800 text-sm">
              📲 メンバー全員でリアルタイム共有するには？
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Googleの無料クラウドデータベース（Firebase Firestore）と連携することで、URLをLINE等で共有して誰でもリアルタイムに出欠入力・確認ができるようになります。
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <li>
                <span className="font-semibold text-slate-800">Firebaseコンソール</span>で無料プロジェクトを作成し、Firestoreデータベースを有効化します。
              </li>
              <li>
                Webアプリ設定からAPIキー等の設定情報を取得します。
              </li>
              <li>
                プロジェクト内の <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">.env</code> ファイルに値を貼り付けます（Vercel等の環境変数設定にも対応）。
              </li>
            </ol>
            <button
              onClick={copyEnvTemplate}
              className="inline-flex items-center space-x-1.5 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold px-3 py-1.5 rounded-lg transition"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>環境変数テンプレート（.env）をコピー</span>
            </button>
          </div>

          {/* サンプルデータのリセット */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-700 text-xs">データのリセット</div>
              <div className="text-[11px] text-slate-400">初期サンプルデータに戻します</div>
            </div>
            <button
              onClick={handleResetData}
              className="flex items-center space-x-1 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg border border-rose-200 transition"
            >
              <RefreshCw className="w-3 h-3" />
              <span>サンプルデータに初期化</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
