'use client';

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
    fontSize: 9,
    color: '#334155',
  },
  headerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: '#c61213',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 8,
  },
  brandName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  portalText: {
    fontSize: 6,
    color: '#94a3b8',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  titleBlock: {
    textAlign: 'center',
    marginBottom: 16,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  title: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#c61213',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 3,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  label: {
    fontSize: 6,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  value: {
    fontSize: 9,
    color: '#0f172a',
    fontWeight: 'bold',
  },
  infoCol: {
    width: '25%',
    paddingRight: 8,
    marginBottom: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#c61213',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  cardRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  cardLabel: {
    width: '35%',
    fontSize: 7,
    color: '#64748b',
  },
  cardValue: {
    width: '65%',
    fontSize: 7,
    color: '#334155',
  },
  refImage: {
    width: 140,
    height: 140,
    objectFit: 'cover',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  flatSketchImage: {
    width: '100%',
    height: 420,
    objectFit: 'contain',
    marginTop: 8,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  th: {
    fontSize: 6,
    fontWeight: 'bold',
    color: '#475569',
    textTransform: 'uppercase',
  },
  td: {
    fontSize: 7,
    color: '#334155',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 6,
    color: '#94a3b8',
  },
  bullet: {
    fontSize: 7,
    color: '#475569',
    marginBottom: 2,
    paddingLeft: 4,
  },
});

export interface TechPackData {
  clientName: string;
  productName: string;
  garmentClass: string;
  season: string;
  confidence: number;
  identificationMode?: string;
  retailBrand?: string | null;
  retailModel?: string | null;
  referenceImage?: string;
  /** PNG data URL of technical flat sketch (front/back) */
  flatSketchImage?: string;
  fabricAnalysis: {
    material: string;
    weight: string;
    weaveType: string;
    frRating: string;
    finish: string;
    shrinkage: string;
  };
  measurements: Array<{
    pom: string;
    description: string;
    xs: string;
    s: string;
    m: string;
    l: string;
    xl: string;
    tolerance: string;
  }>;
  bom: {
    hardware: string[];
    thread: string[];
    labels: string[];
    packaging: {
      foldDescription: string;
      polybagSize: string;
      cartonSize: string;
      hangtagSpec: string;
    };
  };
  construction: Array<{
    location: string;
    seamType: string;
    stitchType: string;
    spiTop: number;
    spiBottom: number;
    seamAllowance: string;
    notes: string;
  }>;
  stitchReference: Array<{
    code: string;
    name: string;
    machineType: string;
    defaultSpi: number;
    usage: string;
  }>;
  labelPlacements: Array<{
    type: string;
    location: string;
    attachment: string;
    dimensions: string;
    material: string;
  }>;
  colorway: {
    bodyColor: string;
    contrastColors: string[];
    threadColor: string;
    hardwareFinish: string;
    reflectiveTape: string;
  };
  washCare: {
    instructions: string[];
    specialNotes: string;
  };
}

const PageFooter = () => (
  <View style={styles.footer}>
    <Text style={styles.footerText}>RIVIX Manufacturing & Industrial Supply — portal.rivix.ca — Confidential</Text>
    <Text style={styles.footerText}>{new Date().toLocaleDateString()}</Text>
  </View>
);

const Header = ({ pageTitle }: { pageTitle: string }) => (
  <>
    <View style={styles.headerBar} />
    <View style={styles.header}>
      <View>
        <Text style={styles.brandName}>RIVIX</Text>
        <Text style={styles.portalText}>Compliance Portal — Tech Pack</Text>
      </View>
      <View style={{ textAlign: 'right' }}>
        <Text style={styles.label}>Document</Text>
        <Text style={styles.value}>{pageTitle}</Text>
      </View>
    </View>
  </>
);

export const TechPackPDF = ({ data }: { data: TechPackData }) => (
  <Document>
    {/* Page 1 — Overview */}
    <Page size="A4" style={styles.page}>
      <Header pageTitle="Page 1 — Style Overview" />
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Factory Tech Pack — {data.garmentClass}</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.infoCol}>
          <Text style={styles.label}>Client</Text>
          <Text style={styles.value}>{data.clientName}</Text>
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.label}>Style / Product</Text>
          <Text style={styles.value}>{data.productName}</Text>
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.label}>Classification</Text>
          <Text style={styles.value}>{data.garmentClass}</Text>
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.label}>Season</Text>
          <Text style={styles.value}>{data.season || 'Year-Round'}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.infoCol}>
          <Text style={styles.label}>AI Confidence</Text>
          <Text style={styles.value}>{data.confidence}%</Text>
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.label}>Identification</Text>
          <Text style={styles.value}>{data.identificationMode === 'retail' ? 'Retail Product' : 'Visual Analysis'}</Text>
        </View>
        {data.retailBrand && (
          <View style={styles.infoCol}>
            <Text style={styles.label}>Brand / Model</Text>
            <Text style={styles.value}>{data.retailBrand}{data.retailModel ? ` — ${data.retailModel}` : ''}</Text>
          </View>
        )}
        <View style={styles.infoCol}>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.value}>{new Date().toLocaleDateString()}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
        {data.referenceImage ? (
          <Image src={data.referenceImage} style={styles.refImage} />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Fabric Analysis</Text>
          <View style={styles.card}>
            {[
              ['Material', data.fabricAnalysis.material],
              ['Weight', data.fabricAnalysis.weight],
              ['Weave', data.fabricAnalysis.weaveType],
              ['FR Rating', data.fabricAnalysis.frRating],
              ['Finish', data.fabricAnalysis.finish],
              ['Shrinkage', data.fabricAnalysis.shrinkage],
            ].map(([l, v]) => (
              <View key={l} style={styles.cardRow}>
                <Text style={styles.cardLabel}>{l}</Text>
                <Text style={styles.cardValue}>{v}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Colorway</Text>
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Body</Text>
              <Text style={styles.cardValue}>{data.colorway.bodyColor}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Contrast</Text>
              <Text style={styles.cardValue}>{data.colorway.contrastColors?.join(', ') || 'N/A'}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Thread</Text>
              <Text style={styles.cardValue}>{data.colorway.threadColor}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Hardware</Text>
              <Text style={styles.cardValue}>{data.colorway.hardwareFinish}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Reflective</Text>
              <Text style={styles.cardValue}>{data.colorway.reflectiveTape}</Text>
            </View>
          </View>
        </View>
      </View>
      <PageFooter />
    </Page>

    {/* Page 2 — Technical flat sketch */}
    {data.flatSketchImage ? (
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Header pageTitle="Technical Flat Sketch" />
        <Text style={styles.sectionTitle}>1. Technical Flat — Front / Back (AI Extrapolated)</Text>
        <Text style={{ fontSize: 7, color: '#64748b', marginBottom: 6 }}>
          Style: {data.garmentClass} — Sample size M — All measurements in inches, taken flat
        </Text>
        <Image src={data.flatSketchImage} style={styles.flatSketchImage} />
        <PageFooter />
      </Page>
    ) : null}

    {/* Page 3 — Measurements */}
    <Page size="A4" orientation="landscape" style={styles.page}>
      <Header pageTitle="POM Specification" />
      <Text style={styles.sectionTitle}>Measurement Specification (Inches) — Graded XS–XL</Text>
      <View style={{ borderWidth: 1, borderColor: '#e2e8f0', marginTop: 4 }}>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { width: '6%' }]}>POM</Text>
          <Text style={[styles.th, { width: '28%' }]}>Description</Text>
          <Text style={[styles.th, { width: '9%', textAlign: 'center' }]}>XS</Text>
          <Text style={[styles.th, { width: '9%', textAlign: 'center' }]}>S</Text>
          <Text style={[styles.th, { width: '9%', textAlign: 'center' }]}>M</Text>
          <Text style={[styles.th, { width: '9%', textAlign: 'center' }]}>L</Text>
          <Text style={[styles.th, { width: '9%', textAlign: 'center' }]}>XL</Text>
          <Text style={[styles.th, { width: '10%', textAlign: 'center' }]}>Tol +/-</Text>
        </View>
        {data.measurements.map((m, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.td, { width: '6%', fontWeight: 'bold' }]}>{m.pom}</Text>
            <Text style={[styles.td, { width: '28%' }]}>{m.description}</Text>
            <Text style={[styles.td, { width: '9%', textAlign: 'center' }]}>{m.xs}</Text>
            <Text style={[styles.td, { width: '9%', textAlign: 'center' }]}>{m.s}</Text>
            <Text style={[styles.td, { width: '9%', textAlign: 'center' }]}>{m.m}</Text>
            <Text style={[styles.td, { width: '9%', textAlign: 'center' }]}>{m.l}</Text>
            <Text style={[styles.td, { width: '9%', textAlign: 'center' }]}>{m.xl}</Text>
            <Text style={[styles.td, { width: '10%', textAlign: 'center' }]}>{m.tolerance}</Text>
          </View>
        ))}
      </View>
      <PageFooter />
    </Page>

    {/* BOM & Construction */}
    <Page size="A4" style={styles.page}>
      <Header pageTitle="BOM & Construction" />
      <Text style={styles.sectionTitle}>Bill of Materials</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Hardware</Text>
        {data.bom.hardware.map((h, i) => (
          <Text key={i} style={styles.bullet}>• {h}</Text>
        ))}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Thread</Text>
        {data.bom.thread.map((t, i) => (
          <Text key={i} style={styles.bullet}>• {t}</Text>
        ))}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Labels</Text>
        {data.bom.labels.map((l, i) => (
          <Text key={i} style={styles.bullet}>• {l}</Text>
        ))}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Packaging</Text>
        <Text style={styles.bullet}>Fold: {data.bom.packaging.foldDescription}</Text>
        <Text style={styles.bullet}>Polybag: {data.bom.packaging.polybagSize}</Text>
        <Text style={styles.bullet}>Carton: {data.bom.packaging.cartonSize}</Text>
        <Text style={styles.bullet}>Hangtag: {data.bom.packaging.hangtagSpec}</Text>
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Construction & Seam Details</Text>
      <View style={{ borderWidth: 1, borderColor: '#e2e8f0' }}>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { width: '18%' }]}>Location</Text>
          <Text style={[styles.th, { width: '16%' }]}>Seam</Text>
          <Text style={[styles.th, { width: '14%' }]}>Stitch</Text>
          <Text style={[styles.th, { width: '8%' }]}>SPI T</Text>
          <Text style={[styles.th, { width: '8%' }]}>SPI B</Text>
          <Text style={[styles.th, { width: '12%' }]}>SA</Text>
          <Text style={[styles.th, { width: '24%' }]}>Notes</Text>
        </View>
        {data.construction.map((c, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.td, { width: '18%' }]}>{c.location}</Text>
            <Text style={[styles.td, { width: '16%' }]}>{c.seamType}</Text>
            <Text style={[styles.td, { width: '14%' }]}>{c.stitchType}</Text>
            <Text style={[styles.td, { width: '8%' }]}>{c.spiTop}</Text>
            <Text style={[styles.td, { width: '8%' }]}>{c.spiBottom}</Text>
            <Text style={[styles.td, { width: '12%' }]}>{c.seamAllowance}</Text>
            <Text style={[styles.td, { width: '24%' }]}>{c.notes}</Text>
          </View>
        ))}
      </View>
      <PageFooter />
    </Page>

    {/* Stitch, Labels, Care */}
    <Page size="A4" style={styles.page}>
      <Header pageTitle="Reference & Labels" />
      <Text style={styles.sectionTitle}>Stitch Type Reference</Text>
      <View style={{ borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 }}>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { width: '10%' }]}>Code</Text>
          <Text style={[styles.th, { width: '22%' }]}>Name</Text>
          <Text style={[styles.th, { width: '28%' }]}>Machine</Text>
          <Text style={[styles.th, { width: '10%' }]}>SPI</Text>
          <Text style={[styles.th, { width: '30%' }]}>Usage</Text>
        </View>
        {data.stitchReference.map((s, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.td, { width: '10%' }]}>{s.code}</Text>
            <Text style={[styles.td, { width: '22%' }]}>{s.name}</Text>
            <Text style={[styles.td, { width: '28%' }]}>{s.machineType}</Text>
            <Text style={[styles.td, { width: '10%' }]}>{s.defaultSpi}</Text>
            <Text style={[styles.td, { width: '30%' }]}>{s.usage}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Label Placement Schedule</Text>
      <View style={{ borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 }}>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { width: '18%' }]}>Type</Text>
          <Text style={[styles.th, { width: '28%' }]}>Location</Text>
          <Text style={[styles.th, { width: '22%' }]}>Attachment</Text>
          <Text style={[styles.th, { width: '14%' }]}>Size</Text>
          <Text style={[styles.th, { width: '18%' }]}>Material</Text>
        </View>
        {data.labelPlacements.map((l, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.td, { width: '18%' }]}>{l.type}</Text>
            <Text style={[styles.td, { width: '28%' }]}>{l.location}</Text>
            <Text style={[styles.td, { width: '22%' }]}>{l.attachment}</Text>
            <Text style={[styles.td, { width: '14%' }]}>{l.dimensions}</Text>
            <Text style={[styles.td, { width: '18%' }]}>{l.material}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Wash & Care</Text>
      <View style={styles.card}>
        {data.washCare.instructions.map((inst, i) => (
          <Text key={i} style={styles.bullet}>• {inst}</Text>
        ))}
        {data.washCare.specialNotes ? (
          <Text style={[styles.bullet, { marginTop: 6, fontStyle: 'italic' }]}>
            Note: {data.washCare.specialNotes}
          </Text>
        ) : null}
      </View>
      <PageFooter />
    </Page>
  </Document>
);
