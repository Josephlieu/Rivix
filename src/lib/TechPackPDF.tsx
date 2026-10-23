'use client';

// The factory tech file for one replication request, laid out like the Ontario Parks tech packages:
//  1 Cover   2 Colour & fabric   3 Product details   4 Call-outs   5 Construction   6 Bill of materials
//  7 Artwork   8 Measurements   9 Testing   10 Labels   11 Packaging
// Every section is always printed, with "Not specified" when nobody has entered it, so the structure never
// changes between garments. A file that has not been approved is stamped DRAFT on every page.

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { formatDate } from '@/lib/format';
import type { ReplicationRequest } from '@/lib/replicationStorage';
import type { PersistedGarmentAIAnalysis } from '@/lib/garmentAiAnalysis';

// Never split words with hyphens at the end of a line (a factory reads "zip-per" as two things).
Font.registerHyphenationCallback(word => [word]);

const RED = '#c61213';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';

const s = StyleSheet.create({
  page: { paddingTop: 92, paddingBottom: 64, paddingHorizontal: 40, fontFamily: 'Helvetica', fontSize: 9, color: '#334155', backgroundColor: '#FFFFFF' },
  // Brand band at the top of every page: the RIVIX logo on brand red, with what the document is.
  band: { position: 'absolute', top: 0, left: 0, right: 0, height: 62, backgroundColor: RED, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 40 },
  bandLogo: { width: 96, height: 36, objectFit: 'contain' },
  bandWord: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', letterSpacing: 1 },
  bandRight: { textAlign: 'right' },
  bandKicker: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#fecaca', letterSpacing: 1.6, textTransform: 'uppercase' },
  bandTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', marginTop: 2 },
  bandSub: { fontSize: 7.5, color: '#fee2e2', marginTop: 1 },
  stripe: { position: 'absolute', top: 62, left: 0, right: 0, height: 3, backgroundColor: INK },
  secNo: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: RED, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 3 },
  h1: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 4 },
  h1Bar: { width: 34, height: 3, backgroundColor: RED, marginBottom: 12 },
  h2: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: INK, textTransform: 'uppercase', letterSpacing: 1, marginTop: 14, marginBottom: 6, paddingLeft: 7, borderLeftWidth: 3, borderLeftColor: RED },
  label: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  value: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: INK },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '33.33%', paddingRight: 8, marginBottom: 10 },
  cell2: { width: '50%', paddingRight: 8, marginBottom: 10 },
  tHead: { flexDirection: 'row', backgroundColor: INK, paddingVertical: 5, paddingHorizontal: 5 },
  tRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eef2f7', paddingVertical: 5, paddingHorizontal: 5 },
  tRowAlt: { backgroundColor: '#f8fafc' },
  th: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.5 },
  td: { fontSize: 8.5, color: '#334155' },
  none: { fontSize: 8.5, color: '#94a3b8', fontStyle: 'italic' },
  note: { fontSize: 7.5, color: MUTED, marginTop: 8 },
  warn: { fontSize: 8, color: '#92400e', backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderLeftWidth: 3, borderLeftColor: '#f59e0b', padding: 7, marginTop: 10 },
  photo: { width: '100%', height: 300, objectFit: 'contain', borderWidth: 1, borderColor: LINE, backgroundColor: '#FFFFFF' },
  thumb: { width: '31.5%', height: 120, objectFit: 'contain', borderWidth: 1, borderColor: LINE, marginRight: '1.5%', marginBottom: 6 },
  // Cover page
  heroBlock: { backgroundColor: INK, borderLeftWidth: 5, borderLeftColor: RED, paddingVertical: 16, paddingHorizontal: 18, marginBottom: 14 },
  heroKicker: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#fca5a5', letterSpacing: 2, textTransform: 'uppercase' },
  heroTitle: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', marginTop: 4 },
  heroMeta: { fontSize: 9, color: '#cbd5e1', marginTop: 5 },
  chipRow: { flexDirection: 'row', marginTop: 10 },
  chip: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', backgroundColor: RED, paddingVertical: 3, paddingHorizontal: 8, marginRight: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  chipGrey: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#e2e8f0', backgroundColor: '#334155', paddingVertical: 3, paddingHorizontal: 8, marginRight: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  detailCard: { borderWidth: 1, borderColor: LINE, borderTopWidth: 3, borderTopColor: RED, padding: 12, marginBottom: 12 },
  footer: { position: 'absolute', bottom: 22, left: 40, right: 40, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 },
  footRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footText: { fontSize: 6.5, color: '#94a3b8' },
  footConf: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: RED, letterSpacing: 0.4, marginBottom: 3 },
  stamp: { position: 'absolute', top: 260, left: 60, right: 60, textAlign: 'center', fontSize: 84, fontFamily: 'Helvetica-Bold', color: '#fee2e2', transform: 'rotate(-30deg)' },
});

