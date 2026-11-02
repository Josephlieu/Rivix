// The answer shape the garment scan asks Gemini for (a JSON schema), so the reply is always valid JSON with the right keys.
// It mirrors the "ANSWER FORMAT" in garmentAiPrompt.ts. Empty strings, empty lists and "not visible" are all allowed, so the schema
// never pushes the model to fill in a value it cannot see. The reply is still cleaned by applyTemplate afterwards.

const str = { type: 'string' } as const;
const num = { type: 'number' } as const;
const strList = { type: 'array', items: str } as const;
const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties) });

export const COMPONENT_TYPES = ['zipper', 'snap', 'button', 'seam', 'pocket', 'reflective', 'fabric', 'collar', 'cuff', 'knee_pad', 'hood', 'vent', 'drawcord', 'closure', 'reinforcement'];

export const GARMENT_RESPONSE_SCHEMA = obj({
  productIdentification: obj({ mode: { type: 'string', enum: ['visual', 'retail'] }, brand: { type: ['string', 'null'] }, model: { type: ['string', 'null'] }, source: str }),
  garmentClass: str,
  hasHood: { type: 'boolean' },
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
  checklist: { type: 'array', items: obj({ key: str, value: str, needsConfirmation: { type: 'boolean' } }) },
  flags: strList,
});
