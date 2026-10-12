// The Gemini model used by the AI routes (resume reader, garment analyzer). Google retires older
// models for new keys (gemini-2.5-flash already is), so this lives in one place and can be changed
// without a code edit by setting GEMINI_MODEL in the environment.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
