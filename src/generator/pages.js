import { getCountry, DEFAULT_COUNTRY } from "./countries/index.js";

const CATEGORIES = [
  {
    category: "Coffee Shop",
    tone: "casual",
    suffixes: ["Coffee Co.", "Roasters", "Brew House", "Coffee Bar", "Espresso Co.", "Coffee Works"],
    focuses: [
      "small-batch single-origin coffee and espresso flights",
      "specialty pour-overs, cold brew, and signature lattes",
      "ethically sourced beans, daily roasts, and barista picks",
      "neighborhood coffee culture and seasonal drink rotations",
    ],
  },
  {
    category: "Bakery",
    tone: "casual",
    suffixes: ["Bakehouse", "Bakery", "Baking Co.", "Pastry Co.", "Bake Shop", "Breads"],
    focuses: [
      "artisan sourdough, croissants, and seasonal pastries",
      "hand-rolled breads, viennoiserie, and morning bakes",
      "small-batch cakes, tarts, and celebration desserts",
      "rustic pastries, danishes, and whole-grain loaves",
    ],
  },
  {
    category: "Restaurant",
    tone: "casual",
    suffixes: ["Kitchen", "Eatery", "Table", "Bistro", "House", "Dining Co."],
    focuses: [
      "modern comfort dishes with global spice blends",
      "seasonal small plates and chef-driven specials",
      "wood-fired classics and locally sourced ingredients",
      "regional flavors served family-style with house ferments",
    ],
  },
  {
    category: "Food Truck",
    tone: "casual",
    suffixes: ["Eats", "Street Eats", "Food Truck", "Mobile Kitchen", "Truck Co.", "Roll-Up"],
    focuses: [
      "chef-driven street food and rotating weekly specials",
      "loaded sandwiches, fries, and crowd-favorite combos",
      "fusion tacos, bowls, and late-night cravings",
      "smash burgers, dirty fries, and limited-time drops",
    ],
  },
  {
    category: "Ice Cream Shop",
    tone: "casual",
    suffixes: ["Creamery", "Ice Cream Co.", "Scoop Shop", "Sweet Co.", "Cone Co.", "Frozen Co."],
    focuses: [
      "small-batch ice cream and handcrafted toppings",
      "rotating seasonal flavors and signature sundaes",
      "dairy-free pints, sorbets, and dessert collabs",
      "classic scoops, soft serve, and milkshake builds",
    ],
  },
  {
    category: "Juice Bar",
    tone: "wellness",
    suffixes: ["Juice Bar", "Juice Co.", "Press Bar", "Juicery", "Smoothie Co."],
    focuses: [
      "cold-pressed juices, smoothies, and wellness shots",
      "functional smoothies, adaptogen blends, and detox bowls",
      "fresh-pressed juice cleanses and immunity tonics",
      "everyday energy bowls and protein-packed smoothies",
    ],
  },
  {
    category: "Vegan Cafe",
    tone: "casual",
    suffixes: ["Vegan Cafe", "Plant Cafe", "Greens Cafe", "Plant Kitchen", "Veg Co."],
    focuses: [
      "plant-based comfort meals and dairy-free desserts",
      "whole-food plant bowls and seasonal salads",
      "vegan brunch, baked goods, and oat-milk lattes",
      "ethical, plant-forward menus and meal-prep boxes",
    ],
  },
  {
    category: "Craft Brewery",
    tone: "casual",
    suffixes: ["Brewery", "Brewing Co.", "Beer Co.", "Brewhouse", "Brew Lab", "Brew Works"],
    focuses: [
      "small-batch ales, tastings, and brewery tours",
      "hop-forward IPAs, lagers, and limited seasonal pours",
      "barrel-aged stouts, sours, and taproom releases",
      "craft beer flights, pairings, and live brewery events",
    ],
  },
  {
    category: "Winery",
    tone: "casual",
    suffixes: ["Cellars", "Vineyards", "Winery", "Wine Co.", "Estate Wines", "Wine House"],
    focuses: [
      "estate wines, pairings, and tasting room experiences",
      "small-lot reds, whites, and library releases",
      "boutique varietals and seasonal vineyard events",
      "wine club tastings, harvest tours, and pairing dinners",
    ],
  },
  {
    category: "Catering",
    tone: "casual",
    suffixes: ["Catering", "Catering Co.", "Plated Co.", "Catering Kitchen", "Event Eats"],
    focuses: [
      "custom menus for private events and corporate functions",
      "buffet, plated, and grazing-table catering options",
      "wedding catering, dietary menus, and live cooking stations",
      "small-event drop-offs and full-service catering teams",
    ],
  },
  {
    category: "Fitness Studio",
    tone: "wellness",
    suffixes: ["Fitness Lab", "Fitness Studio", "Strength Co.", "Performance Lab", "Training House", "Gym Co."],
    focuses: [
      "strength training programs and performance coaching",
      "small-group HIIT, mobility, and conditioning classes",
      "personal training, body composition, and habit coaching",
      "barbell strength, cardio circuits, and athletic prep",
    ],
  },
  {
    category: "Yoga Studio",
    tone: "wellness",
    suffixes: ["Yoga House", "Yoga Studio", "Yoga Co.", "Yoga Collective", "Mindful Studio"],
    focuses: [
      "mindful vinyasa, restorative sessions, and breathwork",
      "hot yoga, slow flows, and meditation classes",
      "beginner-friendly yoga, prenatal sessions, and workshops",
      "yin yoga, sound baths, and weekend retreats",
    ],
  },
  {
    category: "Spa",
    tone: "wellness",
    suffixes: ["Wellness Spa", "Spa", "Day Spa", "Spa Retreat", "Wellness Co.", "Spa House"],
    focuses: [
      "therapeutic massage, facials, and stress recovery rituals",
      "deep-tissue work, hot stone therapy, and aromatherapy",
      "skin treatments, body wraps, and signature spa journeys",
      "couple's spa packages, sauna sessions, and reflexology",
    ],
  },
  {
    category: "Salon",
    tone: "wellness",
    suffixes: ["Salon", "Hair Studio", "Beauty Co.", "Style House", "Hair House"],
    focuses: [
      "precision cuts, color transformations, and styling",
      "balayage, highlights, and gloss treatments",
      "bridal styling, blowouts, and special-occasion hair",
      "men's grooming, kids' cuts, and full-service salon care",
    ],
  },
  {
    category: "Dental Clinic",
    tone: "professional",
    suffixes: ["Dental Group", "Dental Co.", "Dental Studio", "Dental Care", "Smiles Co."],
    focuses: [
      "family dentistry, cosmetic care, and preventive checkups",
      "cleanings, whitening, and Invisalign treatments",
      "implants, veneers, and full-mouth restorations",
      "pediatric dentistry, sealants, and gentle adult care",
    ],
  },
  {
    category: "Medical Clinic",
    tone: "wellness",
    suffixes: ["Medical Clinic", "Health Clinic", "Family Care", "Medical Group", "Care Center"],
    focuses: [
      "primary care, diagnostics, and preventive health services",
      "family medicine, screenings, and chronic care management",
      "same-day visits, vaccinations, and lab work",
      "telehealth consults, wellness checks, and health coaching",
    ],
  },
  {
    category: "Chiropractic Clinic",
    tone: "wellness",
    suffixes: ["Chiropractic", "Chiropractic Co.", "Spine Care", "Wellness Chiro", "Adjust Studio"],
    focuses: [
      "spine care, posture treatment, and pain relief plans",
      "sports injury recovery, adjustments, and mobility work",
      "neck, back, and posture rehabilitation programs",
      "prenatal chiropractic, decompression, and wellness care",
    ],
  },
  {
    category: "Nutritionist",
    tone: "wellness",
    suffixes: ["Nutrition", "Nutrition Co.", "Nutrition Lab", "Diet Studio", "Plate Co."],
    focuses: [
      "personalized nutrition plans and meal strategies",
      "weight management, macro coaching, and habit building",
      "gut health, food sensitivities, and elimination protocols",
      "sports nutrition, hydration plans, and recovery fueling",
    ],
  },
  {
    category: "Health Coach",
    tone: "wellness",
    suffixes: ["Health Coaching", "Wellness Coaching", "Coach Co.", "Habit Studio"],
    focuses: [
      "habit coaching, accountability, and wellness planning",
      "stress management, sleep, and energy optimization",
      "behavior change support and lifestyle redesign",
      "holistic coaching for busy professionals and parents",
    ],
  },
  {
    category: "Pharmacy",
    tone: "professional",
    suffixes: ["Pharmacy", "Community Pharmacy", "Drugstore", "Pharmacy Co.", "Care Pharmacy"],
    focuses: [
      "prescriptions, wellness products, and health consultations",
      "compounding services, vaccinations, and refills",
      "OTC essentials, supplements, and pharmacist advice",
      "medication management, delivery, and chronic care support",
    ],
  },
  {
    category: "Real Estate",
    tone: "professional",
    suffixes: ["Realty", "Real Estate", "Realty Group", "Realty Co.", "Properties", "Realty Partners"],
    focuses: [
      "home buying guidance and neighborhood market insights",
      "first-time buyer support and seller staging plans",
      "luxury listings, investment properties, and relocation help",
      "condos, townhomes, and family-home transactions",
    ],
  },
  {
    category: "Law Firm",
    tone: "professional",
    suffixes: ["Legal Partners", "Law Group", "Legal", "Law Firm", "Law Co.", "Legal Co."],
    focuses: [
      "business law, contracts, and civil representation",
      "estate planning, wills, and trust administration",
      "family law, mediation, and child-custody guidance",
      "personal injury claims and insurance dispute support",
    ],
  },
  {
    category: "Accounting Services",
    tone: "professional",
    suffixes: ["Accounting", "Bookkeeping", "Tax Co.", "Accounting Group", "Ledger Co."],
    focuses: [
      "bookkeeping, payroll, and tax preparation services",
      "small-business accounting and financial statements",
      "tax planning, audits, and compliance support",
      "QuickBooks setup, monthly reconciliation, and reporting",
    ],
  },
  {
    category: "Insurance Agency",
    tone: "professional",
    suffixes: ["Insurance", "Insurance Co.", "Coverage Co.", "Insure Group", "Assurance Co."],
    focuses: [
      "personal and business coverage planning",
      "auto, home, and life insurance bundles",
      "commercial liability, workers' comp, and risk consulting",
      "health, disability, and supplemental coverage options",
    ],
  },
  {
    category: "IT Services",
    tone: "professional",
    suffixes: ["IT Solutions", "IT Co.", "Tech Solutions", "Network Co.", "Tech Group"],
    focuses: [
      "managed IT support, networking, and device security",
      "cloud migration, backups, and disaster recovery",
      "cybersecurity audits, endpoint protection, and patching",
      "help-desk support, hardware setup, and IT consulting",
    ],
  },
  {
    category: "Digital Marketing",
    tone: "professional",
    suffixes: ["Digital", "Digital Co.", "Marketing", "Media Co.", "Marketing Lab"],
    focuses: [
      "social media campaigns, ads, and content strategy",
      "SEO, paid search, and conversion optimization",
      "branding, content creation, and growth marketing",
      "email marketing, funnels, and analytics reporting",
    ],
  },
  {
    category: "Architecture Firm",
    tone: "creative",
    suffixes: ["Architecture", "Architects", "Architecture Co.", "Design Studio"],
    focuses: [
      "residential and commercial architectural design",
      "modern home design, renovations, and additions",
      "sustainable architecture and adaptive reuse projects",
      "interiors, master planning, and construction documents",
    ],
  },
  {
    category: "Engineering Consultancy",
    tone: "professional",
    suffixes: ["Engineering", "Engineering Co.", "Engineering Group", "Engineering Lab"],
    focuses: [
      "structural planning and technical project support",
      "civil, structural, and MEP engineering services",
      "feasibility studies, code review, and inspections",
      "construction administration and design optimization",
    ],
  },
  {
    category: "Photography Studio",
    tone: "creative",
    suffixes: ["Portrait Studio", "Photography", "Photo Studio", "Photography Co."],
    focuses: [
      "family portraits, branding shoots, and event coverage",
      "wedding photography, engagements, and editorial sessions",
      "newborn, maternity, and milestone photography",
      "headshots, product photography, and brand stories",
    ],
  },
  {
    category: "Video Production",
    tone: "creative",
    suffixes: ["Video House", "Video Co.", "Productions", "Film Co.", "Video Lab"],
    focuses: [
      "brand videos, commercials, and event film coverage",
      "documentary-style storytelling and brand films",
      "social-media-first video and short-form content",
      "wedding films, music videos, and promotional reels",
    ],
  },
  {
    category: "Music School",
    tone: "education",
    suffixes: ["Music Academy", "Music School", "Music Studio", "Music Co.", "Music Lab"],
    focuses: [
      "instrument lessons, music theory, and ensemble coaching",
      "guitar, piano, and voice lessons for all ages",
      "songwriting, recording, and performance prep",
      "youth band programs, recitals, and music camps",
    ],
  },
  {
    category: "Dance Studio",
    tone: "creative",
    suffixes: ["Dance Studio", "Dance Co.", "Dance House", "Dance Lab", "Movement Studio"],
    focuses: [
      "beginner to advanced dance classes and showcases",
      "ballet, jazz, hip-hop, and contemporary training",
      "kids' dance programs, recitals, and summer intensives",
      "adult dance fitness, partner work, and choreography",
    ],
  },
  {
    category: "Art Gallery",
    tone: "creative",
    suffixes: ["Gallery", "Art Gallery", "Studio Gallery", "Art House", "Art Co."],
    focuses: [
      "emerging artists, rotating exhibits, and workshops",
      "contemporary art, photography, and mixed-media shows",
      "local artist features, openings, and artist talks",
      "curated print sales, originals, and gallery events",
    ],
  },
  {
    category: "Podcast Studio",
    tone: "creative",
    suffixes: ["Podcast Studio", "Audio Studio", "Podcast Lab", "Audio Co.", "Sound Studio"],
    focuses: [
      "recording, editing, and podcast launch support",
      "voiceover, narration, and audiobook production",
      "video podcast filming, editing, and distribution",
      "podcast strategy, branding, and show development",
    ],
  },
  {
    category: "Plumbing Services",
    tone: "service",
    suffixes: ["Plumbing", "Plumbing Co.", "Plumbing Pros", "Plumbing Services"],
    focuses: [
      "leak repair, fixture installs, and drain services",
      "emergency plumbing, water heaters, and pipe replacement",
      "bathroom remodels, fixtures, and shower installs",
      "sewer line work, sump pumps, and rough-in plumbing",
    ],
  },
  {
    category: "Electrical Services",
    tone: "service",
    suffixes: ["Electric", "Electric Co.", "Electric Works", "Electrical Services", "Electrical Co."],
    focuses: [
      "safe wiring, lighting installs, and panel upgrades",
      "EV charger installs, smart-home wiring, and rewires",
      "commercial electrical, generators, and load assessments",
      "indoor and outdoor lighting design and installation",
    ],
  },
  {
    category: "Cleaning Services",
    tone: "service",
    suffixes: ["Cleaning Team", "Cleaning Co.", "Cleaning Services", "Cleaners", "Clean Co."],
    focuses: [
      "home, office, and deep cleaning packages",
      "move-in/move-out cleans and post-construction cleanup",
      "weekly maintenance, eco cleaning, and disinfecting",
      "Airbnb turnovers, vacation rentals, and recurring service",
    ],
  },
  {
    category: "Landscaping",
    tone: "service",
    suffixes: ["Landscape Works", "Landscaping", "Landscaping Co.", "Lawn Co.", "Garden Works"],
    focuses: [
      "residential landscaping and outdoor living upgrades",
      "lawn care, hardscaping, and seasonal maintenance",
      "garden design, irrigation, and tree services",
      "patios, retaining walls, and full backyard makeovers",
    ],
  },
  {
    category: "Auto Repair",
    tone: "service",
    suffixes: ["Auto Garage", "Auto Repair", "Auto Co.", "Garage", "Auto Works"],
    focuses: [
      "engine diagnostics, brake service, and tune-ups",
      "oil changes, tire rotations, and routine maintenance",
      "transmission repair, suspension, and full inspections",
      "European and Japanese vehicle specialists with diagnostics",
    ],
  },
  {
    category: "Hardware Store",
    tone: "service",
    suffixes: ["Hardware", "Hardware Co.", "Hardware Store", "Tool Co.", "Supply Co."],
    focuses: [
      "tools, building supplies, and home repair essentials",
      "fasteners, paint, and DIY project materials",
      "power tools, garden gear, and seasonal goods",
      "trusted local hardware with knowledgeable staff",
    ],
  },
  {
    category: "Tutoring Center",
    tone: "education",
    suffixes: ["Tutors", "Tutoring", "Tutors Hub", "Learning Co.", "Tutor Group"],
    focuses: [
      "academic tutoring, test prep, and study skills",
      "math, reading, and writing support for all grades",
      "SAT, ACT, and college application coaching",
      "small-group classes, homework help, and enrichment",
    ],
  },
  {
    category: "Language School",
    tone: "education",
    suffixes: ["Language Center", "Language School", "Language Co.", "Linguistics Co."],
    focuses: [
      "conversation-first language classes and exam prep",
      "Spanish, French, and Mandarin courses for all levels",
      "immersion programs, business language, and travel prep",
      "kids' language classes, tutors, and certification prep",
    ],
  },
  {
    category: "Online Education",
    tone: "education",
    suffixes: ["Online Academy", "Academy", "Learning Co.", "Online Co."],
    focuses: [
      "career courses, cohort learning, and certificates",
      "self-paced lessons, mentorship, and project work",
      "industry-led courses with portfolio outcomes",
      "live workshops, learning paths, and study communities",
    ],
  },
  {
    category: "Childcare Center",
    tone: "education",
    suffixes: ["Learning Care", "Childcare", "Kids Co.", "Early Learning", "Childcare Co."],
    focuses: [
      "early childhood education and safe play programs",
      "preschool curriculum, art, and outdoor exploration",
      "infant care, toddler programs, and pre-K readiness",
      "small-group childcare with structured learning days",
    ],
  },
  {
    category: "Martial Arts School",
    tone: "education",
    suffixes: ["Martial Arts", "Dojo", "Martial Arts Co.", "Fight Academy"],
    focuses: [
      "self-defense training, discipline, and fitness classes",
      "BJJ, muay thai, and striking fundamentals",
      "karate, taekwondo, and family martial arts programs",
      "youth confidence-building and adult conditioning classes",
    ],
  },
  {
    category: "Nonprofit",
    tone: "community",
    suffixes: ["Community Fund", "Community Co.", "Foundation", "Outreach", "Community Group"],
    focuses: [
      "local outreach, education grants, and volunteer drives",
      "housing support, food access, and family services",
      "youth mentorship, scholarships, and community events",
      "community resilience programs and donor partnerships",
    ],
  },
  {
    category: "Community Kitchen",
    tone: "community",
    suffixes: ["Community Kitchen", "Kitchen Co.", "Plate Co.", "Meals Co."],
    focuses: [
      "shared meals, food aid, and cooking classes",
      "community dinners, meal donations, and food rescue",
      "free weekly meals and culinary workforce training",
      "neighborhood pantry support and home-cooked meal drives",
    ],
  },
  {
    category: "Charity Thrift",
    tone: "community",
    suffixes: ["Thrift", "Thrift Co.", "Thrift Shop", "Charity Thrift", "Resale Co."],
    focuses: [
      "affordable goods that fund social impact programs",
      "secondhand clothing and home goods for local causes",
      "donation-driven retail supporting community programs",
      "vintage finds, donations, and reuse-first retail",
    ],
  },
  {
    category: "Pet Store",
    tone: "casual",
    suffixes: ["Pet Market", "Pet Co.", "Pet Store", "Pet Supply", "Pet Shop"],
    focuses: [
      "natural pet food, toys, and wellness essentials",
      "premium dog and cat food, treats, and accessories",
      "raw diets, supplements, and small-animal supplies",
      "trusted pet basics, gear, and seasonal care products",
    ],
  },
  {
    category: "Florist",
    tone: "creative",
    suffixes: ["Florals", "Flowers", "Floral Co.", "Flower Studio", "Bloom Co."],
    focuses: [
      "handcrafted bouquets and event flower styling",
      "wedding florals, installations, and ceremony pieces",
      "weekly bouquet subscriptions and seasonal arrangements",
      "sympathy flowers, corporate gifting, and same-day delivery",
    ],
  },
];

