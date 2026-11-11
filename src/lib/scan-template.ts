// Task 28, step 2: the scan built from the confirmed product type's template. The instructions and the answer format come from
// the template (its fields, measurement points, views and notes), so a glove gets glove questions and a boot gets boot questions.
// Clothing keeps the full garment scan. The AI call itself is passed in (`ask`): the route passes Gemini, the tests a fake.
// Pure, client-safe, relative imports (the tests load this file directly).
import type { ResolvedTemplate } from './template-catalog';
import { viewsText } from './template-catalog';
import { applyTemplate, scanKind, FLAGGABLE, SUGGESTABLE, PRODUCT_FLAGGABLE, type GivenValues, type ScanKind } from './garmentAiAnalysis';
import { buildGarmentPrompt, buildProductPrompt, fieldLines, q } from './garmentAiPrompt';
import { garmentResponseSchema, productResponseSchema, PRODUCT_COMPONENT_TYPES } from './garmentAiSchema';

export interface ScanInput {
  template: ResolvedTemplate;
  typeKey: string;
  typeName: string;
  photoCount: number;
  customerNotes?: string;
  searchAvailable?: boolean;
}

/** The instructions and the answer format for one scan. */
export function scanRequest(i: ScanInput): { kind: ScanKind; prompt: string; schema: Record<string, unknown> } {
  const kind = scanKind(i.template);
  const keys = i.template.checklist.map((c) => c.key);
  const pointsText = i.template.parts.flatMap((p) => p.points.map((pt) => q(`${i.template.parts.length > 1 ? `${p.label} ` : ''}${pt.code} ${pt.name}`, 160))).join('; ');
  const common = {
    photoCount: i.photoCount,
    typeName: i.typeName,
    customerNotes: i.customerNotes ?? '',
    checklistText: fieldLines(i.template.checklist),
    pointsText,
    templateNotes: i.template.notes,
  };
  if (kind === 'product') {
    return {
      kind,
      prompt: buildProductPrompt({ ...common, flagList: PRODUCT_FLAGGABLE.join(', '), suggestList: PRODUCT_FLAGGABLE.filter((p) => SUGGESTABLE.has(p)).join(', '), viewsText: viewsText(i.template.family.views), componentTypes: PRODUCT_COMPONENT_TYPES }),
      schema: productResponseSchema(keys),
    };
  }
  return {
    kind,
    prompt: buildGarmentPrompt({ ...common, searchAvailable: i.searchAvailable, flagList: Object.keys(FLAGGABLE).join(', '), suggestList: Array.from(SUGGESTABLE).join(', ') }),
    schema: garmentResponseSchema(keys),
  };
}

/** The reply is JSON, but older models (or the old way of asking) may wrap it in text or a code fence: read it tolerantly. */
export function parseJsonFromModel(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1].trim());
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('No JSON object found in model response');
  }
}

/** Turns the AI's answer into the saved draft: cleaned by the template's rules, with the template it was made with. */
export function finishScan(aiData: Record<string, unknown>, i: ScanInput & { kind: ScanKind; given?: GivenValues }): Record<string, unknown> {
  return {
    ...applyTemplate(aiData, i.template, i.given ?? {}, { kind: i.kind, photoCount: i.photoCount }),
    template: { typeKey: i.typeKey, kind: i.kind, versions: i.template.versions, certification: i.template.certification },
  };
}

export class EmptyAnswerError extends Error { constructor() { super('Empty response from AI'); } }

/** The whole scan: build the request, ask the AI once (through `ask`), read and clean the answer. */
export async function runTemplateScan(i: ScanInput & { given?: GivenValues; ask: (prompt: string, schema: Record<string, unknown>) => Promise<string> }) {
  const { kind, prompt, schema } = scanRequest(i);
  const text = await i.ask(prompt, schema);
  if (!text) throw new EmptyAnswerError();
  const raw = parseJsonFromModel(text);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('No JSON object found in model response');
  return { kind, prompt, schema, analysis: finishScan(raw as Record<string, unknown>, { ...i, kind }) };
}