type A = PersistedGarmentAIAnalysis;
export interface TechFileData {
  requestCode: string;
  clientName: string;
  productName: string;
  garmentType: string;
  createdOn: string;
  specs: ReplicationRequest['specs'];
  analysis: A;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  revision: number;
  /** Photo data URLs, main photo first. */
  photos: string[];
  /** The RIVIX logo (data URL). */
  logo?: string;
  /** The sales rep who owns the request (internal only). */
  repName?: string | null;
}

export function buildTechFileData(rep: ReplicationRequest, photos: string[], logo?: string): TechFileData {
  const analysis = (rep.aiAnalysis ?? {}) as A;
  const review = analysis.review;
  return {
    requestCode: rep.requestCode || rep.id,
    clientName: rep.clientName,
    productName: rep.productName,
    garmentType: rep.garmentType,
    createdOn: rep.submissionDate,
    specs: rep.specs,
    analysis: {
      ...analysis,
      components: analysis.components || [],
      measurements: analysis.measurements || [],
      construction: analysis.construction || [],
      stitchReference: analysis.stitchReference || [],
      labelPlacements: analysis.labelPlacements || [],
    },
    approved: review?.status === 'approved',
    approvedBy: review?.approvedBy,
    approvedAt: review?.approvedAt,
    revision: review?.revision || 0,
    photos,
    logo,
    repName: rep.repName || null,
  };
}

const has = (v?: string | null) => !!v && v.trim() !== '';
const Val = ({ v }: { v?: string | null }) => (has(v) ? <Text style={s.value}>{v}</Text> : <Text style={s.none}>Not specified</Text>);
const Field = ({ name, v, wide }: { name: string; v?: string | null; wide?: boolean }) => (
  <View style={wide ? s.cell2 : s.cell}><Text style={s.label}>{name}</Text><Val v={v} /></View>
);

function Table({ cols, rows, empty }: { cols: Array<{ h: string; w: string; center?: boolean }>; rows: string[][]; empty: string }) {
  if (rows.length === 0) return <Text style={s.none}>{empty}</Text>;
  return (
    <View>
      <View style={s.tHead} fixed>
        {cols.map(c => <Text key={c.h} style={[s.th, { width: c.w, textAlign: c.center ? 'center' : 'left' }]}>{c.h}</Text>)}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={i % 2 ? [s.tRow, s.tRowAlt] : s.tRow} wrap={false}>
          {r.map((cell, j) => <Text key={j} style={[s.td, { width: cols[j].w, textAlign: cols[j].center ? 'center' : 'left' }]}>{has(cell) ? cell : '–'}</Text>)}
        </View>
      ))}
    </View>
  );
}

