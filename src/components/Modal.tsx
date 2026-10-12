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

  // The backdrop scrolls; the inner wrapper is at least as tall as the screen and centres the dialog.
  // (Centring directly inside a scrolling flex box cuts the top and bottom off a dialog taller than the
  // screen and leaves them unreachable.) A click on the empty area around the dialog closes it.
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/60 backdrop-blur-sm">
      <div
        className="flex min-h-full items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      >
        <div
          role="dialog"
          aria-modal="true"
          className={`bg-white rounded-3xl shadow-2xl w-full ${maxWidth} p-5 sm:p-8`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