const POST_VOICES_BY_TONE = {
  casual: [
    "warm, conversational, and community-first",
    "playful, inviting, and trend-aware",
    "friendly, casual, and locally rooted",
    "fun, approachable, and consistent",
  ],
  professional: [
    "confident, clear, and authoritative",
    "concise, expert-led, and trustworthy",
    "professional, structured, and informative",
    "polished, calm, and credibility-driven",
  ],
  wellness: [
    "calm, encouraging, and mindful",
    "supportive, gentle, and motivating",
    "warm, holistic, and grounded",
    "uplifting, balanced, and informed",
  ],
  creative: [
    "bold, expressive, and visual-first",
    "thoughtful, story-driven, and artistic",
    "inspired, original, and imaginative",
    "polished, atmospheric, and image-led",
  ],
  service: [
    "practical, dependable, and direct",
    "clear, helpful, and responsive",
    "honest, expert, and homeowner-friendly",
    "no-nonsense, knowledgeable, and approachable",
  ],
  education: [
    "encouraging, clear, and student-first",
    "patient, structured, and informative",
    "warm, motivating, and learner-friendly",
    "supportive, expert, and confidence-building",
  ],
  community: [
    "heartfelt, mission-led, and local",
    "compassionate, transparent, and inclusive",
    "warm, hopeful, and impact-driven",
    "humble, genuine, and community-rooted",
  ],
};

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function toSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 16);
}

