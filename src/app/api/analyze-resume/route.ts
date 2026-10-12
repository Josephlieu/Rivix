import { GEMINI_MODEL } from '@/lib/gemini-model';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { GoogleGenAI } from '@google/genai';

import mammoth from 'mammoth';
import { DEFAULT_CRITERIA, DEFAULT_HIRING_FOR, type Criterion } from '@/lib/hiring-criteria';
import { getHiringSettingsServer } from '@/lib/hiring-settings-server';
import { backgroundBlock, DEFAULT_COMPANY_CONTEXT, DEFAULT_SCORING_GUIDE } from '@/lib/hiring-prompts';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
export const runtime = 'nodejs'; // force Node runtime for heavy parsers
export const maxDuration = 60; // reading a resume with the AI can take a while; don't let the host cut it off early

// The instruction is built from the scoring categories the admin has set (see the Hiring page),
// so the AI scores what RIVIX is actually looking for in this hire.
const buildPrompt = (criteria: Criterion[], hiringFor: string, background: string) => `
You are an expert HR AI for RIVIX (a Canadian apparel manufacturer, head office in Vancouver, BC, that supplies uniform, workwear and PPE programs to industrial, construction, oil, mining and energy teams).
RIVIX is hiring ${hiringFor}.

${background}

Your task is to analyze the provided resume text or document and extract the candidate's details, then rigorously score them across ${criteria.length} categories on a scale of 0.0 to 10.0.

The ${criteria.length} categories are:
${criteria.map((c, n) => `${n + 1}. ${c.id} (Value: 0-10): ${c.label}${c.description ? ' - ' + c.description : ''}`).join('\n')}

OUTPUT IN STRICT JSON FORMAT MATCHING THIS SCHEMA EXACTLY:
{
  "name": "Candidate Full Name",
  "email": "candidate@email.com",
  "phone": "555-555-5555",
  "location": "City, Province or State where the candidate lives (empty string if not stated)",
  "bio": "A 2-3 sentence professional summary based on the resume.",
  "role": "Candidate's Most Recent Job Title (e.g. Sales Representative or B2B Account Executive)",
  "experience": "Estimated total years of professional experience (e.g. '12 years' or '8 years')",
  "currentCompany": "Name of the candidate's current or most recent employer",
  "competitor": false, // true if they worked at a competitor like UniFirst, Cintas, Aramark, Mark's Work Wearhouse, etc. Otherwise false.
  "scorecard": {
${criteria.map((c) => `    "${c.id}": 7.5`).join(',\n')}
  }
}
Use exactly the category keys listed above inside "scorecard", each with a number from 0 to 10.
If a piece of contact info or data is missing, leave it as an empty string (or false for competitor).
`;

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    // If the settings can't be read, fall back to the built-in sales defaults so reading a resume still works.
    const settings = await getHiringSettingsServer().catch(() => ({ criteria: DEFAULT_CRITERIA, hiringFor: DEFAULT_HIRING_FOR, companyContext: DEFAULT_COMPANY_CONTEXT, scoringGuide: DEFAULT_SCORING_GUIDE }));
    const formData = await req.formData();
    const file = formData.get('resume') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No resume file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();
    const parts: any[] = [];
    let extractedText = '';
    
    if (fileName.endsWith('.pdf')) {
      // Pass PDF directly to Gemini via inlineData
      parts.push({
        inlineData: {
          data: buffer.toString('base64'),
          mimeType: 'application/pdf'
        }
      });
      parts.push({ text: 'Please extract information from this PDF resume.' });
    } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
      parts.push({ text: `Here is the candidate's resume:\n\n${result.value}` });
    } else if (fileName.endsWith('.txt')) {
      extractedText = buffer.toString('utf-8');
      parts.push({ text: `Here is the candidate's resume:\n\n${extractedText}` });
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Use PDF, DOCX, or TXT.' }, { status: 400 });
    }

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        { role: 'user', parts }
      ],
      config: {
        systemInstruction: buildPrompt(settings.criteria, settings.hiringFor, backgroundBlock(settings)),
        responseMimeType: 'application/json',
      }
    });

    let text = response.text || '{}';
    // Clean up markdown JSON wrappers if Gemini returned them
    if (text.includes('```')) {
      const match = text.match(/```(?:json)?([\s\S]*?)```/);
      if (match && match[1]) {
        text = match[1].trim();
      } else {
        text = text.replace(/```[a-zA-Z]*/g, '').trim();
      }
    }

    const parsed = JSON.parse(text);

    return NextResponse.json({
      ...parsed,
      rawText: extractedText
    });
  } catch (error: any) {
    console.error('Resume analysis error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process resume' }, { status: 500 });
  }
}
