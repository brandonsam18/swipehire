// Fields of work for the Field filter, so students of every major can find
// their internships. Each posting gets exactly one field, from its source's
// category: Adzuna's category tag, or the SimplifyJobs category. Adzuna's
// catch-all categories fall back to keywords in the title.

export const FIELDS = [
  {
    id: "business",
    name: "Business & Finance",
    emoji: "💼",
    adzunaCategories: [
      "accounting-finance-jobs", "consultancy-jobs", "sales-jobs", "admin-jobs", "hr-jobs",
      "customer-services-jobs", "retail-jobs", "property-jobs", "logistics-warehouse-jobs",
    ],
    simplifyCategories: ["Quant"],
    titlePattern: /account|financ|bank|business|consult|sales|human resources|\bhr\b|operations|supply chain|real estate|audit|tax/,
  },
  {
    id: "marketing",
    name: "Marketing & Communications",
    emoji: "📣",
    adzunaCategories: ["pr-advertising-marketing-jobs"],
    titlePattern: /marketing|communicat|social media|public relations|\bpr\b|advertis|journalis|content|brand/,
  },
  {
    id: "arts",
    name: "Arts & Design",
    emoji: "🎨",
    adzunaCategories: ["creative-design-jobs"],
    titlePattern: /design|\bart\b|arts\b|museum|film|video|photo|music|theat|fashion/,
  },
  {
    id: "healthcare",
    name: "Healthcare",
    emoji: "🩺",
    adzunaCategories: ["healthcare-nursing-jobs"],
    titlePattern: /health|nurs|clinic|medical|hospital|pharma|patient|dental|therap/,
  },
  {
    id: "science",
    name: "Science & Research",
    emoji: "🔬",
    adzunaCategories: ["scientific-qa-jobs"],
    titlePattern: /research|scien|\blab\b|laboratory|biolog|chemi|environment|ecolog/,
  },
  {
    id: "education",
    name: "Education",
    emoji: "🍎",
    adzunaCategories: ["teaching-jobs"],
    titlePattern: /teach|educat|tutor|school|curriculum/,
  },
  {
    id: "law",
    name: "Law & Government",
    emoji: "⚖️",
    adzunaCategories: ["legal-jobs"],
    titlePattern: /legal|\blaw\b|paralegal|policy|government|legislat|public affairs/,
  },
  {
    id: "social-impact",
    name: "Nonprofit & Social Work",
    emoji: "🤝",
    adzunaCategories: ["charity-voluntary-jobs", "social-work-jobs"],
    titlePattern: /nonprofit|non-profit|social work|community|volunteer|advoca/,
  },
  {
    id: "engineering",
    name: "Engineering & Manufacturing",
    emoji: "⚙️",
    adzunaCategories: [
      "engineering-jobs", "manufacturing-jobs", "energy-oil-gas-jobs", "trade-construction-jobs", "maintenance-jobs",
    ],
    simplifyCategories: ["Hardware", "Hardware Engineering"],
    titlePattern: /engineer|manufactur|mechanical|civil|construction|energy|electrical/,
  },
  {
    id: "hospitality",
    name: "Hospitality & Travel",
    emoji: "🏨",
    adzunaCategories: ["hospitality-catering-jobs", "travel-jobs"],
    titlePattern: /hospitality|hotel|event|culinary|travel|tourism/,
  },
  {
    id: "computing",
    name: "Computing & Data",
    emoji: "💻",
    adzunaCategories: ["it-jobs"],
    titlePattern: /software|developer|\bit\b|data|computer|cyber|web/,
  },
  { id: "other", name: "Other", emoji: "✨" },
];

// SimplifyJobs only lists computing internships, so its other categories
// (Software, AI/ML/Data, Product, ...) all belong here.
const SIMPLIFY_DEFAULT_FIELD = "computing";
const OTHER_FIELD = "other";

const FIELDS_BY_ADZUNA_CATEGORY = new Map(
  FIELDS.flatMap((field) => (field.adzunaCategories ?? []).map((category) => [category, field.id])),
);
const FIELDS_BY_SIMPLIFY_CATEGORY = new Map(
  FIELDS.flatMap((field) => (field.simplifyCategories ?? []).map((category) => [category, field.id])),
);

/** Every Adzuna category SwipeHire fetches internships from. */
export const ADZUNA_CATEGORIES = [...FIELDS_BY_ADZUNA_CATEGORY.keys()];

/** Returns the id of the field a posting belongs to. */
export function fieldIdOf(posting) {
  if (posting.source !== "adzuna") {
    return FIELDS_BY_SIMPLIFY_CATEGORY.get(posting.category) ?? SIMPLIFY_DEFAULT_FIELD;
  }
  const fieldId = FIELDS_BY_ADZUNA_CATEGORY.get(posting.category);
  if (fieldId) return fieldId;
  // Catch-all categories like "Graduate Jobs": the title usually names the field.
  const title = posting.title.toLowerCase();
  return FIELDS.find((field) => field.titlePattern?.test(title))?.id ?? OTHER_FIELD;
}

export function fieldById(fieldId) {
  return FIELDS.find((field) => field.id === fieldId) ?? FIELDS.find((field) => field.id === OTHER_FIELD);
}
