// The background the AI is given on EVERY call (it has no memory between calls). The text is written by the
// RIVIX team and edited on the Hiring page ("Edit criteria"); these are the starting drafts, based on
// rivix.ca, its careers page and the RIVIX catalog. Shared by the page (preview) and the server (the real prompts).
// Nothing secret belongs here or in the saved text: it is sent to Google on every call.

export const MAX_CONTEXT_CHARS = 4000;
export const MAX_GUIDE_CHARS = 2000;

export const DEFAULT_COMPANY_CONTEXT = `RIVIX is a Canadian apparel manufacturer and program manager. It manages uniform, workwear and PPE programs for Canadian oil, mining, construction, energy and industrial teams (and also serves government, healthcare and hospitality customers). RIVIX sources, samples, produces and ships. Free samples take about 2 weeks and most programs finish 2 to 4 weeks after the sample is approved, with one point of contact per order. Head office: Vancouver, BC.

The role is an Outbound Sales Representative: remote, full-time, with the main focus on Alberta right now. A candidate does not have to live in Alberta, but should have Alberta contacts or a clear way to cover the Alberta market; candidates elsewhere in Canada can be considered. The role is 100% commission with no salary. Reps work warm and provided call leads, book meetings with operations, procurement and safety teams, close accounts and manage repeat orders. The average deal is about $75,000, with 2 to 4 reorders a year, and most reps close their first account in 30 to 60 days. This is not an entry-level role.

Strong candidates have 3 to 5+ years of B2B sales, workwear, uniform, PPE or industrial sales experience, existing Alberta construction, industrial, oil and gas or trades relationships, and are comfortable with daily outbound calls and commission-only pay. Competitors: UniFirst, Cintas, Aramark and Mark's.`;

export const DEFAULT_SCORING_GUIDE = `Score only what the resume shows. Do not assume experience that is not written down.
9 to 10: clear, specific evidence (named employers, accounts, numbers or results).
6 to 8: relevant experience, but partial or without detail.
3 to 5: little direct evidence, only skills that could transfer.
0 to 2: nothing relevant, or a very different field.
A detail that is simply missing is not a negative by itself; score the category on the evidence there is.`;

export type PromptSettings = { companyContext: string; scoringGuide: string };

/** The block that goes at the top of every AI instruction. */
export function backgroundBlock(s: PromptSettings, criteriaLines?: string): string {
  const ctx = (s.companyContext || '').trim() || DEFAULT_COMPANY_CONTEXT;
  const guide = (s.scoringGuide || '').trim() || DEFAULT_SCORING_GUIDE;
  return `ABOUT RIVIX AND THIS HIRE (written by the RIVIX team; treat it as true facts about the company and the job):
${ctx}

HOW TO SCORE (from the RIVIX team):
${guide}${criteriaLines ? `\n\nSCORING CATEGORIES:\n${criteriaLines}` : ''}`;
}
