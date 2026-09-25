import { supabase } from './supabase';

export interface Scorecard {
  existingRolodex: number;    // 1-10 — Active procurement/safety contacts in target industries (Weight: 30%)
  albertaProximity: number;   // 1-10 — Physical presence in AB/Western Canada for site visits (Weight: 20%)
  industryKnowledge: number;  // 1-10 — FR, CSA, NFPA, garment compliance technical literacy (Weight: 20%)
  competitiveIntel: number;   // 1-10 — UniFirst/Cintas/Aramark/Mark's playbook knowledge (Weight: 15%)
  salesMethodology: number;   // 1-10 — Hunting ability, deal structure, contract closing (Weight: 15%)
}

// Weights for computing composite score (must sum to 1.0)
export const SCORECARD_WEIGHTS: { key: keyof Scorecard; weight: number; label: string; shortLabel: string }[] = [
  { key: 'existingRolodex',  weight: 0.30, label: 'Existing Rolodex (Active Procurement/Safety Contacts)', shortLabel: 'Rolodex' },
  { key: 'albertaProximity', weight: 0.20, label: 'Alberta / Western Canada Proximity', shortLabel: 'Location' },
  { key: 'industryKnowledge', weight: 0.20, label: 'Industry Knowledge (FR / CSA / NFPA)', shortLabel: 'Compliance' },
  { key: 'competitiveIntel', weight: 0.15, label: 'Competitive Intel (UniFirst / Cintas / Mark\'s)', shortLabel: 'Intel' },
  { key: 'salesMethodology', weight: 0.15, label: 'Sales Methodology (Hunting / Closing)', shortLabel: 'Sales' },
];

export const computeWeightedScore = (sc: Scorecard): number => {
  return Math.round(
    SCORECARD_WEIGHTS.reduce((sum, w) => sum + sc[w.key] * w.weight, 0) * 10
  ) / 10;
};

export const DEFAULT_SCORECARD: Scorecard = {
  existingRolodex: 5,
  albertaProximity: 5,
  industryKnowledge: 5,
  competitiveIntel: 5,
  salesMethodology: 5,
};

export interface CandidateNote {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  lineIndex?: number; // Links note to a specific line in transcript
}

export interface Candidate {
  id: string;
  name: string;
  role: string;
  experience: string; // e.g. "26 years"
  currentCompany: string;
  competitor: boolean;
  background: string;
  email: string;
  phone: string;
  avatar: string;
  status: 'screening' | 'interviewing' | 'offer' | 'archived';
  scorecard: Scorecard;
  notes: CandidateNote[];
  resumeText: string;
  resumePdfUrl?: string;
  createdAt?: string;
}

export interface TranscriptLine {
  speaker: string;
  text: string;
  timestamp: string; // e.g. "01:23"
  category?: 'competitor' | 'strategy' | 'technical' | 'credibility' | 'general';
  insight?: string;
}

export interface SOPDocument {
  id: string;
  title: string;
  category: 'policy' | 'interview' | 'commission' | 'technical' | 'sales-weapon';
  summary: string;
  sections: Array<{
    heading: string;
    paragraphs: string[];
  }>;
}

