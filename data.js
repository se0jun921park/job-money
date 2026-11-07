/*
 * Career and education-cost data (US, 2025 dollars).
 *
 * Each figure carries a source key; see SOURCES below and the
 * "Methodology & sources" section of the page. Salaries are kept in
 * constant 2025 dollars: no inflation or real wage growth is applied.
 */

// Published tuition & required fees per year.
const TUITION = {
  undergrad: { public: 11950, private: 45000 }, // College Board, 2025-26
  medical:   { public: 43648, private: 74661 }, // AAMC tuition, fees & health insurance, 1st-yr median, 2025-26
  law:       { public: 31542, private: 57927 }, // ABA / LSAC LawHub, 2024
  dental:    { public: 47000, private: 88000 }, // ADA HPI 2022-23 ($42,821 / $80,869), adjusted to 2025
};

// Federal Direct Unsubsidized loan rates, 2025-26 award year.
const LOAN_RATES = {
  undergrad: 0.0639,
  graduate: 0.0794,
};

// AAMC 2025 Survey of Resident/Fellow Stipends: PGY-1 average $68,166,
// rising toward $94,215 at PGY-8.
const RESIDENT_STIPENDS = [68166, 70800, 73500, 76400, 79300, 82300, 85200, 94215];

const UG = { kind: "undergrad", years: 4, label: "Bachelor's" };

const CAREERS = [
  {
    id: "gp",
    name: "General Doctor",
    short: "General Dr.",
    detail: "Family / primary care physician",
    school: [UG, { kind: "medical", years: 4, label: "MD" }],
    training: { years: 3, label: "residency" },
    startSalary: 255000,
    peakSalary: 310000,
    yearsToPeak: 15,
    sources: ["aamcTuition", "aamcStipend", "medscape"],
    note: "Medscape 2026 report: primary care physicians averaged $298K in 2025 across all career stages.",
  },
  {
    id: "specialist",
    name: "Specialized Doctor",
    short: "Specialist Dr.",
    detail: "Surgeon, cardiologist, or other specialist",
    school: [UG, { kind: "medical", years: 4, label: "MD" }],
    training: { years: 6, label: "residency + fellowship" },
    startSalary: 360000,
    peakSalary: 460000,
    yearsToPeak: 15,
    sources: ["aamcTuition", "aamcStipend", "medscape"],
    note: "Medscape 2026 report: specialists averaged $417K in 2025. Orthopedics, cardiology and plastic surgery run well above $500K.",
  },
  {
    id: "lawyer",
    name: "Lawyer",
    short: "Lawyer",
    detail: "Attorney after a 3-year JD",
    school: [UG, { kind: "law", years: 3, label: "JD" }],
    training: null,
    startSalary: 95000,
    peakSalary: 185000,
    yearsToPeak: 20,
    sources: ["lawhub", "nalp", "blsLawyer"],
    note: "Starting pay is bimodal: NALP's Class of 2024 median was $95K, while large private firms paid around $225K.",
  },
  {
    id: "engineer",
    name: "Engineer",
    short: "Engineer",
    detail: "Mechanical, civil, or electrical engineer",
    school: [UG],
    training: null,
    startSalary: 78731,
    peakSalary: 135000,
    yearsToPeak: 20,
    sources: ["collegeBoard", "nace", "blsEng"],
    note: "BLS May 2024 medians: mechanical engineers $102,320, civil engineers $99,590.",
  },
  {
    id: "swe",
    name: "Software Engineer",
    short: "Software Eng.",
    detail: "Software developer with a CS degree",
    school: [UG],
    training: null,
    startSalary: 81535,
    peakSalary: 180000,
    yearsToPeak: 15,
    sources: ["collegeBoard", "nace", "blsSwe"],
    note: "BLS May 2024 median for software developers was $133,080. Big-tech total compensation with stock can run far higher.",
  },
  {
    id: "ib",
    name: "Investment Banker",
    short: "Inv. Banker",
    detail: "Analyst → associate → VP → director track",
    school: [UG],
    training: null,
    startSalary: 175000,
    peakSalary: 650000,
    yearsToPeak: 12,
    sources: ["collegeBoard", "ibComp"],
    note: "Assumes the banker stays on the promotion track to director. Most analysts leave banking within a few years, so this is the high-side path.",
  },
  {
    id: "dentist",
    name: "Dentist",
    short: "Dentist",
    detail: "General dentist after a 4-year DDS/DMD",
    school: [UG, { kind: "dental", years: 4, label: "DDS" }],
    training: null,
    startSalary: 150000,
    peakSalary: 220000,
    yearsToPeak: 15,
    sources: ["adaTuition", "adeaDebt", "blsDentist"],
    note: "BLS May 2024 mean wage for general dentists was $191,350. Practice owners usually out-earn associates.",
  },
  {
    id: "teacher",
    name: "Teacher",
    short: "Teacher",
    detail: "Public K-12 teacher",
    school: [UG],
    training: null,
    startSalary: 48112,
    peakSalary: 88000,
    yearsToPeak: 25,
    sources: ["collegeBoard", "nea"],
    note: "NEA 2024-25: average starting salary $48,112, average salary $74,495. Peak assumes the top of a district scale with a master's.",
  },
];

