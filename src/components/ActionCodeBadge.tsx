import React from 'react';
import { Tag } from 'lucide-react';
import { 
  parseActionTokens, 
  getRemainingActionTokens, 
  formatRemainingCodes,
  formatCrossedCodes 
} from '../utils/actionCodeUtils';

interface ActionCodeBadgeProps {
  actionCode?: string;
  crossedCodes?: string[];
  onToggleToken?: (token: string) => void;
  onEditClick?: () => void;
  interactive?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showSummary?: boolean;
  className?: string;
}

export const ActionCodeBadge: React.FC<ActionCodeBadgeProps> = ({
  actionCode,
  crossedCodes = [],
  onToggleToken,
  onEditClick,
  interactive = false,
  size = 'md',
  showSummary = false,
  className = '',
}) => {
  if (!actionCode || !actionCode.trim()) {
    if (onEditClick) {
      return (
        <button
          type="button"
          onClick={onEditClick}
          className="text-slate-400 hover:text-teal-700 text-[9px] font-semibold border border-dashed border-slate-300 hover:border-teal-400 px-1.5 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-all"
          title="Klik untuk Tambah Kode Tindakan"
        >
          <Tag className="w-2.5 h-2.5 text-teal-600" />
          + Tindakan
        </button>
      );
    }
    return null;
  }

  const tokens = parseActionTokens(actionCode);
  const crossedUpperSet = new Set((crossedCodes || []).map(c => c.trim().toUpperCase()));
  const remainingTokens = getRemainingActionTokens(tokens, crossedCodes);
  const hasCrossed = crossedCodes && crossedCodes.length > 0;

  // Single token / no separator
  if (tokens.length === 0) {
    return (
      <span className={`inline-flex items-center gap-1 font-semibold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded-md border border-teal-200/90 shadow-2xs text-[10px] sm:text-[11px] ${className}`}>
        <Tag className="w-2.5 h-2.5 text-teal-600" />
        {actionCode}
      </span>
    );
  }

  const sizeClasses = {
    sm: 'text-[9px] px-1 py-0.2',
    md: 'text-[10px] sm:text-[11px] px-1.5 py-0.5',
    lg: 'text-xs px-2 py-1',
  }[size];

  return (
    <div className={`inline-flex items-center flex-wrap gap-1 ${className}`}>
      <div 
        className={`inline-flex items-center gap-1 font-mono font-semibold rounded-md border transition-all ${
          hasCrossed
            ? 'bg-amber-50/90 text-slate-800 border-amber-300 shadow-2xs'
            : 'bg-teal-50/90 text-teal-900 border-teal-200/90 shadow-2xs'
        } ${sizeClasses}`}
        title={hasCrossed ? `Tindakan: ${actionCode} | Sudah Selesai: ${formatCrossedCodes(tokens, crossedCodes)} | Masih Kurang: ${formatRemainingCodes(tokens, crossedCodes)}` : `Kode Tindakan: ${actionCode}`}
      >
        {onEditClick ? (
          <button
            type="button"
            onClick={onEditClick}
            className="hover:opacity-75 cursor-pointer flex items-center"
            title="Klik untuk Edit Kode Tindakan"
          >
            <Tag className="w-2.5 h-2.5 text-teal-600 shrink-0 mr-0.5" />
          </button>
        ) : (
          <Tag className="w-2.5 h-2.5 text-teal-600 shrink-0 mr-0.5" />
        )}

        <div className="flex items-center gap-0.5">
          {tokens.map((tok, idx) => {
            const isCrossed = crossedUpperSet.has(tok.trim().toUpperCase());
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-slate-400 mx-0.5 select-none font-medium">.</span>}
                {interactive && onToggleToken ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleToken(tok);
                    }}
                    className={`transition-all rounded px-0.5 cursor-pointer select-none font-bold ${
                      isCrossed
                        ? 'line-through decoration-rose-500 decoration-[1.5px] text-slate-400 hover:text-slate-600 bg-rose-50/70'
                        : 'text-teal-900 hover:bg-teal-200/70'
                    }`}
                    title={isCrossed ? `Tindakan ${tok} sudah dicoret. Klik untuk batalkan coret.` : `Tindakan ${tok} belum dicoret. Klik untuk coret / tandai selesai.`}
                  >
                    {tok}
                  </button>
                ) : (
                  <span
                    className={`${
                      isCrossed
                        ? 'line-through decoration-rose-500 decoration-[1.5px] text-slate-400 font-medium bg-rose-50/70 px-0.5 rounded'
                        : 'text-teal-900 font-bold'
                    }`}
                  >
                    {tok}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Summary Badge for Remaining / Kurang */}
      {showSummary && hasCrossed && remainingTokens.length > 0 && (
        <span 
          className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs flex items-center gap-0.5"
          title={`Kurang tindakan: ${remainingTokens.join('.')}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Kurang: {remainingTokens.join('.')}
        </span>
      )}
    </div>
  );
};