// Candidates ordered by weighted composite score (highest first)
const DEFAULT_CANDIDATES: Candidate[] = [
  // TEST — Solomon Riby-Williams (portal / hiring flow QA)
  {
    id: 'cand-test-sol',
    name: 'Solomon Riby-Williams',
    role: 'Test Candidate — Sales Rep Applicant',
    experience: 'Test profile',
    currentCompany: 'RIVIX (Internal Test)',
    competitor: false,
    background: 'Internal test candidate for hiring workflow QA — Cal.com scheduling, resume viewer, correspondence, and scorecard. Use this profile to validate admin hiring features before live candidate review.',
    email: 'solgoody@gmail.com',
    phone: '403-555-0100',
    avatar: 'SR',
    status: 'screening',
    scorecard: {
      existingRolodex: 8,
      albertaProximity: 9,
      industryKnowledge: 7,
      competitiveIntel: 6,
      salesMethodology: 8,
    },
    notes: [
      {
        id: 'n-test-sol',
        author: 'RIVIX Admin',
        content: 'TEST ACCOUNT — Solomon Riby-Williams (solgoody@gmail.com). Resume: /Resume_Template.pdf. Use for Cal.com, PDF resume embed, and hiring UI testing.',
        timestamp: new Date().toISOString(),
      },
    ],
    resumeText: `SOLOMON RIBY-WILLIAMS\nCalgary, AB\nEmail: solgoody@gmail.com\n\nTEST RESUME — Template used for RIVIX hiring portal QA.`,
    resumePdfUrl: '/Resume_Template.pdf',
    createdAt: '2026-05-30T13:00:00Z',
  },
  // RANK #1 — Dwight Kerr (Weighted: 8.8)
  {
    id: 'cand-indeed-3',
    name: 'Dwight Kerr',
    role: 'Heavy-Duty Industrial Parts Representative',
    experience: '30 years',
    currentCompany: 'Industrial Fleet Parts Sales',
    competitor: false,
    background: 'Certified Journeyman Partsman with 30 years representing heavy-duty truck, trailer, and industrial accounts. Direct network of safety superintendents and maintenance managers throughout Leduc/Nisku industrial zones. Can walk into a Nisku site office on day one with sample overalls.',
    email: 'dwightkerr76@gmail.com',
    phone: '780-298-1627',
    avatar: 'DK',
    status: 'interviewing',
    scorecard: {
      existingRolodex: 10,   // 30 years of active Nisku/Leduc procurement contacts
      albertaProximity: 10,  // Leduc, AB — heart of oil sands logistics
      industryKnowledge: 8,  // Heavy-duty parts, not garment-specific but transferable
      competitiveIntel: 7,   // Knows the supply chain landscape, not a direct competitor hire
      salesMethodology: 8,   // Proven consultative B2B rep for 3 decades
    },
    notes: [
      { id: 'n-ind-3', author: 'Sol (Strategic Assessment)', content: 'RANK #1. 30 years in Nisku/Leduc industrial zone. Active safety superintendent contacts who trust him. Journeyman Partsman credential adds deep credibility with procurement managers. Straight commission risk is low — he has warm leads ready. Only concern: assess energy/adaptability to a startup pace.', timestamp: '2026-05-30T14:00:00Z' }
    ],
    resumeText: `DWIGHT H. KERR, Leduc, AB\n\nPROFESSIONAL SUMMARY\nCertified Journeyman Partsman with 30 years of experience in heavy-duty truck, trailer, and industrial parts sales. Outstanding network in Nisku oil sands logistics.`,
    resumePdfUrl: '/resumes/ResumeDwightKerr.pdf',
    createdAt: '2026-05-30T14:00:00Z'
  },
  // RANK #2 — Anthony Di Ponio (Weighted: 7.8)
  {
    id: 'cand-indeed-7',
    name: 'Anthony Di Ponio',
    role: 'Sales Consultant — UniFirst (Competitor)',
    experience: '20+ years',
    currentCompany: 'UniFirst',
    competitor: true,
    background: 'Currently a Sales Consultant at UniFirst — RIVIX\'s primary legacy competitor. 20+ years in uniform rental B2B sales. Knows exactly how UniFirst locks companies into 3-5 year rental contracts with hidden fees. Understands the playbook RIVIX is disrupting (buy outright vs rent). Strategic "Rolodex Raid" hire.',
    email: 'adiponioca@gmail.com',
    phone: 'Not found',
    avatar: 'AD',
    status: 'screening',
    scorecard: {
      existingRolodex: 9,    // 20+ years of active uniform rental accounts he can flip
      albertaProximity: 3,   // Windsor, ON — would need to relocate or travel extensively
      industryKnowledge: 9,  // Uniform industry veteran, knows FR/compliance requirements
      competitiveIntel: 10,  // THE strategic hire — knows UniFirst's exact pricing, contracts, weaknesses
      salesMethodology: 9,   // 20+ years closing B2B uniform contracts
    },
    notes: [
      { id: 'n-ind-7', author: 'Sol (Strategic Assessment)', content: 'RANK #2. The "Rolodex Raid" hire. Direct UniFirst insider who knows exactly how they lock clients into rental contracts. Can decode competitor pricing, contract structures, and retention tactics. Weakness: Windsor, ON — not in Alberta. Would need travel budget or relocation incentive. Worth the investment.', timestamp: '2026-05-30T14:05:00Z' }
    ],
    resumeText: `ANTHONY DI PONIO, Windsor, ON\n\nPROFESSIONAL SUMMARY\nExperienced B2B sales professional with a strong track record of building client relationships, growing accounts, and supporting long term contracts. Sales Consultant at UniFirst.`,
    resumePdfUrl: '/resumes/ResumeAnthonyDiPonio.pdf',
    createdAt: '2026-05-30T14:05:00Z'
  },
  // RANK #3 — Eduardo Dela Cruz (Weighted: 7.7)
  {
    id: 'cand-indeed-2',
    name: 'Eduardo Dela Cruz',
    role: 'Industrial B2B Sales Manager',
    experience: '15 years',
    currentCompany: 'Oilfield & Heavy Industry Supply',
    competitor: false,
    background: 'Experienced B2B sales manager specializing in industrial logistics, manufacturing, and oilfield safety garment supply contracts in the Red Deer/Edmonton corridor. 15 years in heavy industry sales with strong territory management skills.',
    email: 'eduardodelacruzr3z37_jd9@indeedemail.com',
    phone: '1-403-506-7607',
    avatar: 'ED',
    status: 'screening',
    scorecard: {
      existingRolodex: 8,    // Good network in Red Deer/Edmonton industrial corridor
      albertaProximity: 10,  // Red Deer, AB — prime territory
      industryKnowledge: 7,  // Industrial supply experience, some garment exposure
      competitiveIntel: 5,   // No direct competitor background
      salesMethodology: 8,   // 15 years managing B2B territories
    },
    notes: [
      { id: 'n-ind-2', author: 'Sol (Strategic Assessment)', content: 'RANK #3. Strong all-around candidate. Red Deer location covers the Edmonton/Fort McMurray corridor perfectly. 15 years of industrial B2B sales. No garment-specific experience but industrial supply chain transfers well.', timestamp: '2026-05-30T14:10:00Z' }
    ],
    resumeText: `EDUARDO DELA CRUZ, Red Deer, AB\n\nPROFESSIONAL SUMMARY\nPhysically fit sales leader. Extensive experience in B2B heavy industry sales, territory optimization, and industrial contractor logistics.`,
    resumePdfUrl: '/resumes/ResumeEDUARDODELACRUZ.pdf',
    createdAt: '2026-05-30T14:10:00Z'
  },
  // RANK #4 — Leanne Dumas (Weighted: 6.6)
  {
    id: 'cand-indeed-1',
    name: 'Leanne Dumas',
    role: 'Senior B2B Strategy & Sales Specialist',
    experience: '12 years',
    currentCompany: 'Industrial Startup Consulting',
    competitor: false,
    background: 'Dynamic strategist with 12+ years B2B experience in commercial, industrial, construction, and trades. Specialist in launching and scaling industrial service accounts across North America. Located in Cochrane, AB. Strong hustler but no proven safety garment or FR compliance track record.',
    email: 'leannedumas1978jftjy_wcj@indeedemail.com',
    phone: '587-433-6300',
    avatar: 'LD',
    status: 'screening',
    scorecard: {
      existingRolodex: 6,    // Startup consulting network, not garment procurement contacts
      albertaProximity: 9,   // Cochrane, AB — excellent location
      industryKnowledge: 4,  // No FR/CSA/NFPA garment knowledge demonstrated
      competitiveIntel: 3,   // No competitor background
      salesMethodology: 9,   // 12 years B2B, strong hustler and business developer
    },
    notes: [
      { id: 'n-ind-1', author: 'Sol (Strategic Assessment)', content: 'RANK #4. Great location (Cochrane, AB) and strong B2B hustle (196 startups). But startup consulting is very different from closing FR overall contracts with safety superintendents. No demonstrated garment compliance knowledge. Would need significant onboarding on CSA/NFPA standards before being credible in front of oil sands procurement.', timestamp: '2026-05-30T14:15:00Z' }
    ],
    resumeText: `LEANNE DUMAS, Cochrane, AB\n\nPROFESSIONAL SUMMARY\nI am a dynamic Startup Consultant & Strategist with over a decade of B2B sales experience. I specialize in launching over 196 startups across commercial, industrial, construction, trades, and retail sectors.`,
    resumePdfUrl: '/resumes/ResumeLeanneDumas.pdf',
    createdAt: '2026-05-30T14:15:00Z'
  },
  // RANK #5 — Jaspreet Singh (Weighted: 6.2)
  {
    id: 'cand-indeed-5',
    name: 'Jaspreet Singh',
    role: 'Industrial Territory Sales Representative',
    experience: '7 years',
    currentCompany: 'Mechanical Engineering & Industrial Supply',
    competitor: false,
    background: 'Industrial sales representative with mechanical engineering background. Proven track record of territory optimization, mechanical supply chain sales, and contract closing in Calgary. Technical degree gives inherent credibility discussing fabric specs and compliance testing.',
    email: 'jsingh15000@gmail.com',
    phone: '(403) 220-0222',
    avatar: 'JS',
    status: 'screening',
    scorecard: {
      existingRolodex: 5,    // Some industrial contacts but not deep in safety garments
      albertaProximity: 9,   // Calgary, AB
      industryKnowledge: 6,  // Mechanical engineering gives technical credibility baseline
      competitiveIntel: 3,   // No competitor background
      salesMethodology: 7,   // 7 years territory sales, young and hungry
    },
    notes: [
      { id: 'n-ind-5', author: 'Sol (Strategic Assessment)', content: 'RANK #5. Calgary-based with mechanical engineering degree — gives inherent credibility discussing fabric testing, GSM weights, and compliance specs. 7 years territory sales. Young and hungry, fits commission-only model well. Lacks deep garment industry contacts.', timestamp: '2026-05-30T14:20:00Z' }
    ],
    resumeText: `JASPREET SINGH, Calgary, AB\n\nPROFESSIONAL SUMMARY\nMechanical Engineer (B.Tech) and top-performance sales manager. Specializes in territory penetration, supply chain logistics, and contract negotiations.`,
    resumePdfUrl: '/resumes/ResumeJaspreetSingh.pdf',
    createdAt: '2026-05-30T14:20:00Z'
  },
  // RANK #6 — Matthew Marois (Weighted: 5.0)
  {
    id: 'cand-indeed-4',
    name: 'Matthew Marois',
    role: 'Senior B2B Relationship Manager',
    experience: '10 years',
    currentCompany: 'Niagara College (B2B Partnerships)',
    competitor: false,
    background: 'Partnership development expert specializing in high-value institutional contracts. Skilled in consultative value-selling and establishing long-term customer accounts. 10 years B2B but in education/institutional sector, not industrial safety.',
    email: 'MATTHEWMAROIS12@GMAIL.COM',
    phone: '(905) 359-1832',
    avatar: 'MM',
    status: 'screening',
    scorecard: {
      existingRolodex: 4,    // Institutional/college contacts, not industrial safety procurement
      albertaProximity: 3,   // Remote / Ontario — not in AB market
      industryKnowledge: 3,  // No safety garment or FR compliance background
      competitiveIntel: 2,   // No competitor knowledge
      salesMethodology: 7,   // Solid B2B relationship management, consultative selling
    },
    notes: [
      { id: 'n-ind-4', author: 'Sol (Strategic Assessment)', content: 'RANK #6. Solid B2B relationship builder but wrong industry. College/institutional partnerships do not transfer to oil sands safety procurement. Not in Alberta. Would need full industry retraining. Risky on straight commission.', timestamp: '2026-05-30T14:25:00Z' }
    ],
    resumeText: `MATTHEW MAROIS, Remote (Active in AB)\n\nPROFESSIONAL SUMMARY\nSpecialist in relationship turning and high-value B2B accounts. Developed college partnerships, growing international portfolios by 90%. Ready to expand B2B workwear accounts across AB.`,
    resumePdfUrl: '/resumes/ResumeMATTHEWMAROIS.pdf',
    createdAt: '2026-05-30T14:25:00Z'
  },
  // RANK #7 — Petref Vila (Weighted: 3.8)
  {
    id: 'cand-indeed-6',
    name: 'Petref Vila',
    role: 'Car Salesman',
    experience: '3 years',
    currentCompany: 'Volkswagen / Mark\'s (Retail)',
    competitor: false, // Mark's retail is NOT Mark's Commercial B2B
    background: 'Car salesman with door-to-door experience. Previously worked at Mark\'s in a retail capacity — this is NOT Mark\'s Commercial B2B division and does not constitute competitive intel. Windsor, ON. No industrial or safety garment experience.',
    email: 'petervila9_8kn@indeedemail.com',
    phone: '226-739-6989',
    avatar: 'PV',
    status: 'screening',
    scorecard: {
      existingRolodex: 1,    // Zero industrial procurement contacts
      albertaProximity: 1,   // Windsor, ON — opposite end of Canada
      industryKnowledge: 1,  // No garment compliance knowledge whatsoever
      competitiveIntel: 2,   // Mark's retail =/= Mark's Commercial. Minimal insight.
      salesMethodology: 6,   // Car sales hustle is real, but B2C not B2B
    },
    notes: [
      { id: 'n-ind-6', author: 'Sol (Strategic Assessment)', content: 'RANK #7 (LOWEST). Originally flagged as a "Rolodex Hit" for Mark\'s, but Mark\'s retail is NOT Mark\'s Commercial B2B. This is a car salesman in Windsor, ON with 3 years experience and zero industrial safety contacts. Competitor flag removed. Not recommended for straight commission safety garment role.', timestamp: '2026-05-30T14:30:00Z' }
    ],
    resumeText: `PETREF VILA, Windsor, ON\n\nPROFESSIONAL SUMMARY\nCar Salesman with strong persuasion tactics. Door-to-door sales experience. Previously worked at Mark's (retail).`,
    resumePdfUrl: '/resumes/ResumePetrefVila.pdf',
    createdAt: '2026-05-30T14:30:00Z'
  },
  {
    id: 'cand-uploaded-terrysoetaert',
    name: 'Terry Soetaert',
    role: 'Construction & Oilfield Equipment Sales Representative',
    experience: '10 years',
    currentCompany: 'Construction & Oilfield Equipment Sales',
    competitor: false,
    background: 'Extensive experience specializing in sales, marketing, and hunting B2B industrial accounts. Proven track record building pipeline and relationships with construction, oilfield, and mining contractors. St. Albert, AB base.',
    email: 'Terry399@outlook.com',
    phone: '780-990-6518',
    avatar: 'TS',
    status: 'screening',
    scorecard: {
      existingRolodex: 5,
      albertaProximity: 10,
      industryKnowledge: 6,
      competitiveIntel: 5,
      salesMethodology: 10
    },
    notes: [
      { id: 'n-terry-1', author: 'Sol (Strategic Assessment)', content: 'Score: 70.0. St. Albert, AB. Excellent fit with direct oilfield and construction heavy equipment sales. Already has relationships with safety managers and contractor buyers. Highly recommended for interview.', timestamp: '2026-06-09T15:00:00Z' }
    ],
    resumeText: 'TERRY SOETAERT St. Albert, AB. 780-990-6518 Terry399@outlook.com. Heavy equipment sales and leasing in construction, oilfield, mining.',
    resumePdfUrl: '/resumes/ResumeTerrySoetaert.pdf',
    createdAt: '2026-06-09T15:00:00Z'
  },
  {
    id: 'cand-uploaded-matthewmarshall',
    name: 'Matthew Marshall',
    role: 'B2B Closer & Floor Manager',
    experience: '9 years',
    currentCompany: 'The King Eddy (Part-Time)',
    competitor: false,
    background: 'High-performing sales professional with consistent top-tier results. Proven ability to close complex, high-value deals. Fluent in Mandarin and Korean. Located in Calgary, AB.',
    email: 'matthewmarshalldop3x_or3@indeedemail.com',
    phone: '(403) 852-7460',
    avatar: 'MM',
    status: 'screening',
    scorecard: {
      existingRolodex: 5,
      albertaProximity: 10,
      industryKnowledge: 6,
      competitiveIntel: 5,
      salesMethodology: 9
    },
    notes: [
      { id: 'n-marshall-1', author: 'Sol (Strategic Assessment)', content: 'Score: 67.0. Calgary, AB. Good sales professional, multilingual. Background is slightly split between corporate closing and hospitality floor management. Interview to assess B2B hunting drive.', timestamp: '2026-06-09T15:00:00Z' }
    ],
    resumeText: 'Matthew Marshall Calgary, AB. (403) 852-7460. High-performing sales professional with closing operations experience.',
    resumePdfUrl: '/resumes/ResumeMatthewMarshall.pdf',
    createdAt: '2026-06-09T15:00:00Z'
  },
  {
    id: 'cand-uploaded-amberhamilton',
    name: 'Amber Hamilton',
    role: 'Sales Consultant',
    experience: '10 years',
    currentCompany: 'B2B Sales Consulting',
    competitor: false,
    background: 'Enthusiastic and results-driven sales consultant with B2B sales and customer service experience in high-paced environments. Located in Calgary, AB.',
    email: 'amberhamilton12@gmail.com',
    phone: '403-667-2907',
    avatar: 'AH',
    status: 'screening',
    scorecard: {
      existingRolodex: 5,
      albertaProximity: 10,
      industryKnowledge: 4,
      competitiveIntel: 5,
      salesMethodology: 10
    },
    notes: [
      { id: 'n-amber-1', author: 'Sol (Strategic Assessment)', content: 'Score: 65.0. Calgary, AB. Enthusiastic B2B sales consultant. Very polished communicator, but lacks direct technical safety garment or heavy industrial network. Interview to evaluate fit.', timestamp: '2026-06-09T15:00:00Z' }
    ],
    resumeText: 'Amber Hamilton Calgary, AB. 4036672907. Account management and business development skills.',
    resumePdfUrl: '/resumes/ResumeAmberHamilton.pdf',
    createdAt: '2026-06-09T15:00:00Z'
  },
  {
    id: 'cand-uploaded-raffistepanian',
    name: 'Raffi Stepanian',
    role: 'Apparel Sales Professional',
    experience: '9 years',
    currentCompany: 'Raffi Agency',
    competitor: false,
    background: '17 years in retail sales, account management, and operations in the fashion apparel, accessories, and footwear industries. Based in Toronto/Ontario.',
    email: 'info@raffiagency.com',
    phone: '+1 (416) 893-4450',
    avatar: 'RS',
    status: 'screening',
    scorecard: {
      existingRolodex: 5,
      albertaProximity: 2,
      industryKnowledge: 2,
      competitiveIntel: 5,
      salesMethodology: 9
    },
    notes: [
      { id: 'n-raffi-1', author: 'Sol (Strategic Assessment)', content: 'Score: 32.0 (Low fit). Based in Toronto. Heavy experience in fashion retail and footwear sales, but does not match RIVIX compliance workwear model. Not recommended for interview.', timestamp: '2026-06-09T15:00:00Z' }
    ],
    resumeText: 'RAFFI STEPANIAN Toronto, ON. info@raffiagency.com. Fashion apparel, footwear, accessories sales.',
    resumePdfUrl: '/resumes/ResumeRaffiStepanian.pdf',
    createdAt: '2026-06-09T15:00:00Z'
  }
];