const SOURCES = {
  collegeBoard: {
    label: "College Board, Trends in College Pricing 2025: average published in-state tuition & fees at public 4-year colleges $11,950; private nonprofit $45,000 (2025-26)",
    url: "https://research.collegeboard.org/media/pdf/Trends-in-College-Pricing-and-Student-Aid-2025-final_0.pdf",
  },
  aamcTuition: {
    label: "AAMC Tuition and Student Fees: first-year median tuition, fees & health insurance, public resident $43,648; private $74,661 (2025-26). Median 4-year cost of attendance for the Class of 2025: $286,454 public, $390,848 private",
    url: "https://students-residents.aamc.org/media/12846/download",
  },
  aamcStipend: {
    label: "AAMC 2025 Survey of Resident/Fellow Stipends and Benefits: PGY-1 average $68,166, PGY-8 $94,215",
    url: "https://www.ama-assn.org/medical-residents/residency-life/resident-physician-pay-still-rising-growth-trails-inflation",
  },
  medscape: {
    label: "Medscape Physician Compensation Report 2025 (2024 pay): primary care $281K, specialists $398K; the 2026 report puts 2025 pay at $298K and $417K",
    url: "https://www.webmd.com/corporate/press/20250415/medscape2025-physician-compensation-report",
  },
  lawhub: {
    label: "LSAC LawHub: average law school tuition, public resident $31,542; private $57,927 (2024)",
    url: "https://www.lawhub.org/trends/tuition",
  },
  nalp: {
    label: "NALP, Class of 2024 Selected Findings: overall median starting salary $95,000",
    url: "https://www.nalp.org/0925research",
  },
  blsLawyer: {
    label: "BLS Occupational Employment and Wage Statistics, May 2024: lawyers median $145,760",
    url: "https://www.bls.gov/ooh/legal/lawyers.htm",
  },
  nace: {
    label: "NACE Salary Survey: projected starting salary for engineering bachelor's $78,731 (Class of 2025) and computer science $81,535 (Winter 2026)",
    url: "https://naceweb.org/about-us/press/engineering-computer-sciences-top-salary-projections-for-class-of-2025-bachelors-grads",
  },
  blsEng: {
    label: "BLS Occupational Outlook Handbook, May 2024: mechanical engineers median $102,320; civil engineers $99,590",
    url: "https://www.bls.gov/ooh/architecture-and-engineering/home.htm",
  },
  blsSwe: {
    label: "BLS Occupational Outlook Handbook, May 2024: software developers median $133,080",
    url: "https://www.bls.gov/ooh/computer-and-information-technology/software-developers.htm",
  },
  ibComp: {
    label: "Street compensation surveys for 2025 (Mergers & Inquisitions, eFinancialCareers): analyst all-in $160K–210K, associate $275K–475K, VP $500K–700K, director $600K–800K",
    url: "https://www.efinancialcareers.com/news/investment-banking-pay-2025",
  },
  adaTuition: {
    label: "ADA Health Policy Institute, Survey of Dental Education 2022-23: first-year tuition & fees, public resident $42,821; private $80,869",
    url: "https://www.ada.org/resources/research/health-policy-institute/dental-education",
  },
  adeaDebt: {
    label: "ADEA Survey of Dental School Seniors: average dental school debt $280,700 for the Class of 2023 ($296,500 total education debt)",
    url: "https://www.adea.org/home/publications/research-and-data/dental-school-seniors",
  },
  blsDentist: {
    label: "BLS OEWS, May 2024: general dentists mean wage $191,350",
    url: "https://www.bls.gov/oes/current/oes291021.htm",
  },
  nea: {
    label: "NEA Rankings & Estimates / Teacher Salary Benchmark: average starting salary $48,112; average teacher salary $74,495 (2024-25)",
    url: "https://www.nea.org/resource-library/educator-pay-and-student-spending-how-does-your-state-rank",
  },
  loanRates: {
    label: "Federal Student Aid: Direct Unsubsidized loan rates for 2025-26, 6.39% undergraduate and 7.94% graduate/professional",
    url: "https://studentaid.gov/understand-aid/types/loans/interest-rates",
  },
  irs: {
    label: "IRS 2025 tax brackets (single filer) and $15,750 standard deduction; SSA 2025 wage base $176,100",
    url: "https://www.irs.gov/filing/federal-income-tax-rates-and-brackets",
  },
};

// Plain global (no ES modules) so the page also works when opened from disk.
window.CareerData = { TUITION, LOAN_RATES, RESIDENT_STIPENDS, CAREERS, SOURCES };
