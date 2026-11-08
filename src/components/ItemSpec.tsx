// A product line's fabric and safety standard, shown under the product on the order pages. Nothing when neither is set.
export default function ItemSpec({ fabric, standard }: { fabric?: string | null; standard?: string | null }) {
  if (!fabric && !standard) return null;
  return (
    <p className="text-slate-500">
      {fabric ? <>Fabric: <span className="text-slate-700 font-semibold">{fabric}</span></> : null}
      {fabric && standard ? ' · ' : null}
      {standard ? <>Safety standard: <span className="text-slate-700 font-semibold">{standard}</span></> : null}
    </p>
  );
}