// Dialogue Transcript for Sarah Jenkins' Screening Call
export const SARAH_TRANSCRIPT: TranscriptLine[] = [
  { speaker: 'Interviewer (RIVIX)', text: 'Hi Sarah, thank you for jumping on this call. We saw your background at Mark\'s Commercial, especially your work in oil and gas accounts. Could you tell us a bit about how you manage high-level client acquisitions in this space?', timestamp: '00:00', category: 'general' },
  { speaker: 'Sarah Jenkins', text: 'Thanks for having me! In the oil and gas sector, particularly with big operators like Suncor and Shell, the procurement process is highly institutionalized. But what most sales reps don\'t realize is that the decision isn\'t actually made by the corporate procurement department sitting in Calgary.', timestamp: '00:23', category: 'strategy', insight: 'Bypassing corporate procurement is a key growth strategy. Ground decisions in local safety heads.' },
  { speaker: 'Interviewer (RIVIX)', text: 'Oh really? Where is the decision made, then?', timestamp: '00:54', category: 'general' },
  { speaker: 'Sarah Jenkins', text: 'It\'s made in the field. It\'s the Health & Safety managers and the site Superintendents at facilities like Firebag or Base Plant. They are the ones who actually deal with compliance failures, chafing complaints, and winter clothing sizing errors. If you try to sell to Calgary procurement first, you get compared purely on price and cents per garment with giants like UniFirst or Aramark. But if you visit the site, hand-deliver sample overalls to the Safety Superintendents, and run a 2-week wear trial, they will write RIVIX directly into their safety specification sheet.', timestamp: '01:05', category: 'strategy', insight: 'Initiate 2-week field trials with local safety managers. This establishes unmatched brand loyalty.' },
  { speaker: 'Interviewer (RIVIX)', text: 'That is incredibly high value. When you were at Mark\'s, how did you handle custom compliance or flame-resistance (FR) requirements that are unique to each company?', timestamp: '01:52', category: 'technical' },
  { speaker: 'Sarah Jenkins', text: 'We dealt with CSA Z96 class 3 high-visibility layouts and NFPA 2112 flame-resistant threads constantly. Suncor, for instance, has a very strict mandate: garments must be rated at least 8 cal/cm² for electrical arc flash protection, even for general labor crews. Many smaller suppliers try to cut costs by using generic polyester sewing threads, which melt in flash-fires. At Mark\'s, we secured the accounts by running technical seminars proving we only use A&E Perma Core Tex 60 FR threads and Nomex zippers. If you can show a client the microscopic difference in thread survival, you gain 100% credibility on safety.', timestamp: '02:08', category: 'technical', insight: 'Always emphasize using 100% Nomex zippers and A&E Perma Core Tex 60 threads. Meltdown resistance is a major safety metric.' },
  { speaker: 'Interviewer (RIVIX)', text: 'Excellent. What about transitioning accounts from big competitors like UniFirst? How do you overcome their long-term contracts?', timestamp: '03:10', category: 'competitor' },
  { speaker: 'Sarah Jenkins', text: 'UniFirst is excellent at locking companies into 3-to-5 year rental contracts with hidden fees for lost garments or size changes. When I pitch, I show how buying outright from RIVIX combined with a regional laundering partner actually saves them 28% annually, while giving workers brand-new, premium-fitting overalls instead of stiff, worn-out rentals. I have active relationships with procurement contacts at Suncor contractors who are looking to escape these rigid rental templates right now.', timestamp: '03:26', category: 'competitor', insight: 'Uniform rental programs have 28%+ markups and hidden fees. Highlighting purchase ownership + local laundry partners wins contracts.' },
  { speaker: 'Interviewer (RIVIX)', text: 'Sarah, this has been an outstanding screening. We will absolutely coordinate a secondary deep-dive with our senior partner, Sol, to map out commission structures.', timestamp: '04:15', category: 'credibility' },
  { speaker: 'Sarah Jenkins', text: 'Sounds perfect, I look forward to meeting Sol! I\'ve been watching RIVIX\'s expansion, and you guys are building exactly the kind of agile safety brand that the major operators are hungry for right now.', timestamp: '04:30', category: 'credibility', insight: 'Demonstrates strong belief in RIVIX\'s agile brand value over rigid legacy players.' }
];

