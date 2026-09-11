import React from 'react';
import { 
  parseActionTokens, 
  getActionTokensOrFallback, 
  getRemainingActionTokens, 
  toggleCrossedToken,
  formatRemainingCodes,
  formatCrossedCodes,
  generateActionPresets
} from '../utils/actionCodeUtils';
import { Check, X, RotateCcw, Sparkles } from 'lucide-react';

interface ActionCodeCrossPickerProps {
  actionCode?: string;
  crossedCodes?: string[];
  onChangeCrossed: (newCrossedCodes: string[], remainingSummary: string) => void;
  compact?: boolean;
}

export const ActionCodeCrossPicker: React.FC<ActionCodeCrossPickerProps> = ({
  actionCode,
  crossedCodes = [],
  onChangeCrossed,
  compact = false,
}) => {
  const tokens = getActionTokensOrFallback(actionCode);
  const crossedUpperSet = new Set((crossedCodes || []).map(c => c.trim().toUpperCase()));
  const remainingTokens = getRemainingActionTokens(tokens, crossedCodes);
  const presets = generateActionPresets(tokens);

  const handleToggle = (tok: string) => {
    const updated = toggleCrossedToken(crossedCodes, tok);
    const remSummary = formatRemainingCodes(tokens, updated);
    onChangeCrossed(updated, remSummary);
  };

  const handleApplyPreset = (presetCrossed: string[]) => {
    const remSummary = formatRemainingCodes(tokens, presetCrossed);
    onChangeCrossed(presetCrossed, remSummary);
  };

  const handleReset = () => {
    const remSummary = formatRemainingCodes(tokens, []);
    onChangeCrossed([], remSummary);
  };

  const handleCrossAll = () => {
    const remSummary = formatRemainingCodes(tokens, tokens);
    onChangeCrossed([...tokens], remSummary);
  };

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5" onClick={e => e.stopPropagation()}>
        {/* Token Buttons */}
        <div className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-md border border-slate-200 shadow-2xs">
          <span className="text-[9px] font-bold text-slate-500 mr-0.5">Tindakan:</span>
          {tokens.map((tok, idx) => {
            const isCrossed = crossedUpperSet.has(tok.trim().toUpperCase());
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleToggle(tok)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black transition-all cursor-pointer select-none ${
                  isCrossed
                    ? 'line-through decoration-rose-500 decoration-[1.5px] bg-rose-50 text-rose-500 border border-rose-200 opacity-70'
                    : 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs hover:bg-amber-200'
                }`}
                title={isCrossed ? `Tindakan ${tok} dicoret (selesai). Klik untuk batalkan.` : `Tindakan ${tok} masih kurang. Klik untuk coret.`}
              >
                {tok}
              </button>
            );
          })}
        </div>

        {/* Quick Presets */}
        {presets.slice(0, 2).map((ps, pIdx) => (
          <button
            key={pIdx}
            type="button"
            onClick={() => handleApplyPreset(ps.crossedTokens)}
            className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-900 border border-amber-200/80 hover:bg-amber-100 transition-all cursor-pointer"
            title={ps.label}
          >
            {ps.shortLabel}
          </button>
        ))}

        {/* Status text */}
        {remainingTokens.length > 0 && crossedCodes.length > 0 && (
          <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
            Kurang: {remainingTokens.join('.')}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-black text-slate-700">Pilih / Coret Tindakan:</span>
          {actionCode && (
            <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-200">
              Asli: {actionCode}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleReset}
            className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-1.5 py-0.5 rounded hover:bg-slate-200 transition-all cursor-pointer"
            title="Reset semua coretan"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Interactive Token Buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {tokens.map((tok, idx) => {
          const isCrossed = crossedUpperSet.has(tok.trim().toUpperCase());
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleToggle(tok)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black transition-all cursor-pointer flex items-center gap-1 border shadow-2xs ${
                isCrossed
                  ? 'bg-rose-50 text-rose-600 border-rose-300 line-through decoration-rose-600 decoration-[2px] opacity-75 hover:opacity-100'
                  : 'bg-gradient-to-b from-amber-100 to-amber-200 text-amber-950 border-amber-400 hover:from-amber-200 hover:to-amber-300'
              }`}
              title={isCrossed ? `Tindakan ${tok} sudah dicoret (selesai). Klik untuk aktifkan kembali.` : `Tindakan ${tok} masih KURANG. Klik untuk coret.`}
            >
              <span>{tok}</span>
              {isCrossed ? (
                <span className="text-[9px] no-underline font-sans text-rose-500 font-bold ml-0.5">(Coret)</span>
              ) : (
                <span className="text-[9px] font-sans text-amber-800 font-bold ml-0.5">(Kurang)</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Quick Presets Buttons */}
      {presets.length > 0 && (
        <div className="pt-1.5 border-t border-slate-200/60 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold text-slate-500 flex items-center gap-0.5">
            <Sparkles className="w-3 h-3 text-amber-500" />
            Pilihan Cepat:
          </span>
          {presets.map((ps, pIdx) => {
            const isPresetActive = ps.crossedTokens.length === crossedCodes.length &&
              ps.crossedTokens.every(t => crossedUpperSet.has(t.trim().toUpperCase()));
            return (
              <button
                key={pIdx}
                type="button"
                onClick={() => handleApplyPreset(ps.crossedTokens)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer border ${
                  isPresetActive
                    ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300 hover:bg-amber-50/50'
                }`}
              >
                {ps.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Result Indicator */}
      <div className="pt-1 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-slate-600">Status Saat Kembali:</span>
          {remainingTokens.length === 0 ? (
            <span className="text-emerald-700 font-black bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
              ✓ Semua Tindakan Selesai
            </span>
          ) : (
            <span className="text-amber-900 font-black bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
              Kurang Tindakan: {remainingTokens.join('.')}
            </span>
          )}
          {crossedCodes.length > 0 && (
            <span className="text-slate-500 text-[10px]">
              (Dicoret: {formatCrossedCodes(tokens, crossedCodes)})
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
