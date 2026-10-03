'use client';

import { useEffect } from 'react';

interface ModalProps {
  onClose: () => void;
  busy?: boolean;            // while true, Escape / clicking outside won't close it
  maxWidth?: string;         // e.g. 'max-w-xl'
  children: React.ReactNode;
}

// A centred dialog over a dimmed page. Closes with Escape or a click outside
// (unless busy). Put a <form> or any content inside; add your own title row.
export default function Modal({ onClose, busy = false, maxWidth = 'max-w-xl', children }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-white rounded-3xl shadow-2xl w-full ${maxWidth} p-5 sm:p-8 my-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