// Standard Operating Procedures for hiring
export const HIRING_SOPS: SOPDocument[] = [
  {
    id: 'sop-1',
    title: 'SOP 101: Straight Commission Compensation Model',
    category: 'commission',
    summary: '100% straight commission only. RIVIX never pays reps cash — no salary, draw, stipend, advance, allowance, or reimbursement. Reps earn when customers pay RIVIX.',
    sections: [
      {
        heading: '1. Objective & Scope',
        paragraphs: [
          'To establish a pure straight commission model that eliminates fixed payroll risk for RIVIX while offering uncapped earnings potential for reps who bring active procurement contacts and can close contracts independently.',
          'HARD RULE: RIVIX pays reps zero cash. Period. No exceptions by tier, tenure, or relocation. The only money a rep receives from RIVIX is commission on closed and collected customer revenue (Section 2).',
          'Applies to all Independent Sales Representatives and Contract Business Development Agents representing RIVIX compliance garments in Canada.'
        ]
      },
      {
        heading: '2. Commission Structure',
        paragraphs: [
          'Commission Rate: 12–15% of gross margin on all closed and collected revenue. This is intentionally higher than typical garment industry rates (5–8%) because there is no base salary.',
          'Residual Commission: 8% on all repeat/renewal orders from accounts originated by the rep. Residuals continue for 24 months from initial contract signing while actively representing RIVIX.',
          'Accelerator Bonus: Once a rep exceeds $250,000 in cumulative closed revenue in a fiscal year, commission rate increases to 18% on all subsequent deals for the remainder of that year.'
        ]
      },
      {
        heading: '3. Onboarding Support (In-Kind Only — Zero Cash)',
        paragraphs: [
          'RIVIX provides in-kind tools only: product samples (up to 3 garments per size for qualified reps), branded presentation materials, and portal demo access.',
          'RIVIX does not fund travel, vehicles, fuel, lodging, meals, phone, or living expenses. Reps cover all costs out of pocket until commission checks arrive.',
          'Never promise monthly pay, draws, advances, allowances, or reimbursements. If a candidate needs guaranteed income, they are not a fit for this role.'
        ]
      },
      {
        heading: '4. Territory & Account Ownership',
        paragraphs: [
          'Territory is assigned by postal code region. Alberta is divided into 4 zones: Edmonton/Nisku (Zone A), Red Deer/Lacombe (Zone B), Calgary/Cochrane (Zone C), Fort McMurray/Athabasca (Zone D).',
          'Account ownership lasts 12 months from first documented contact. If no revenue is generated from an account within 12 months, it reverts to open pool.',
          'Reps may not solicit accounts outside their assigned territory without written approval.'
        ]
      }
    ]
  },
  {
    id: 'sop-2',
    title: 'SOP 102: Weighted Candidate Scoring Model',
    category: 'interview',
    summary: 'The five-dimension weighted scoring system used to rank and prioritize sales candidates for straight-commission garment replication roles.',
    sections: [
      {
        heading: '1. Scoring Dimensions & Weights',
        paragraphs: [
          'EXISTING ROLODEX (30%): Active procurement contacts, safety superintendent relationships, and current accounts in target industries (oil & gas, construction, utilities, manufacturing). This is the single most important dimension because straight commission means no ramp time — they must close from existing relationships.',
          'ALBERTA / WESTERN CANADA PROXIMITY (20%): Physical presence in Alberta or Western Canada. Wear trials, site visits, and safety superintendent meetings are all in-person activities. Remote candidates from Ontario receive low scores here unless they commit to relocation.',
          'INDUSTRY KNOWLEDGE — FR / CSA / NFPA (20%): Technical fluency in flame-resistant fabrics, CSA Z96-15 high-vis standards, NFPA 2112 certification, arc flash ratings (ATPV/cal/cm²), and garment construction quality. Reps sell compliance assets, not t-shirts.',
          'COMPETITIVE INTEL (15%): Direct experience working at or selling against UniFirst, Cintas, Aramark, or Mark\'s Commercial. Understanding how competitors lock clients into rental contracts is RIVIX\'s core disruption advantage.',
          'SALES METHODOLOGY (15%): Proven B2B hunting ability, contract negotiation skills, deal closing track record. Preference for "hunters" over "farmers".'
        ]
      },
      {
        heading: '2. Tier Classification',
        paragraphs: [
          'Tier 1 (Weighted Score 7.0+): Priority candidates. Eligible for sample kits and immediate territory assignment. Schedule screening call within 48 hours. Compensation is identical to all tiers: commission only, zero cash from RIVIX.',
          'Tier 2 (Weighted Score 5.5–6.9): Solid candidates with gaps. May lack Alberta proximity or industry-specific knowledge. Require onboarding investment. Evaluate on case-by-case basis.',
          'Tier 3 (Weighted Score below 5.5): Low priority. Significant gaps in multiple dimensions. Not recommended for straight commission model — too risky for both parties.'
        ]
      },
      {
        heading: '3. Critical Disqualifiers',
        paragraphs: [
          'Mark\'s Retail is NOT Mark\'s Commercial B2B. Retail store experience does not constitute competitive intel. Do not flag retail employees as "Competitor" hires.',
          'Candidates with zero Alberta proximity AND zero existing rolodex are not viable for straight commission. They have no warm leads and no ability to do site visits.',
          'Car sales, real estate, and B2C door-to-door experience scores LOW on Sales Methodology. B2B contract selling to procurement departments is fundamentally different.'
        ]
      }
    ]
  },
  {
    id: 'sop-3',
    title: 'SOP 103: Brand Credibility Tactics for Young Founders',
    category: 'policy',
    summary: 'Guidelines and communication SOPs designed to ensure RIVIX\'s small, young executive team maintains absolute authority and credibility when conducting interviews with senior industry veterans.',
    sections: [
      {
        heading: '1. Setting the Frame of Authority',
        paragraphs: [
          'Do not apologize for RIVIX\'s startup size. Position RIVIX as an agile, compliance-first tech-enabled safety partner that is disrupting slow, bureaucratic legacy uniform providers (UniFirst, Aramark, Mark\'s).',
          'Focus on our rapid technical iteration: "We convert physical uniforms to digital tech packs and begin factory replication in 72 hours, whereas our competitors take 6 weeks."'
        ]
      },
      {
        heading: '2. Terminology & Communication Protocol',
        paragraphs: [
          'Always refer to our supply chain as "our advanced production factory, which maintains international ISO 9001 and WRAP-compliance certificates."',
          'Avoid talking about "shirts or pants". Speak in terms of "Active Safety Garments", "Compliance Batches", "Weave Densities (GSM)", and "Vendor-Managed Inventory (VMI) systems".'
        ]
      },
      {
        heading: '3. The Live Demo Close',
        paragraphs: [
          'During candidate interviews, open the RIVIX Portal on screen and walk through a live replication ticket. Show the AI garment analysis generating a full tech pack from a photo in real-time. This demonstrates technical depth that no competitor can match.',
          'Say: "Our reps walk into a safety superintendent\'s office, photograph their current worn-out overalls, and show them a factory-ready tech pack being generated on an iPad in 60 seconds. That is the RIVIX demo."'
        ]
      }
    ]
  },
  {
    id: 'sop-4',
    title: 'SOP 104: Portal as Sales Weapon — Field Playbook',
    category: 'sales-weapon',
    summary: 'How RIVIX sales reps leverage the Compliance Portal as a live sales tool during prospect meetings, wear trials, and contract negotiations.',
    sections: [
      {
        heading: '1. The 60-Second Replication Demo',
        paragraphs: [
          'This is RIVIX\'s killer sales move. During a prospect meeting, the rep photographs the client\'s current uniform (usually worn-out UniFirst/Cintas rentals), uploads it to the RIVIX Portal, and triggers the AI Garment Analysis. Within 60 seconds, the prospect sees a full tech pack generated: technical flat sketch, POM measurements, construction details, stitch specifications, and BOM.',
          'Script: "We don\'t need your spec sheet. We don\'t need your vendor\'s cooperation. Give me 60 seconds with your current uniform and I\'ll show you exactly what you\'re wearing — and how we can build it better, for less."',
          'This demo should be run on an iPad or laptop during every first meeting. It is the single most effective differentiation tool against legacy competitors who require 4–6 week quoting cycles.'
        ]
      },
      {
        heading: '2. Client Portal Access as a Closing Tool',
        paragraphs: [
          'During the negotiation phase, offer the prospect a free client portal login. They can track their sample replication in real-time — from submission to AI spec mapping to factory production to shipping.',
          'UniFirst and Cintas do not offer this transparency. When a prospect can see their garment being replicated live on a dashboard, it builds trust that eliminates the "unknown supplier" objection.',
          'The Compliance Certificates page auto-generates CSA/NFPA compliance PDFs. Email these to the prospect\'s safety manager during the meeting. Competitors take weeks to produce compliance documentation.'
        ]
      },
      {
        heading: '3. Wear Trial Protocol',
        paragraphs: [
          'Step 1: Rep visits the site with 3 sample garments (M, L, XL) and a branded RIVIX presentation folder.',
          'Step 2: Photograph the client\'s current garments on-site. Upload to RIVIX Portal and run AI analysis in front of the safety superintendent.',
          'Step 3: Leave sample garments for a 2-week wear trial. Set a calendar reminder for follow-up.',
          'Step 4: At follow-up, collect feedback and open the Client Portal to show the full tech pack. Ask: "Do you want us to produce 500 of these with your logo?"',
          'Step 5: If yes, create the replication ticket in the portal and walk the client through real-time tracking.'
        ]
      },
      {
        heading: '4. Competitive Displacement Script (UniFirst/Cintas)',
        paragraphs: [
          'When a prospect says "We already have a contract with UniFirst/Cintas", use this framework:',
          '"I understand. Most companies do. But let me ask — do you know what you\'re actually paying per garment per week? When you factor in lost garment charges, size change fees, damage surcharges, and mandatory minimums, you\'re typically paying 28–40% more than outright ownership. We can replicate your exact garment, at higher quality with FR-rated Nomex threads and YKK zippers, and deliver ownership in 3 weeks. Your workers get brand-new garments, and you stop renting."',
          'Key data points: UniFirst average rental cost per garment is $3.50–$5.00/week ($182–$260/year). RIVIX ownership cost for equivalent garment: $85–$140 one-time. Break-even in 6–8 months. 3-year savings: $300–$500 per worker.'
        ]
      },
      {
        heading: '5. Target Industry Priority List',
        paragraphs: [
          '1. OIL & GAS CONTRACTORS (Highest priority): Suncor, CNRL, Cenovus subcontractors. FR overalls, high-vis, arc flash protection. Highest margin, most compliance-driven. Decision maker: Site Safety Superintendent.',
          '2. CONSTRUCTION / HEAVY CIVIL: High-vis vests, work pants, cold-weather parkas. Decision maker: Project Safety Coordinator.',
          '3. UTILITIES / ELECTRICAL: Arc-rated FR garments mandated by electrical safety code. Decision maker: Safety Manager.',
          '4. MUNICIPAL / TRANSIT: Uniforms with high-vis. Lower margin but high volume and repeat orders. Decision maker: Procurement Department.',
          '5. FOOD PROCESSING / MANUFACTURING: General workwear, less compliance-driven but steady volume. Decision maker: Plant Manager.'
        ]
      }
    ]
  }
];

