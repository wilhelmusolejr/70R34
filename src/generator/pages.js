const PAGE_BUSINESS_COMBINATIONS = [
  { pageName: "North Harbor Coffee Co.", category: "Coffee Shop", focus: "small-batch single-origin coffee and espresso flights" },
  { pageName: "Golden Crust Bakehouse", category: "Bakery", focus: "artisan sourdough, croissants, and seasonal pastries" },
  { pageName: "Saffron Street Kitchen", category: "Restaurant", focus: "modern comfort dishes with global spice blends" },
  { pageName: "Iron Pulse Fitness Lab", category: "Fitness Studio", focus: "strength training programs and performance coaching" },
  { pageName: "Quiet River Yoga House", category: "Yoga Studio", focus: "mindful vinyasa, restorative sessions, and breathwork" },
  { pageName: "Velvet Stone Wellness Spa", category: "Spa", focus: "therapeutic massage, facials, and stress recovery rituals" },
  { pageName: "Crown & Clover Salon", category: "Salon", focus: "precision cuts, color transformations, and styling" },
  { pageName: "Bright Smile Dental Group", category: "Dental Clinic", focus: "family dentistry, cosmetic care, and preventive checkups" },
  { pageName: "Paws & Polish Groomery", category: "Pet Grooming", focus: "gentle pet grooming, de-shedding, and coat care" },
  { pageName: "Tail Trail Pet Market", category: "Pet Store", focus: "natural pet food, toys, and wellness essentials" },
  { pageName: "Bloom Theory Florals", category: "Florist", focus: "handcrafted bouquets and event flower styling" },
  { pageName: "Greenline Landscape Works", category: "Landscaping", focus: "residential landscaping and outdoor living upgrades" },
  { pageName: "Summit Key Realty", category: "Real Estate", focus: "home buying guidance and neighborhood market insights" },
  { pageName: "Form & Hearth Interiors", category: "Interior Design", focus: "warm modern interiors and functional room planning" },
  { pageName: "Wander Crest Travel Co.", category: "Travel Agency", focus: "curated itineraries and premium group tours" },
  { pageName: "Silver Oak Portrait Studio", category: "Photography Studio", focus: "family portraits, branding shoots, and event coverage" },
  { pageName: "Ever After Event Atelier", category: "Event Planning", focus: "corporate events, private parties, and milestone planning" },
  { pageName: "Ivory Lane Weddings", category: "Wedding Services", focus: "wedding coordination, styling, and vendor management" },
  { pageName: "Thread & Tide Boutique", category: "Fashion Boutique", focus: "small-run apparel and trend-led capsule collections" },
  { pageName: "Aurora Vault Jewelers", category: "Jewelry Store", focus: "fine jewelry, custom rings, and repair services" },
  { pageName: "Lantern Leaf Books", category: "Bookstore", focus: "curated fiction, non-fiction, and local author spotlights" },
  { pageName: "Rocket Pine Toy House", category: "Toy Store", focus: "educational toys, puzzles, and creative play kits" },
  { pageName: "Arcade Forge Lounge", category: "Gaming Lounge", focus: "console tournaments, retro nights, and esports events" },
  { pageName: "Circuit Care Repair", category: "Tech Repair", focus: "phone, laptop, and tablet diagnostics and repairs" },
  { pageName: "Cloudbridge IT Solutions", category: "IT Services", focus: "managed IT support, networking, and device security" },
  { pageName: "Magnet Mile Digital", category: "Digital Marketing", focus: "social media campaigns, ads, and content strategy" },
  { pageName: "Ledger Lane Accounting", category: "Accounting Services", focus: "bookkeeping, payroll, and tax preparation services" },
  { pageName: "Northfield Legal Partners", category: "Law Firm", focus: "business law, contracts, and civil representation" },
  { pageName: "Shieldpoint Insurance", category: "Insurance Agency", focus: "personal and business coverage planning" },
  { pageName: "Torque Town Auto Garage", category: "Auto Repair", focus: "engine diagnostics, brake service, and tune-ups" },
  { pageName: "Crystal Jet Car Spa", category: "Car Wash", focus: "detailing packages, ceramic coating, and interior cleaning" },
  { pageName: "Summit Drive Motors", category: "Car Dealership", focus: "pre-owned vehicles and financing guidance" },
  { pageName: "Pedal Peak Cycles", category: "Bicycle Shop", focus: "bike sales, fitting, and maintenance services" },
  { pageName: "Anchor Bolt Hardware", category: "Hardware Store", focus: "tools, building supplies, and home repair essentials" },
  { pageName: "Homefront Upgrade Co.", category: "Home Improvement", focus: "renovation planning and residential upgrades" },
  { pageName: "Clearflow Plumbing Pros", category: "Plumbing Services", focus: "leak repair, fixture installs, and drain services" },
  { pageName: "Brightline Electric Works", category: "Electrical Services", focus: "safe wiring, lighting installs, and panel upgrades" },
  { pageName: "FreshNest Cleaning Team", category: "Cleaning Services", focus: "home, office, and deep cleaning packages" },
  { pageName: "Spin & Fold Laundry Hub", category: "Laundry Service", focus: "wash-and-fold, dry cleaning, and pickup service" },
  { pageName: "Plated Story Catering", category: "Catering", focus: "custom menus for private events and corporate functions" },
  { pageName: "Street Flame Eats", category: "Food Truck", focus: "chef-driven street food and rotating weekly specials" },
  { pageName: "Cloud Cone Creamery", category: "Ice Cream Shop", focus: "small-batch ice cream and handcrafted toppings" },
  { pageName: "Pressed Planet Juice Bar", category: "Juice Bar", focus: "cold-pressed juices, smoothies, and wellness shots" },
  { pageName: "Rooted Basket Organics", category: "Organic Grocery", focus: "organic produce, pantry staples, and local goods" },
  { pageName: "Harvest Square Market", category: "Farmers Market", focus: "seasonal local produce and artisan foods" },
  { pageName: "Blue Dock Seafood Market", category: "Seafood Market", focus: "fresh fish, shellfish, and chef-ready cuts" },
  { pageName: "Prime Cut Butcher Co.", category: "Butcher Shop", focus: "premium meats, custom cuts, and meal prep packs" },
  { pageName: "Leaf & Lentil Cafe", category: "Vegan Cafe", focus: "plant-based comfort meals and dairy-free desserts" },
  { pageName: "Copper Kettle Brewery", category: "Craft Brewery", focus: "small-batch ales, tastings, and brewery tours" },
  { pageName: "Valley Crest Cellars", category: "Winery", focus: "estate wines, pairings, and tasting room experiences" },
  { pageName: "Chordline Music Academy", category: "Music School", focus: "instrument lessons, music theory, and ensemble coaching" },
  { pageName: "Rhythm Nest Dance Studio", category: "Dance Studio", focus: "beginner to advanced dance classes and showcases" },
  { pageName: "Canvas Alley Gallery", category: "Art Gallery", focus: "emerging artists, rotating exhibits, and workshops" },
  { pageName: "Makers Meadow Crafts", category: "Craft Store", focus: "DIY supplies, kits, and maker community events" },
  { pageName: "Inkline Print Works", category: "Printing Shop", focus: "business cards, signage, and branded print materials" },
  { pageName: "DeskDock Co-Work Club", category: "Co-working Space", focus: "flex desks, private rooms, and founder networking" },
  { pageName: "Launch Harbor Labs", category: "Startup Incubator", focus: "startup mentorship, investor readiness, and growth support" },
  { pageName: "SkillSpring Online Academy", category: "Online Education", focus: "career courses, cohort learning, and certificates" },
  { pageName: "Bridgeword Language Center", category: "Language School", focus: "conversation-first language classes and exam prep" },
  { pageName: "Northstar Tutors Hub", category: "Tutoring Center", focus: "academic tutoring, test prep, and study skills" },
  { pageName: "Little Oaks Learning Care", category: "Childcare Center", focus: "early childhood education and safe play programs" },
  { pageName: "Golden Years Home Care", category: "Senior Care", focus: "companion care and daily support for older adults" },
  { pageName: "Citywell Medical Clinic", category: "Medical Clinic", focus: "primary care, diagnostics, and preventive health services" },
  { pageName: "Healthway Community Pharmacy", category: "Pharmacy", focus: "prescriptions, wellness products, and health consultations" },
  { pageName: "Clearview Optical Studio", category: "Optical Shop", focus: "eye exams, lenses, and designer eyewear fittings" },
  { pageName: "Align Peak Chiropractic", category: "Chiropractic Clinic", focus: "spine care, posture treatment, and pain relief plans" },
  { pageName: "ProEdge Sports Academy", category: "Sports Academy", focus: "athletic training, camps, and skill development programs" },
  { pageName: "Tiger Path Martial Arts", category: "Martial Arts School", focus: "self-defense training, discipline, and fitness classes" },
  { pageName: "Blue Wave Swim School", category: "Swimming School", focus: "swim lessons, water safety, and stroke technique" },
  { pageName: "Trailgrid Outdoor Supply", category: "Outdoor Gear", focus: "hiking gear, apparel, and adventure essentials" },
  { pageName: "Pine Ridge Camp Store", category: "Camping Store", focus: "tents, camp cookware, and survival gear" },
  { pageName: "Reel Current Tackle", category: "Fishing Supply", focus: "rods, bait, tackle, and fishing accessories" },
  { pageName: "Sprout Yard Garden Center", category: "Garden Center", focus: "garden tools, soil blends, and seasonal plants" },
  { pageName: "Willow Patch Nursery", category: "Plant Nursery", focus: "indoor plants, trees, and landscaping greens" },
  { pageName: "Hearthline Furniture Co.", category: "Furniture Store", focus: "living room, bedroom, and custom furniture pieces" },
  { pageName: "Dreamrest Mattress Gallery", category: "Mattress Store", focus: "sleep solutions, mattress trials, and bedding essentials" },
  { pageName: "Nova Home Appliances", category: "Appliance Store", focus: "kitchen and home appliance sales and setup" },
  { pageName: "PocketHub Mobile Gear", category: "Mobile Accessories", focus: "cases, chargers, and mobile device add-ons" },
  { pageName: "Cartwave Home Finds", category: "E-commerce Brand", focus: "online-first home and lifestyle product drops" },
  { pageName: "Voiceframe Podcast Studio", category: "Podcast Studio", focus: "recording, editing, and podcast launch support" },
  { pageName: "FrameForge Video House", category: "Video Production", focus: "brand videos, commercials, and event film coverage" },
  { pageName: "Motion Mint Animation", category: "Animation Studio", focus: "2D/3D animation and explainer video production" },
  { pageName: "Arcline Architecture", category: "Architecture Firm", focus: "residential and commercial architectural design" },
  { pageName: "Vectorpoint Engineering", category: "Engineering Consultancy", focus: "structural planning and technical project support" },
  { pageName: "SunGrid Energy Co.", category: "Solar Energy", focus: "solar installations, audits, and energy savings plans" },
  { pageName: "CycleLoop Recycling Hub", category: "Recycling Center", focus: "community recycling collection and waste education" },
  { pageName: "OpenHands Community Fund", category: "Nonprofit", focus: "local outreach, education grants, and volunteer drives" },
  { pageName: "Second Chance Thrift", category: "Charity Thrift", focus: "affordable goods that fund social impact programs" },
  { pageName: "Neighbor Plate Kitchen", category: "Community Kitchen", focus: "shared meals, food aid, and cooking classes" },
  { pageName: "Guardian Gate Security", category: "Security Services", focus: "event, home, and business security coverage" },
  { pageName: "SwiftRoute Courier", category: "Courier Service", focus: "same-day package delivery and secure handling" },
  { pageName: "Loadlink Logistics Group", category: "Logistics", focus: "fulfillment, freight coordination, and supply planning" },
  { pageName: "HarborBridge Trade Co.", category: "Import Export", focus: "product sourcing and global distribution partnerships" },
  { pageName: "Handmade Haven Studio", category: "Handmade Crafts", focus: "artisan-made decor, gifts, and craft collections" },
  { pageName: "Glowwick Candle Atelier", category: "Candle Shop", focus: "hand-poured candles and custom scent blends" },
  { pageName: "BareBloom Skin Lab", category: "Skincare Brand", focus: "gentle skincare routines and ingredient education" },
  { pageName: "Scent Story Parfums", category: "Perfume Brand", focus: "signature fragrances and scent layering guides" },
  { pageName: "VitalPeak Nutrition Co.", category: "Supplement Store", focus: "performance supplements and wellness stacks" },
  { pageName: "Momentum Health Coaching", category: "Health Coach", focus: "habit coaching, accountability, and wellness planning" },
  { pageName: "Balanced Plate Nutrition", category: "Nutritionist", focus: "personalized nutrition plans and meal strategies" },
];

