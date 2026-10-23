/** Serializable AI analysis saved on each replication request */

/** Set by the server only: a person has checked the draft. Any later edit turns it back into a draft. */
export interface AnalysisReview {
  status: 'draft' | 'approved';
  approvedAt?: string;
  approvedBy?: string;
  revision?: number; // goes up by one each time the spec is approved
}

export interface PersistedGarmentAIAnalysis {
  analyzedAt: string;
  review?: AnalysisReview;
  garmentClass: string | null;
  hasHood: boolean | null;
  productIdentification: {
    mode: 'retail' | 'visual';
    brand: string | null;
    model: string | null;
    source: string;
  } | null;
  overallConfidence: number | null;
  season: string | null;
  components: Array<{
    id: string;
    type: string;
    label: string;
    confidence: number;
    location: string;
    x: number;
    y: number;
  }>;
  fabricAnalysis: {
    material: string;
    weight: string;
    weaveType: string;
    frRating: string;
    finish?: string;
    shrinkage?: string;
    confidence: number;
  } | null;
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
      hangtagSpec?: string;
    };
  } | null;
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
  } | null;
  washCare: {
    instructions: string[];
    instructionsFr?: string[]; // French care lines, same order as the English ones
    specialNotes: string;
  } | null;
  /** Entered by a person on the Review tab (the AI does not draft these). */
  artwork?: Array<{ name: string; placement: string; size: string; method: string }>;
  testing?: string[];
  origin?: string; // country of origin printed on the label, e.g. Canada
}

export function buildPersistedAnalysis(
  aiData: Record<string, unknown>
): PersistedGarmentAIAnalysis {
  return {
    analyzedAt: new Date().toISOString(),
    garmentClass: (aiData.garmentClass as string) || null,
    hasHood: (aiData.hasHood as boolean) ?? null,
    productIdentification: (aiData.productIdentification as PersistedGarmentAIAnalysis['productIdentification']) || null,
    overallConfidence: (aiData.overallConfidence as number) ?? null,
    season: (aiData.season as string) || null,
    components: (aiData.components as PersistedGarmentAIAnalysis['components']) || [],
    fabricAnalysis: (aiData.fabricAnalysis as PersistedGarmentAIAnalysis['fabricAnalysis']) || null,
    measurements: (aiData.measurements as PersistedGarmentAIAnalysis['measurements']) || [],
    bom: (aiData.bom as PersistedGarmentAIAnalysis['bom']) || null,
    construction: (aiData.construction as PersistedGarmentAIAnalysis['construction']) || [],
    stitchReference: (aiData.stitchReference as PersistedGarmentAIAnalysis['stitchReference']) || [],
    labelPlacements: (aiData.labelPlacements as PersistedGarmentAIAnalysis['labelPlacements']) || [],
    colorway: (aiData.colorway as PersistedGarmentAIAnalysis['colorway']) || null,
    washCare: (aiData.washCare as PersistedGarmentAIAnalysis['washCare']) || null,
  };
}
