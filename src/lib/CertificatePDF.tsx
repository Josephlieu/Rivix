'use client';

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Register fonts if needed
// Font.register({
//   family: 'Poppins',
//   src: 'https://fonts.gstatic.com/s/poppins/v20/pxiEyp8kv8JHgFVrFJLMuc7F.ttf'
// });

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
    fontSize: 10,
    color: '#334155',
  },
  headerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: '#c61213',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    marginTop: 10,
  },
  logoContainer: {
    flexDirection: 'column',
  },
  brandName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    letterSpacing: -1,
  },
  portalText: {
    fontSize: 7,
    color: '#94a3b8',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  certTitleContainer: {
    textAlign: 'center',
    marginBottom: 30,
    padding: 15,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  certTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#c61213',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 4,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoItem: {
    width: '33.33%',
    marginBottom: 15,
  },
  label: {
    fontSize: 7,
    color: '#64748b',
    marginBottom: 3,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  value: {
    fontSize: 10,
    color: '#0f172a',
    fontWeight: 'bold',
  },
  specsTable: {
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 6,
    overflow: 'hidden',
  },
  tableHeader: {
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  tableCellLabel: {
    width: '30%',
    fontSize: 8,
    color: '#64748b',
    fontWeight: 'bold',
  },
  tableCellValue: {
    width: '70%',
    fontSize: 9,
    color: '#334155',
  },
  statement: {
    fontSize: 9,
    lineHeight: 1.5,
    color: '#475569',
    marginTop: 10,
    fontStyle: 'italic',
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    left: 50,
    right: 50,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerContact: {
    fontSize: 7,
    color: '#94a3b8',
  },
  signatureContainer: {
    textAlign: 'right',
  },
  signatureLine: {
    width: 120,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    marginBottom: 4,
    marginTop: 10,
  },
  stamp: {
    position: 'absolute',
    bottom: 100,
    right: 60,
    width: 90,
    height: 90,
    opacity: 0.1,
  }
});

interface CertificateData {
  batch_number: string;
  client_name: string;
  product_name: string;
  quantity: string;
  material: string;
  origin: string;
  order_date: string;
  ship_date: string;
  cert_type: string;
  cert_id: string;
  safety_standard?: string;
}

export const CertificatePDF = ({ data }: { data: CertificateData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.headerBar} />
      
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.brandName}>RIVIX</Text>
          <Text style={styles.portalText}>Official Compliance Portal</Text>
        </View>
        <View style={{ textAlign: 'right' }}>
          <Text style={styles.label}>Certificate ID</Text>
          <Text style={styles.value}>{data.cert_id}</Text>
          <Text style={[styles.label, { marginTop: 4 }]}>Issued Date</Text>
          <Text style={styles.value}>{new Date().toLocaleDateString()}</Text>
        </View>
      </View>

      <View style={styles.certTitleContainer}>
        <Text style={styles.certTitle}>{data.cert_type}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Batch Information</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.label}>Client Name</Text>
            <Text style={styles.value}>{data.client_name}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.label}>Batch Number</Text>
            <Text style={styles.value}>{data.batch_number}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.label}>Quantity</Text>
            <Text style={styles.value}>{data.quantity} Units</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.label}>Origin</Text>
            <Text style={styles.value}>{data.origin}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.label}>Production Date</Text>
            <Text style={styles.value}>{data.order_date}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.label}>Dispatch Date</Text>
            <Text style={styles.value}>{data.ship_date}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Technical Specifications</Text>
        <View style={styles.specsTable}>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Product</Text>
            <Text style={styles.tableCellValue}>{data.product_name}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Primary Fabric</Text>
            <Text style={styles.tableCellValue}>{data.material} (320 GSM)</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Reinforcements</Text>
            <Text style={styles.tableCellValue}>1000D Nylon Cordura (Knees, Elbows, Cuffs)</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Insulation/Lining</Text>
            <Text style={styles.tableCellValue}>Quilted Diamond Taffeta w/ 200GSM Polyfill</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Reflective Tape</Text>
            <Text style={styles.tableCellValue}>3M™ Scotchlite™ 8912 Silver Fabric (2.0" Width)</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Hardware</Text>
            <Text style={styles.tableCellValue}>YKK #10 Heavy Duty Brass / #5 Vislon Pockets</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Safety Standard</Text>
            <Text style={styles.tableCellValue}>{data.safety_standard || 'CSA Z96-15 Class 3 Compliant'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Compliance Statement</Text>
        <Text style={styles.statement}>
          This document serves as formal confirmation that the specified production batch has undergone a rigorous quality 
          inspection process at the point of origin. All materials and construction methods have been verified to match 
          the approved technical specifications (Master Tech Pack Ref: AS-2024-MIN-V1). RIVIX guarantees full supply chain 
          transparency and traceability for this shipment.
        </Text>
      </View>


      <View style={styles.signatureContainer}>
        <View style={styles.signatureLine} />
        <Text style={styles.label}>Authorized Inspector</Text>
        <Text style={styles.value}>Quality Assurance Department</Text>
      </View>

      <View style={styles.footer}>
        <View>
          <Text style={styles.footerContact}>RIVIX Manufacturing & Industrial Supply</Text>
          <Text style={styles.footerContact}>Canada • Calgary | portal.rivix.ca</Text>
        </View>
        <View style={{ textAlign: 'right' }}>
          <Text style={[styles.label, { color: '#c61213' }]}>Authenticated Digital Document</Text>
          <Text style={styles.footerContact}>Verified via RIVIX Compliance Engine</Text>
        </View>
      </View>
    </Page>
  </Document>
);

