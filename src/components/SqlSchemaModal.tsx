import React, { useState } from 'react';
import { Database, Copy, Check, X, ShieldCheck, Zap, Key } from 'lucide-react';
import {
  SUPABASE_SQL_SCHEMA,
  getSavedSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
} from '../services/supabase';

export interface SqlSchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCredentialsSaved?: () => void;
}

export const SqlSchemaModal: React.FC<SqlSchemaModalProps> = ({
  isOpen,
  onClose,
  onCredentialsSaved,
}) => {
  const [copied, setCopied] = useState(false);
  const currentConfig = getSavedSupabaseConfig();
  const [url, setUrl] = useState(currentConfig.url);
  const [key, setKey] = useState(currentConfig.key);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleCopySchema = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(url, key);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
    if (onCredentialsSaved) onCredentialsSaved();
  };

  const handleClear = () => {
    clearSupabaseConfig();
    setUrl('');
    setKey('');
    if (onCredentialsSaved) onCredentialsSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl max-h-[90vh] bg-[#471C00] border border-[#CC5500]/70 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#8C3700]/60 bg-[#361300]">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-white">
              Supabase SQL Schema & Realtime Setup
            </h3>
          </div>
          <button
            id="schema-modal-close-btn"
            onClick={onClose}
            className="text-orange-200 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-stone-200">
          {/* Instructions Box */}
          <div className="bg-[#361300] border border-[#6E2900] rounded-xl p-4 space-y-2">
            <h4 className="font-semibold text-white flex items-center gap-2 text-xs uppercase tracking-wider text-amber-300">
              <Zap className="w-4 h-4 text-amber-400" /> Quick Deployment Instructions
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-xs text-orange-100">
              <li>Open your project at <strong className="text-white">database.new</strong> or supabase.com.</li>
              <li>Navigate to the <strong className="text-white">SQL Editor</strong> on the left sidebar.</li>
              <li>Click <strong className="text-white">New Query</strong>, paste the schema below, and hit <strong className="text-emerald-400">Run</strong>.</li>
              <li>Copy your <strong className="text-white">Project URL</strong> and <strong className="text-white">anon public key</strong> into the fields below (or <code className="text-amber-300">.env</code>).</li>
            </ol>
          </div>

          {/* Connection Credentials Form */}
          <form onSubmit={handleSaveCredentials} className="bg-[#361300] border border-[#6E2900] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-100 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" /> Connect Custom Supabase Project (Optional)
              </span>
              {(url || key) && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-rose-300 hover:underline cursor-pointer font-semibold"
                >
                  Clear Saved
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-orange-200 font-mono block mb-1">
                  SUPABASE_URL
                </label>
                <input
                  type="text"
                  placeholder="https://xyzcompany.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#2E1000] border border-[#8C3700] rounded-lg text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-[11px] text-orange-200 font-mono block mb-1">
                  SUPABASE_ANON_KEY
                </label>
                <input
                  type="text"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#2E1000] border border-[#8C3700] rounded-lg text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-orange-200/80">
                {savedSuccess ? (
                  <span className="text-emerald-300 font-medium">✓ Credentials updated!</span>
                ) : (
                  'When left empty, SongSpot utilizes the built-in local BroadcastChannel for zero-config multi-tab play.'
                )}
              </span>
              <button
                type="submit"
                className="px-4 py-1.5 bg-gradient-to-r from-amber-400 to-[#FF7700] hover:from-amber-300 hover:to-orange-500 text-stone-950 font-bold rounded-lg text-xs shadow transition-colors cursor-pointer"
              >
                Save Keys
              </button>
            </div>
          </form>

          {/* SQL Code Block */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-orange-100">
                  PostgreSQL Schema, RLS & Realtime Publication
                </span>
              </div>

              <button
                id="copy-sql-schema-btn"
                onClick={handleCopySchema}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#361300] hover:bg-[#521E00] text-stone-200 hover:text-white rounded-lg text-xs font-semibold border border-[#8C3700] transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-amber-300" />
                    <span>Copy Full SQL</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-4 bg-[#260C00] border border-[#6E2900] rounded-xl overflow-x-auto text-[11px] font-mono text-emerald-300 leading-relaxed max-h-72 select-all">
              {SUPABASE_SQL_SCHEMA}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#8C3700]/50 bg-[#361300] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#521E00] hover:bg-[#6E2900] text-white text-xs font-semibold rounded-lg border border-[#8C3700] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