const BIO_TEMPLATES = [
  "{pageName} is a {category} focused on {focus}. We share daily tips, behind-the-scenes moments, and real customer stories.",
  "Welcome to {pageName}. As a {category}, we help people with {focus}. Follow for practical ideas, updates, and inspiration.",
  "At {pageName}, our mission is simple: deliver {focus}. This {category} page posts useful advice, highlights, and community features.",
  "{pageName} is your go-to {category} for {focus}. Expect helpful content, fresh updates, and a consistent brand voice.",
  "Built around {focus}, {pageName} is a growing {category} sharing trusted recommendations, expert insights, and everyday value.",
];

const POST_VOICES = [
  "confident, educational, and community-first",
  "friendly, practical, and trend-aware",
  "expert-led, concise, and action-focused",
  "warm, optimistic, and story-driven",
  "bold, modern, and insight-rich",
];

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

function generatePageBio({ pageName, category, focus }) {
  const template = randomItem(BIO_TEMPLATES);
  return fillTemplate(template, { pageName, category, focus });
}

function generatePagePersonalityPrompt({ pageName, category, focus, bio }) {
  const voice = randomItem(POST_VOICES);
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

export function generatePageInformation() {
  const selected = randomItem(PAGE_BUSINESS_COMBINATIONS);
  const bio = generatePageBio(selected);
  const generationPrompt = generatePagePersonalityPrompt({
    ...selected,
    bio,
  });
  const counts = generateCounts();

  return {
    pageName: selected.pageName,
    category: selected.category,
    pageId: generatePageId(selected.pageName),
    bio,
    generationPrompt,
    ...counts,
  };
}

export { PAGE_BUSINESS_COMBINATIONS };