function fillTemplate(template, variables) {
  return template.replace(/\{(\w+)\}/g, (_, key) => variables[key] || "");
}

function generatePageId(pageName) {
  const root = toSlug(pageName) || "page";
  const suffix = Math.floor(100000 + Math.random() * 900000);
  return `${root}${suffix}`;
}

function generateCounts() {
  const followerCount = "0";
  const likeCount = "0";
  const engagementScore = String(Math.floor(20 + Math.random() * 70));
  return { followerCount, likeCount, engagementScore };
}

function generatePageName(categoryEntry, country) {
  const prefix = randomItem(country.pages.namePrefixes);
  const noun = randomItem(country.pages.nameNouns);
  const suffix = randomItem(categoryEntry.suffixes);
  return `${prefix} ${noun} ${suffix}`;
}

function generatePageBio({ pageName, category, focus, tone, country }) {
  const templatesByTone = country.pages.bioTemplatesByTone;
  const templates = templatesByTone[tone] || templatesByTone.casual;
  const template = randomItem(templates);
  return fillTemplate(template, { pageName, category, focus });
}

function generatePagePersonalityPrompt({ pageName, category, focus, bio, tone }) {
  const voices = POST_VOICES_BY_TONE[tone] || POST_VOICES_BY_TONE.casual;
  const voice = randomItem(voices);
  return [
    `You are the brand AI for "${pageName}", a ${category}.`,
    `Business focus: ${focus}.`,
    `Bio context: ${bio}`,
    "",
    "Post creation personality:",
    `Create platform-ready posts in a ${voice} tone. Mix educational, promotional, and community posts. Keep captions clear, believable, and aligned with ${category} audiences.`,
    "",
    "Profile picture prompt:",
    `Design a clean, memorable profile image for "${pageName}" that represents ${focus}. Use bold composition, high contrast, and strong readability at small sizes. No text-heavy layout.`,
    "",
    "Cover picture prompt:",
    `Create a wide cover image for "${pageName}" featuring ${focus}. Include brand atmosphere, lifestyle context, and space for optional headline overlay. Use polished, realistic lighting and commercial quality framing.`,
  ].join("\n");
}

export function generatePageInformation(options = {}) {
  const { country: countryCode = DEFAULT_COUNTRY } = options;
  const country = getCountry(countryCode);

  const categoryEntry = randomItem(CATEGORIES);
  const pageName = generatePageName(categoryEntry, country);
  const focus = randomItem(categoryEntry.focuses);
  const bio = generatePageBio({
    pageName,
    category: categoryEntry.category,
    focus,
    tone: categoryEntry.tone,
    country,
  });
  const generationPrompt = generatePagePersonalityPrompt({
    pageName,
    category: categoryEntry.category,
    focus,
    bio,
    tone: categoryEntry.tone,
  });
  const counts = generateCounts();

  return {
    pageName,
    category: categoryEntry.category,
    country: country.code,
    pageId: generatePageId(pageName),
    bio,
    generationPrompt,
    ...counts,
  };
}

export { CATEGORIES };
