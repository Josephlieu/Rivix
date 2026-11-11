'use client';

// Task 29: a template's flat drawing on screen (front and back, numbered measurement callouts, and markers for the details the
// AI found). All text is rendered as React text (escaped), never as HTML.
import { drawingPrimitives, placeMarkers, DRAWING_NOTE, NO_DRAWING_TEXT, MARKER, type DrawingDef } from '@/lib/drawings';

export function DrawingPlaceholder({ text = NO_DRAWING_TEXT }: { text?: string }) {
  return <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm font-semibold text-slate-400">{text}</div>;
}

/** `numbers`: the measurement table row number of each point code (number N = row N). */
export default function FlatDrawing({ def, numbers, points, components = [] }: {
  def: DrawingDef;
  numbers: Map<string, number>;
  points: Array<{ code: string; name: string; number: number }>;
  components?: Array<{ type?: string; label?: string; location?: string }>;
}) {
  const { placed, unplaced } = placeMarkers(def, components);
  const prims = drawingPrimitives(def, { numbers, markers: placed, note: false });
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-slate-500">{DRAWING_NOTE} Red numbers are the measurement points: number N is row N in the measurement table.{placed.length ? ' Violet markers show where the AI placed the details it found.' : ''}</p>
      <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
        <svg viewBox={`0 0 ${def.size[0]} ${def.size[1]}`} className="h-auto w-full min-w-[560px]" role="img" aria-label={`${def.label}: flat drawing with measurement points`}>
          {prims.map((p, i) => {
            if (p.t === 'path') return <path key={i} d={p.d} fill={p.fill ?? 'none'} stroke={p.stroke} strokeWidth={p.width} strokeDasharray={p.dash} strokeLinejoin="round" strokeLinecap="round" />;
            if (p.t === 'circle') return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} stroke={p.stroke} strokeWidth={p.width} />;
            return <text key={i} x={p.x} y={p.y} fontSize={p.size} fontWeight={p.bold ? 700 : 400} textAnchor={p.anchor} fill={p.fill} fontFamily="Helvetica, Arial, sans-serif">{p.text}</text>;
          })}
        </svg>
      </div>
      <div className="grid gap-x-6 gap-y-1 text-[12px] text-slate-600 sm:grid-cols-2">
        {points.map(pt => (
          <p key={pt.code}><span className="mr-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-rivix px-0.5 text-[9px] font-black text-rivix">{pt.number}</span>{pt.code} {pt.name}</p>
        ))}
      </div>
      {(placed.length > 0 || unplaced.length > 0) && (
        <div className="space-y-0.5 text-[12px] text-slate-600">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Details the AI found</p>
          {placed.map(m => <p key={m.letter}><span className="mr-1.5 font-black" style={{ color: MARKER }}>{m.letter}</span>{m.label}{m.location ? <span className="text-slate-400"> ({m.location}, {m.view})</span> : null}</p>)}
          {unplaced.map(m => <p key={m.letter}><span className="mr-1.5 font-black text-slate-400">{m.letter}</span>{m.label}{m.location ? <span className="text-slate-400"> ({m.location})</span> : null} <span className="text-slate-400">: not placed on the drawing</span></p>)}
        </div>
      )}
    </div>
  );
}
