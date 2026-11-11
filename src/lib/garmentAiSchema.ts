// The answer shape the scan asks Gemini for (a JSON schema), so the reply is always valid JSON with the right keys.
// It mirrors the "ANSWER FORMAT" in garmentAiPrompt.ts. Empty strings, empty lists and "not visible" are all allowed, so the schema
// never pushes the model to fill in a value it cannot see. The reply is still cleaned by applyTemplate afterwards.
// Task 28: the schema is built from the confirmed product type's template: "fields" has one entry per template field (so gloves
// get glove questions and boots get boot questions), and "markings" lists the printed text copied from the photos.

const str = { type: 'string' } as const;
const num = { type: 'number' } as const;
const bool = { type: 'boolean' } as const;
const strList = { type: 'array', items: str } as const;
const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties) });

export const COMPONENT_TYPES = ['zipper', 'snap', 'button', 'seam', 'pocket', 'reflective', 'fabric', 'collar', 'cuff', 'knee_pad', 'hood', 'vent', 'drawcord', 'closure', 'reinforcement'];
/** Details the AI may point to on gloves, footwear and other PPE (task 28). */
export const PRODUCT_COMPONENT_TYPES = ['coating', 'cuff', 'reinforcement', 'closure', 'strap', 'buckle', 'd_ring', 'webbing', 'toe_cap', 'outsole', 'upper', 'lining', 'panel', 'brim', 'eyelet', 'reflective', 'seam', 'label', 'other'];
/** What a piece of printed text on the product is (task 28). */
export const MARKING_KINDS = ['care', 'size', 'fabric', 'brand', 'performance', 'certification', 'warning', 'other'];

/** One answer per template field: what the photos show, the photo it is seen in (0 = none), and whether a person must check it. */
export const FIELD_ANSWER = obj({ value: str, photo: num, needsConfirmation: bool });
const MARKINGS = { type: 'array', items: obj({ kind: { type: 'string', enum: MARKING_KINDS }, text: str, photo: num, location: str }) };

/** The template's fields as schema properties, every one required (the model answers each, with "not visible" when unseen). */
export const fieldsSchema = (keys: string[]) => obj(Object.fromEntries(keys.map((k) => [k, FIELD_ANSWER])));
const anyFields = { type: 'object', additionalProperties: FIELD_ANSWER } as const;

/** Clothing: everything the garment scan had before, with the template's fields and the markings. */
export const garmentResponseSchema = (fieldKeys?: string[]) => obj({
  productIdentification: obj({ mode: { type: 'string', enum: ['visual', 'retail'] }, brand: { type: ['string', 'null'] }, model: { type: ['string', 'null'] }, source: str }),
  garmentClass: str,
  hasHood: bool,
  overallConfidence: num,
  season: str,
  components: { type: 'array', items: obj({ id: str, type: { type: 'string', enum: COMPONENT_TYPES }, label: str, location: str, confidence: num, x: num, y: num }) },
  fabricAnalysis: obj({ material: str, weight: str, weaveType: str, frRating: str, finish: str, shrinkage: str, confidence: num }),
  measurements: { type: 'array', items: obj({ pom: str, description: str }) },
  bom: obj({ hardware: strList, thread: strList, labels: strList, packaging: obj({ foldDescription: str, polybagSize: str, cartonSize: str, hangtagSpec: str }) }),
  construction: { type: 'array', items: obj({ location: str, seamType: str, stitchType: str, spiTop: num, spiBottom: num, seamAllowance: str, notes: str }) },
  stitchReference: { type: 'array', items: obj({ code: str, name: str }) },
  labelPlacements: { type: 'array', items: obj({ type: str, location: str, attachment: str, dimensions: str, material: str }) },
  colorway: obj({ bodyColor: str, contrastColors: strList, threadColor: str, hardwareFinish: str, reflectiveTape: str }),
  washCare: obj({ instructions: strList, specialNotes: str }),
  suggestions: { type: 'object', additionalProperties: str },
  markings: MARKINGS,
  fields: fieldKeys ? fieldsSchema(fieldKeys) : anyFields,
  flags: strList,
});

/** Gloves, footwear and other PPE: no fabric, seam or packaging sections; the template's fields carry the detail. */
export const productResponseSchema = (fieldKeys?: string[]) => obj({
  productIdentification: obj({ mode: { type: 'string', enum: ['visual', 'retail'] }, brand: { type: ['string', 'null'] }, model: { type: ['string', 'null'] }, source: str }),
  garmentClass: str,
  overallConfidence: num,
  components: { type: 'array', items: obj({ id: str, type: { type: 'string', enum: PRODUCT_COMPONENT_TYPES }, label: str, location: str, confidence: num, x: num, y: num }) },
  colorway: obj({ bodyColor: str, contrastColors: strList, hardwareFinish: str }),
  labelPlacements: { type: 'array', items: obj({ type: str, location: str }) },
  washCare: obj({ instructions: strList }),
  suggestions: { type: 'object', additionalProperties: str },
  markings: MARKINGS,
  fields: fieldKeys ? fieldsSchema(fieldKeys) : anyFields,
  flags: strList,
});

/** The general clothing schema (any fields), used where no template is at hand. */
export const GARMENT_RESPONSE_SCHEMA = garmentResponseSchema();
