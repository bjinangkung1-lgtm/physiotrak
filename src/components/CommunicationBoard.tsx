import React, { useState, useMemo } from 'react';
import { MessageSquare, ChevronDown, ChevronUp, Check, CornerDownRight, Trash2, X } from 'lucide-react';
import { CommunicationNote, QueueBox } from '../types';
import { getAllTherapistNames } from '../utils/savedOfficersService';

interface CommunicationBoardProps {
  notes: CommunicationNote[];
  boxes: QueueBox[];
  onAddNote: (input: { type: CommunicationNote['type']; authorName: string; message: string; targetBoxId?: string; targetBoxTitle?: string }) => void;
  onMarkRead: (noteId: string, readerName: string) => void;
  onReply: (noteId: string, input: { authorName: string; message: string }) => void;
  onDeleteNote: (noteId: string) => void;
}

const RETENTION_MS = 24 * 60 * 60 * 1000;
const LAST_SEEN_KEY = 'antrian_comm_notes_last_seen_at';
const LAST_AUTHOR_KEY = 'antrian_comm_notes_last_author';

const TYPE_META: Record<CommunicationNote['type'], { label: string; dot: string; border: string; badgeBg: string; badgeText: string }> = {
  penting: { label: 'Penting', dot: 'bg-rose-500', border: 'border-rose-300', badgeBg: 'bg-rose-100', badgeText: 'text-rose-700' },
  info: { label: 'Info', dot: 'bg-sky-500', border: 'border-sky-300', badgeBg: 'bg-sky-100', badgeText: 'text-sky-700' },
  pengumuman: { label: 'Pengumuman', dot: 'bg-emerald-500', border: 'border-emerald-300', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-700' },
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} mnt lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

export const CommunicationBoard: React.FC<CommunicationBoardProps> = ({ notes, boxes, onAddNote, onMarkRead, onReply, onDeleteNote }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');

  const [composeType, setComposeType] = useState<CommunicationNote['type']>('info');
  const [composeAuthor, setComposeAuthor] = useState<string>(() => {
    try { return localStorage.getItem(LAST_AUTHOR_KEY) || ''; } catch { return ''; }
  });
  const [composeTarget, setComposeTarget] = useState<string>('');
  const [composeMessage, setComposeMessage] = useState('');

  const [lastSeenAt, setLastSeenAt] = useState<string>(() => {
    try { return localStorage.getItem(LAST_SEEN_KEY) || ''; } catch { return ''; }
  });

  const officerNames = useMemo(() => getAllTherapistNames(boxes), [boxes]);

  const recentNotes = useMemo(() => {
    return notes.filter(n => Date.now() - new Date(n.createdAt).getTime() < RETENTION_MS);
  }, [notes]);

  const visibleNotes = showHistory ? notes : recentNotes;

  const unreadCount = useMemo(() => {
    if (!lastSeenAt) return recentNotes.length;
    const lastSeenMs = new Date(lastSeenAt).getTime();
    return recentNotes.filter(n => new Date(n.createdAt).getTime() > lastSeenMs).length;
  }, [recentNotes, lastSeenAt]);

  const hasUnreadUrgent = useMemo(() => {
    if (!lastSeenAt) return recentNotes.some(n => n.type === 'penting');
    const lastSeenMs = new Date(lastSeenAt).getTime();
    return recentNotes.some(n => n.type === 'penting' && new Date(n.createdAt).getTime() > lastSeenMs);
  }, [recentNotes, lastSeenAt]);

  const handleToggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      const now = new Date().toISOString();
      setLastSeenAt(now);
      try { localStorage.setItem(LAST_SEEN_KEY, now); } catch { /* ignore */ }
    }
  };

  const resetComposeForm = () => {
    setComposeType('info');
    setComposeTarget('');
    setComposeMessage('');
    setIsComposing(false);
  };

  const handleSubmitNote = () => {
    const trimmedAuthor = composeAuthor.trim();
    const trimmedMessage = composeMessage.trim();
    if (!trimmedAuthor || !trimmedMessage) return;
    try { localStorage.setItem(LAST_AUTHOR_KEY, trimmedAuthor); } catch { /* ignore */ }
    const targetBox = composeTarget ? boxes.find(b => b.id === composeTarget) : undefined;
    onAddNote({
      type: composeType,
      authorName: trimmedAuthor,
      message: trimmedMessage,
      targetBoxId: targetBox?.id,
      targetBoxTitle: targetBox?.title,
    });
    resetComposeForm();
  };

  const handleSubmitReply = (noteId: string) => {
    const trimmedAuthor = composeAuthor.trim();
    const trimmedReply = replyDraft.trim();
    if (!trimmedAuthor || !trimmedReply) return;
    try { localStorage.setItem(LAST_AUTHOR_KEY, trimmedAuthor); } catch { /* ignore */ }
    onReply(noteId, { authorName: trimmedAuthor, message: trimmedReply });
    setReplyDraft('');
    setReplyingToId(null);
  };

  const handleMarkRead = (note: CommunicationNote) => {
    const name = composeAuthor.trim() || 'Petugas';
    onMarkRead(note.id, name);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <button
        onClick={handleToggleOpen}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className={`relative flex items-center justify-center w-7 h-7 rounded-lg ${hasUnreadUrgent ? 'bg-rose-100' : 'bg-teal-50'}`}>
            <MessageSquare className={`w-4 h-4 ${hasUnreadUrgent ? 'text-rose-600' : 'text-teal-600'}`} />
            {hasUnreadUrgent && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            )}
          </span>
          <span className="text-sm font-bold text-slate-800">Papan Komunikasi</span>
          {unreadCount > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
              {unreadCount} Baru
            </span>
          )}
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {isOpen && (
        <div className="border-t border-slate-200">
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {visibleNotes.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-slate-400 italic">
                Belum ada catatan{showHistory ? '' : ' terbaru'}.
              </div>
            )}
            {visibleNotes.map((note) => {
              const meta = TYPE_META[note.type];
              const alreadyReadByCurrent = composeAuthor.trim()
                ? note.readBy.some(r => r.name.toLowerCase() === composeAuthor.trim().toLowerCase())
                : false;
              return (
                <div key={note.id} className={`px-4 py-3 border-l-4 ${meta.border}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${meta.badgeBg} ${meta.badgeText}`}>
                        {meta.label}
                      </span>
                      <span className="text-xs font-bold text-slate-700">{note.authorName}</span>
                      <span className="text-[11px] text-slate-400">{formatRelativeTime(note.createdAt)}</span>
                      {note.targetBoxTitle && (
                        <span className="text-[11px] font-semibold text-slate-500">→ {note.targetBoxTitle}</span>
                      )}
                    </div>
                    <button
                      onClick={() => onDeleteNote(note.id)}
                      className="p-1 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Hapus catatan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="mt-1.5 text-sm text-slate-800 whitespace-pre-line">{note.message}</p>

                  {note.readBy.length > 0 && (
                    <p className="mt-1.5 text-[11px] text-emerald-600 font-medium">
                      ✓ Dibaca: {note.readBy.map(r => r.name).join(', ')}
                    </p>
                  )}

                  {note.replies.map((reply) => (
                    <div key={reply.id} className="mt-2 ml-3 pl-2 border-l-2 border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <CornerDownRight className="w-3 h-3 text-slate-400" />
                        <span className="text-xs font-bold text-slate-600">{reply.authorName}</span>
                        <span className="text-[11px] text-slate-400">{formatRelativeTime(reply.createdAt)}</span>
                      </div>
                      <p className="text-sm text-slate-700 mt-0.5">{reply.message}</p>
                    </div>
                  ))}

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => handleMarkRead(note)}
                      disabled={alreadyReadByCurrent}
                      className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                        alreadyReadByCurrent
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-500 cursor-default'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Check className="w-3 h-3" /> {alreadyReadByCurrent ? 'Sudah Oke' : 'Oke'}
                    </button>
                    <button
                      onClick={() => setReplyingToId(replyingToId === note.id ? null : note.id)}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Balas
                    </button>
                  </div>

                  {replyingToId === note.id && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        placeholder="Tulis balasan singkat..."
                        className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitReply(note.id); }}
                      />
                      <button
                        onClick={() => handleSubmitReply(note.id)}
                        className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors cursor-pointer"
                      >
                        Kirim
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-slate-100 space-y-2.5">
            {!isComposing ? (
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => setIsComposing(true)}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors cursor-pointer"
                >
                  + Tulis Catatan Baru
                </button>
                <button
                  onClick={() => setShowHistory(prev => !prev)}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  {showHistory ? 'Sembunyikan Riwayat' : 'Tampilkan Riwayat'}
                </button>
              </div>
            ) : (
              <div className="space-y-2 bg-slate-50 rounded-xl p-3 border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Catatan Baru</span>
                  <button onClick={resetComposeForm} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  {(Object.keys(TYPE_META) as CommunicationNote['type'][]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setComposeType(t)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                        composeType === t ? `${TYPE_META[t].badgeBg} ${TYPE_META[t].badgeText} ${TYPE_META[t].border}` : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      {TYPE_META[t].label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    list="communication-board-officer-names"
                    value={composeAuthor}
                    onChange={(e) => setComposeAuthor(e.target.value)}
                    placeholder="Nama Anda"
                    className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                  <datalist id="communication-board-officer-names">
                    <option value="Admin" />
                    <option value="Petugas IRM RSPP" />
                    {officerNames.map((name) => <option key={name} value={name} />)}
                  </datalist>

                  <select
                    value={composeTarget}
                    onChange={(e) => setComposeTarget(e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <option value="">Untuk Semua</option>
                    {boxes.map((b) => (
                      <option key={b.id} value={b.id}>{b.title}</option>
                    ))}
                  </select>
                </div>

                <textarea
                  value={composeMessage}
                  onChange={(e) => setComposeMessage(e.target.value)}
                  placeholder="Tulis pesan..."
                  rows={2}
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                />

                <div className="flex justify-end">
                  <button
                    onClick={handleSubmitNote}
                    disabled={!composeAuthor.trim() || !composeMessage.trim()}
                    className="text-xs font-bold px-3.5 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Kirim Catatan
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