const LOCAL_STORAGE_KEY = 'rivix_hiring_candidates_v4';

// Safely get all candidates
export const getCandidates = async (): Promise<Candidate[]> => {
  if (typeof window === 'undefined') return DEFAULT_CANDIDATES;

  try {
    const { data, error } = await supabase
      .from('hiring_candidates')
      .select('*');

    if (error) {
      console.warn('Supabase error fetching candidates, falling back to local storage:', error);
      throw error;
    }

    let dbCandidates: Candidate[] = [];
    if (data && data.length > 0) {
      dbCandidates = data.map((d: any) => ({
        id: d.id,
        name: d.name,
        role: d.role,
        experience: d.experience,
        currentCompany: d.current_company,
        competitor: d.competitor,
        background: d.background,
        email: d.email,
        phone: d.phone,
        avatar: d.avatar,
        status: d.status,
        scorecard: d.scorecard || DEFAULT_SCORECARD,
        notes: d.notes || [],
        resumeText: d.resume_text || '',
        resumePdfUrl:
          d.resume_pdf_url ||
          DEFAULT_CANDIDATES.find((c) => c.id === d.id)?.resumePdfUrl,
        createdAt: d.created_at || d.createdAt || new Date().toISOString(),
      }));
    }

    // Always merge with local storage candidates to ensure locally uploaded/modified candidates are present!
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const localCandidates = JSON.parse(stored);
        if (Array.isArray(localCandidates) && localCandidates.length > 0) {
          const merged = [...dbCandidates];
          for (const local of localCandidates) {
            const idx = merged.findIndex(c => c.id === local.id);
            if (idx >= 0) {
              merged[idx] = local;
            } else {
              merged.push(local);
            }
          }
          return merged;
        }
      } catch (e) {
        // Ignore parse error
      }
    }

    if (dbCandidates.length > 0) {
      return dbCandidates;
    }
  } catch (err) {
    // Silent catch
  }

  // Local Storage Fallback (if both DB and Local Storage are empty)
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      // Ignore parse errors, overwrite
    }
  }

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_CANDIDATES));
  return DEFAULT_CANDIDATES;
};

