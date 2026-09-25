import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

/** Gemini cannot combine tool use (googleSearch) with responseMimeType application/json */
function parseJsonFromModel(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      return JSON.parse(fenced[1].trim());
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('No JSON object found in model response');
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const imageArray: string[] = body.images
      ? (body.images as string[])
      : body.image
        ? [body.image as string]
        : [];

    if (imageArray.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    const imageParts: Array<{ inlineData: { data: string; mimeType: string } }> = [];
    for (const imageStr of imageArray) {
      const matches = imageStr.match(/^data:(.*?);base64,([\s\S]+)$/);
      if (!matches || matches.length !== 3) {
        const prefix = imageStr.substring(0, 100);
        return NextResponse.json(
          { error: `Invalid image format. Expected base64 data URL. Got: ${prefix}` },
          { status: 400 }
        );
      }
      imageParts.push({
        inlineData: {
          data: matches[2],
          mimeType: matches[1],
        },
      });
    }

    const prompt = `You are an expert industrial garment pattern-maker, technical designer, and compliance inspector with 20+ years of experience creating factory-ready Tech Packs for workwear, outerwear, and protective apparel manufacturers.

You are being given ${imageArray.length} reference photo(s) of the SAME garment from different angles. Cross-reference ALL images to build the most complete analysis possible.

## STEP 1 — PRODUCT IDENTIFICATION (DO THIS FIRST)

Examine the garment image(s) carefully. Use Google Search to determine if this is a recognizable retail/commercial product (specific brand and model visible or identifiable from design cues, logos, or distinctive construction).

- If you find a confident retail match (e.g., Arc'teryx Monitor Coat, Carhartt J140 Jacket): set productIdentification.mode to "retail", fill brand and model with the REAL product name, and use manufacturer-published specifications where available (materials, features, intended use). garmentClass must still describe SHAPE (e.g., "Hardshell Hip-Length Coat") — NOT the marketing product name alone.
- If NO retail match is found (common for blank factory uniforms with no branding): set productIdentification.mode to "visual", leave brand and model as null, and do NOT invent a brand or retail product name. Classify by visible SHAPE using these rules BEFORE naming garmentClass:
  - Hood present? → hoodie, hooded jacket, parka, or coat (distinguish by length and closure)
  - Bib with shoulder straps? → overalls or coveralls
  - No sleeves? → vest
  - Pants only, no upper body? → work pants
  - Body length below hip / mid-thigh or longer? → coat or parka
  - Hip-length body with sleeves, no hood? → jacket
  - Pullover knit/fleece with hood, no front zip? → Hooded Pullover Sweatshirt

garmentClass examples for visual mode: "Hooded Pullover Sweatshirt", "Full-Zip Hooded Jacket", "FR Bib Overalls", "Insulated Parka", "Cargo Work Pants", "High-Vis Safety Vest", "Hardshell Coat" — shape-based, never a hallucinated brand model name.

CRITICAL: Wrong classification is worse than missing detail. A hoodie must NEVER be called a generic jacket or unrelated product name unless productIdentification confirms that exact retail SKU.

KNOWN RETAIL EXAMPLE — Arc'teryx Veilance Monitor Coat (thigh-length, integrated StormHood, 3L GORE-TEX, hidden CF zip, fishtail hem): If identified, set productIdentification.brand/model accordingly, garmentClass MUST be shape-based and include hood + length (e.g. "Hooded Thigh-Length Technical Coat"), hasHood: true. NEVER label this garment "Monitor Jacket" — it is a hooded COAT, not a collar-only jacket.

Always set hasHood: true/false from visible hood OR known product specs (Monitor Coat, parkas, hooded jackets, hoodies = true).

## STEP 2 — TECH PACK ANALYSIS

Analyze with extreme precision. Output is used DIRECTLY by factory cutting room, sewing floor, and QC. Must read like a professional pattern-maker's tech pack.

If you cannot see a detail perfectly, extrapolate the most likely professional-grade specification based on garment type, fabric, and industry standards. Blank fields are NOT acceptable except brand/model when mode is "visual".

### REQUIREMENTS
1. GARMENT CLASSIFICATION — shape-based class as above; overallConfidence 0-100
2. COMPONENT DETECTION — every visible detail with professional labels, placement, confidence, x/y % coordinates
3. FABRIC ANALYSIS — material, GSM weight, weave, FR rating, finish, shrinkage
4. POM MEASUREMENTS — graded XS–XL in inches with tolerances; use POM set appropriate to garment type
5. BOM — hardware, thread, labels, packaging with factory-grade specs
6. CONSTRUCTION — every major seam: location, seam type, ISO stitch, spiTop/spiBottom, seam allowance, notes
7. STITCH REFERENCE — ISO codes, machine types, default SPI, usage
8. LABEL PLACEMENTS — type, location, attachment, dimensions, material
9. COLORWAY — body color + Pantone, contrast, thread, hardware finish, reflective tape
10. WASH & CARE — instructions array + specialNotes

REQUIRED JSON STRUCTURE (return ONLY valid JSON, no markdown):
{
  "productIdentification": {
    "mode": "retail" | "visual",
    "brand": "string or null",
    "model": "string or null",
    "source": "string — e.g. manufacturer website URL or 'Visual analysis only — no retail match'"
  },
  "garmentClass": "string — shape-based garment type, NOT a hallucinated brand name in visual mode. Use 'coat' or 'parka' for thigh-length hooded shells, not 'jacket'",
  "hasHood": boolean,
  "overallConfidence": number,
  "season": "string",
  "components": [
    {
      "id": "string",
      "type": "zipper" | "snap" | "button" | "seam" | "pocket" | "reflective" | "fabric" | "collar" | "cuff" | "knee_pad" | "hood" | "vent" | "drawcord" | "closure" | "reinforcement",
      "label": "string",
      "location": "string",
      "confidence": number,
      "x": number,
      "y": number
    }
  ],
  "fabricAnalysis": {
    "material": "string",
    "weight": "string",
    "weaveType": "string",
    "frRating": "string",
    "finish": "string",
    "shrinkage": "string",
    "confidence": number
  },
  "measurements": [
    {
      "pom": "string",
      "description": "string",
      "xs": "string",
      "s": "string",
      "m": "string",
      "l": "string",
      "xl": "string",
      "tolerance": "string"
    }
  ],
  "bom": {
    "hardware": ["string"],
    "thread": ["string"],
    "labels": ["string"],
    "packaging": {
      "foldDescription": "string",
      "polybagSize": "string",
      "cartonSize": "string",
      "hangtagSpec": "string"
    }
  },
  "construction": [
    {
      "location": "string",
      "seamType": "string",
      "stitchType": "string",
      "spiTop": number,
      "spiBottom": number,
      "seamAllowance": "string",
      "notes": "string"
    }
  ],
  "stitchReference": [
    {
      "code": "string",
      "name": "string",
      "machineType": "string",
      "defaultSpi": number,
      "usage": "string"
    }
  ],
  "labelPlacements": [
    {
      "type": "string",
      "location": "string",
      "attachment": "string",
      "dimensions": "string",
      "material": "string"
    }
  ],
  "colorway": {
    "bodyColor": "string",
    "contrastColors": ["string"],
    "threadColor": "string",
    "hardwareFinish": "string",
    "reflectiveTape": "string"
  },
  "washCare": {
    "instructions": ["string"],
    "specialNotes": "string"
  }
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }, ...imageParts],
        },
      ],
      config: {
        tools: [{ googleSearch: {} }],
        // NOTE: responseMimeType cannot be used with googleSearch (API 400)
      },
    });

    const responseText = response.text;
    if (!responseText) {
      return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 });
    }

    let analysisData;
    try {
      analysisData = parseJsonFromModel(responseText);
    } catch (parseErr) {
      const parseMessage = parseErr instanceof Error ? parseErr.message : 'Parse failed';
      console.error('Failed to parse Gemini JSON response:', parseMessage, responseText.slice(0, 500));
      return NextResponse.json(
        { error: 'Invalid JSON response from AI', details: parseMessage },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'success',
      analysis: analysisData,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error analyzing garment:', error);
    return NextResponse.json(
      { error: 'Failed to process garment analysis', details: message },
      { status: 500 }
    );
  }
}