function Sheet({ d, no, title, children, landscape, cover }: { d: TechFileData; no?: number; title?: string; children: React.ReactNode; landscape?: boolean; cover?: boolean }) {
  return (
    <Page size="A4" orientation={landscape ? 'landscape' : 'portrait'} style={s.page}>
      {!d.approved && <Text style={s.stamp} fixed>DRAFT</Text>}
      {/* Brand band on every page */}
      <View style={s.band} fixed>
        {d.logo ? <Image style={s.bandLogo} src={d.logo} /> : <Text style={s.bandWord}>RIVIX</Text>}
        <View style={s.bandRight}>
          <Text style={s.bandKicker}>Factory tech file</Text>
          <Text style={s.bandTitle}>{d.productName}</Text>
          <Text style={s.bandSub}>{d.requestCode}  ·  {d.approved ? `Rev ${d.revision} approved` : 'DRAFT: not approved'}</Text>
        </View>
      </View>
      <View style={s.stripe} fixed />
      {!cover && no != null && (
        <>
          <Text style={s.secNo}>Section {no}</Text>
          <Text style={s.h1}>{title}</Text>
          <View style={s.h1Bar} />
        </>
      )}
      {children}
      <View style={s.footer} fixed>
        <Text style={s.footConf}>CONFIDENTIAL: RIVIX INTERNAL. Not for customers or third parties without RIVIX approval.</Text>
        <View style={s.footRow}>
          <Text style={s.footText}>RIVIX Apparel Manufacturing  ·  rivix.ca  ·  info@rivix.ca</Text>
          <Text style={s.footText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </View>
    </Page>
  );
}

const CARE_HEAD = [{ h: 'English', w: '50%' }, { h: 'Français', w: '50%' }];

export const TechPackPDF = ({ d }: { d: TechFileData }) => {
  const a = d.analysis;
  const fab = a.fabricAnalysis;
  const col = a.colorway;
  const bom = a.bom;
  const care = a.washCare;
  const sp = d.specs;
  const careEn = care?.instructions || [];
  const careFr = care?.instructionsFr || [];
  const origin = (a.origin || '').trim();
  const isCanada = /^canada$/i.test(origin);
  const tests = a.testing || [];
  const extra = d.photos.slice(1);

  return (
    <Document title={`${d.requestCode} ${d.productName} tech file`} author="RIVIX">
      {/* 1 — Cover */}
      <Sheet d={d} cover>
        <View style={s.heroBlock}>
          <Text style={s.heroKicker}>Factory tech file  ·  Section 1</Text>
          <Text style={s.heroTitle}>{d.productName}</Text>
          <Text style={s.heroMeta}>{d.clientName}  ·  {d.requestCode}</Text>
          <View style={s.chipRow}>
            <Text style={d.approved ? s.chip : s.chipGrey}>{d.approved ? `Rev ${d.revision} approved` : 'Draft: not approved'}</Text>
            <Text style={s.chipGrey}>{d.garmentType}</Text>
            <Text style={s.chipGrey}>Sizes XS – XL</Text>
          </View>
        </View>
        <View style={s.detailCard}>
          <View style={s.grid}>
            <Field name="Customer" v={d.clientName} />
            <Field name="Request no." v={d.requestCode} />
            <Field name="Garment class" v={a.garmentClass} />
            <Field name="Season" v={a.season} />
            <Field name="Date created" v={formatDate(d.createdOn)} />
            <Field name="Sales rep" v={d.repName || 'Admin (handled directly)'} />
            <Field name="Revision" v={d.approved ? `Rev ${d.revision}` : d.revision ? `Draft (last approved: Rev ${d.revision})` : 'Draft'} />
            <Field name="Approved by" v={d.approved ? `${d.approvedBy || 'RIVIX'}${d.approvedAt ? `, ${formatDate(d.approvedAt)}` : ''}` : null} wide />
          </View>
        </View>
        {d.photos[0] ? <Image style={s.photo} src={d.photos[0]} /> : <Text style={s.none}>No reference photo.</Text>}
        {!d.approved && <Text style={s.warn}>DRAFT. This specification has not been approved. Values were drafted by AI from photos and must be checked against the physical garment before this file goes to a factory.</Text>}
      </Sheet>

      {/* 2 — Colour & fabric */}
      <Sheet d={d} no={2} title="Colour & fabric information">
        <Text style={s.h2}>Colourway</Text>
        <View style={s.grid}>
          <Field name="Body colour" v={col?.bodyColor} />
          <Field name="Contrast colours" v={col?.contrastColors?.join(', ')} />
          <Field name="Thread colour" v={col?.threadColor} />
          <Field name="Hardware finish" v={col?.hardwareFinish} />
          <Field name="Reflective tape" v={col?.reflectiveTape} />
        </View>
        <Text style={s.h2}>Fabric</Text>
        <View style={s.grid}>
          <Field name="Material" v={fab?.material || sp.coreMaterial} />
          <Field name="Weight" v={fab?.weight || sp.fabricWeight} />
          <Field name="Weave" v={fab?.weaveType} />
          <Field name="Flame-resistance rating" v={fab?.frRating} />
          <Field name="Finish" v={fab?.finish} />
          <Field name="Shrinkage" v={fab?.shrinkage} />
          <Field name="Lining" v={sp.liningMaterial} />
          <Field name="Safety rating" v={sp.safetyRating} />
        </View>
      </Sheet>

      {/* 3 + 4 — Product details and call-outs */}
      <Sheet d={d} no={3} title="Product details & call-outs">
        <Text style={s.h2}>Specification</Text>
        <View style={s.grid}>
          <Field name="Zippers" v={sp.zippers} />
          <Field name="Buttons / snaps" v={sp.buttonsSnaps} />
          <Field name="Reflective striping" v={sp.reflectiveStriping} />
          <Field name="Pockets" v={sp.pocketsCount} />
          <Field name="Seam construction" v={sp.seamConstruction} />
          <Field name="Hood" v={a.hasHood == null ? null : a.hasHood ? 'Yes' : 'No'} />
          <Field name="Special instructions" v={sp.specialInstructions} wide />
        </View>
        <Text style={s.h2}>4. Call-outs (features detected on the garment)</Text>
        <Table
          cols={[{ h: 'No.', w: '8%' }, { h: 'Feature', w: '34%' }, { h: 'Type', w: '18%' }, { h: 'Location', w: '40%' }]}
          rows={(a.components || []).map((c, i) => [String(i + 1), c.label, c.type, c.location])}
          empty="No features listed."
        />
        {extra.length > 0 && (
          <>
            <Text style={s.h2}>Reference photos</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {extra.slice(0, 6).map((p, i) => <Image key={i} style={s.thumb} src={p} />)}
            </View>
          </>
        )}
      </Sheet>

      {/* 5 — Construction */}
      <Sheet d={d} no={5} title="Construction details">
        <Table
          cols={[{ h: 'Location', w: '22%' }, { h: 'Seam', w: '20%' }, { h: 'Stitch', w: '14%' }, { h: 'SPI', w: '8%', center: true }, { h: 'Allowance', w: '12%' }, { h: 'Notes', w: '24%' }]}
          rows={(a.construction || []).map(c => [c.location, c.seamType, c.stitchType, c.spiTop ? String(c.spiTop) : '', c.seamAllowance, c.notes])}
          empty="No seams specified."
        />
        <Text style={s.h2}>Stitch reference</Text>
        <Table
          cols={[{ h: 'Code', w: '12%' }, { h: 'Name', w: '26%' }, { h: 'Machine', w: '24%' }, { h: 'SPI', w: '8%', center: true }, { h: 'Usage', w: '30%' }]}
          rows={(a.stitchReference || []).map(r => [r.code, r.name, r.machineType, r.defaultSpi ? String(r.defaultSpi) : '', r.usage])}
          empty="No stitch reference."
        />
      </Sheet>

      {/* 6 — Bill of materials */}
      <Sheet d={d} no={6} title="Bill of materials">
        <Table
          cols={[{ h: 'No.', w: '8%' }, { h: 'Category', w: '20%' }, { h: 'Item', w: '72%' }]}
          rows={[
            ...(bom?.hardware || []).map(x => ['', 'Hardware', x]),
            ...(bom?.thread || []).map(x => ['', 'Thread', x]),
            ...(bom?.labels || []).map(x => ['', 'Labels', x]),
          ].map((r, i) => [String(i + 1), r[1], r[2]])}
          empty="No materials listed."
        />
      </Sheet>

      {/* 7 — Artwork */}
      <Sheet d={d} no={7} title="Artwork detail">
        <Table
          cols={[{ h: 'Artwork', w: '28%' }, { h: 'Placement', w: '28%' }, { h: 'Size', w: '16%' }, { h: 'Method', w: '28%' }]}
          rows={(a.artwork || []).map(x => [x.name, x.placement, x.size, x.method])}
          empty="No logos or artwork specified."
        />
        <Text style={s.note}>Send the customer's artwork files (vector where possible) with this tech file.</Text>
      </Sheet>

      {/* 8 — Measurements (wide page) */}
      <Sheet d={d} no={8} title="Measurement specification (inches, flat on the half)" landscape>
        <Table
          cols={[{ h: 'POM', w: '8%' }, { h: 'Description', w: '34%' }, { h: 'XS', w: '10%', center: true }, { h: 'S', w: '10%', center: true }, { h: 'M', w: '10%', center: true }, { h: 'L', w: '10%', center: true }, { h: 'XL', w: '10%', center: true }, { h: 'Tol. ±', w: '8%', center: true }]}
          rows={(a.measurements || []).map(m => [m.pom, m.description, m.xs, m.s, m.m, m.l, m.xl, m.tolerance])}
          empty="No measurements entered."
        />
        {!d.approved && <Text style={s.warn}>Measurements are estimates until approved. Measure the physical garment.</Text>}
      </Sheet>

      {/* 9 — Testing */}
      <Sheet d={d} no={9} title="Testing details">
        {tests.length === 0
          ? <Text style={s.none}>No tests specified.</Text>
          : tests.map((t, i) => <Text key={i} style={{ fontSize: 8.5, marginBottom: 4 }}>{i + 1}.  {t}</Text>)}
        <Text style={s.warn}>Test list to be confirmed with the testing laboratory before production.</Text>
      </Sheet>

      {/* 10 + 11 — Labels and packaging */}
      <Sheet d={d} no={10} title="Label specification & packaging">
        <Text style={s.h2}>Label placement</Text>
        <Table
          cols={[{ h: 'Type', w: '20%' }, { h: 'Location', w: '24%' }, { h: 'Attachment', w: '20%' }, { h: 'Size', w: '16%' }, { h: 'Material', w: '20%' }]}
          rows={(a.labelPlacements || []).map(l => [l.type, l.location, l.attachment, l.dimensions, l.material])}
          empty="No labels specified."
        />
        <Text style={s.h2}>Care text (English / Français)</Text>
        <Table
          cols={CARE_HEAD}
          rows={careEn.map((en, i) => [en, careFr[i] || ''])}
          empty="No care instructions."
        />
        {has(care?.specialNotes) && <Text style={s.note}>Notes: {care?.specialNotes}</Text>}
        <Text style={s.h2}>Origin</Text>
        {!has(origin)
          ? <Text style={s.none}>Country of origin not specified.</Text>
          : <Text style={s.value}>{isCanada ? 'MADE IN CANADA / FABRIQUÉ AU CANADA' : `MADE IN ${origin.toUpperCase()}`}</Text>}
        <Text style={[s.secNo, { marginTop: 14 }]}>Section 11</Text>
        <Text style={s.h1}>Packaging</Text>
        <View style={s.grid}>
          <Field name="Fold" v={bom?.packaging?.foldDescription} />
          <Field name="Polybag size" v={bom?.packaging?.polybagSize} />
          <Field name="Carton size" v={bom?.packaging?.cartonSize} />
          <Field name="Hangtag" v={bom?.packaging?.hangtagSpec} />
        </View>
      </Sheet>
    </Document>
  );
};