// Save a single candidate (updates notes or scorecard)
export const saveCandidate = async (candidate: Candidate): Promise<void> => {
  if (typeof window === 'undefined') return;

  try {
    const dbObject = {
      id: candidate.id,
      name: candidate.name,
      role: candidate.role,
      experience: candidate.experience,
      current_company: candidate.currentCompany,
      competitor: candidate.competitor,
      background: candidate.background,
      email: candidate.email,
      phone: candidate.phone,
      avatar: candidate.avatar,
      status: candidate.status,
      scorecard: candidate.scorecard,
      notes: candidate.notes,
      resume_text: candidate.resumeText,
      resume_pdf_url: candidate.resumePdfUrl,
      created_at: candidate.createdAt || new Date().toISOString(),
    };

    const { error } = await supabase
      .from('hiring_candidates')
      .upsert(dbObject, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase candidate save failed, updating localStorage:', error);
      throw error;
    }
  } catch (err) {
    // Silent catch
  }

  // Local Storage Sync
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    let cands: Candidate[] = stored ? JSON.parse(stored) : DEFAULT_CANDIDATES;

    const index = cands.findIndex(c => c.id === candidate.id);
    if (index >= 0) {
      cands[index] = candidate;
    } else {
      cands.push(candidate);
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cands));
  } catch (lsErr) {
    console.error('Failed to sync to localStorage (possibly quota exceeded):', lsErr);
    // If quota is exceeded, strip large base64 PDF to at least preserve candidate metadata
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      let cands: Candidate[] = stored ? JSON.parse(stored) : DEFAULT_CANDIDATES;
      const strippedCandidate: Candidate = {
        ...candidate,
        resumePdfUrl: undefined
      };
      const index = cands.findIndex(c => c.id === candidate.id);
      if (index >= 0) {
        cands[index] = strippedCandidate;
      } else {
        cands.push(strippedCandidate);
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cands));
      console.warn('Saved candidate metadata by stripping large base64 PDF to fit storage quota.');
    } catch (innerErr) {
      console.error('Even stripped candidate could not be saved to localStorage:', innerErr);
    }
  }
};

// Delete a candidate from both database and local storage
export const deleteCandidate = async (candidateId: string): Promise<void> => {
  if (typeof window === 'undefined') return;

  try {
    const { error } = await supabase
      .from('hiring_candidates')
      .delete()
      .eq('id', candidateId);

    if (error) {
      console.warn('Supabase candidate delete failed:', error);
      throw error;
    }
  } catch (err) {
    // Silent catch
  }

  // Local Storage Sync
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (stored) {
    try {
      const cands: Candidate[] = JSON.parse(stored);
      const filtered = cands.filter(c => c.id !== candidateId);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      // Ignore parse error
    }
  }
};
