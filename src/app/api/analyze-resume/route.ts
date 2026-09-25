import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const mammoth = require('mammoth');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
export const runtime = 'nodejs'; // force Node runtime for heavy parsers

const SYSTEM_PROMPT = `
You are an expert HR AI for RIVIX (a premium workwear and compliance company based in Calgary, Alberta).
Your task is to analyze the provided resume text or document and extract the candidate's details, then rigorously score them across 5 dimensions on a scale of 0.0 to 10.0.

The 5 dimensions are:
1. existingRolodex (Value: 0-10): Does the candidate have an existing network in B2B workwear, oil & gas, safety, or related industries?
2. albertaProximity (Value: 0-10): Are they based in or have strong ties to Alberta, Canada?
3. industryKnowledge (Value: 0-10): Do they understand FR clothing, PPE, or safety compliance?
4. competitiveIntel (Value: 0-10): Have they worked for competitors or similar companies?
5. salesMethodology (Value: 0-10): Do they show a structured, proven B2B sales approach?

OUTPUT IN STRICT JSON FORMAT MATCHING THIS SCHEMA EXACTLY:
{
  "name": "Candidate Full Name",
  "email": "candidate@email.com",
  "phone": "555-555-5555",
  "bio": "A 2-3 sentence professional summary based on the resume.",
  "role": "Candidate's Most Recent Job Title (e.g. Sales Representative or B2B Account Executive)",
  "experience": "Estimated total years of professional experience (e.g. '12 years' or '8 years')",
  "currentCompany": "Name of the candidate's current or most recent employer",
  "competitor": false, // true if they worked at a competitor like UniFirst, Cintas, Aramark, Mark's Work Wearhouse, etc. Otherwise false.
  "scorecard": {
    "existingRolodex": 7.5,
    "albertaProximity": 8.0,
    "industryKnowledge": 6.5,
    "competitiveIntel": 5.0,
    "salesMethodology": 8.5
  }
}
If a piece of contact info or data is missing, leave it as an empty string (or false for competitor).
`;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('resume') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No resume file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();
    let parts: any[] = [];
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
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts }
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
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
