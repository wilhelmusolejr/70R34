// Industry pools — companies recognizable on Facebook, realistic job titles
export const INDUSTRIES = {
  retail: {
    companies: [
      "Walmart", "Target", "The Home Depot", "Costco Wholesale", "Kroger",
      "Walgreens", "CVS Health", "Dollar General", "Macy's", "TJ Maxx",
    ],
    titles: [
      "Sales Associate", "Cashier", "Department Manager", "Assistant Store Manager",
      "Inventory Specialist", "Customer Service Representative", "Shift Supervisor",
      "Loss Prevention Officer", "Visual Merchandiser", "Store Manager",
    ],
  },
  food_service: {
    companies: [
      "McDonald's", "Starbucks", "Subway", "Chick-fil-A", "Domino's Pizza",
      "Dunkin'", "Olive Garden", "Applebee's", "IHOP", "Buffalo Wild Wings",
    ],
    titles: [
      "Barista", "Crew Member", "Shift Leader", "Assistant Manager", "General Manager",
      "Line Cook", "Server", "Restaurant Manager", "Food Service Supervisor", "Baker",
    ],
  },
  healthcare: {
    companies: [
      "HCA Healthcare", "Kaiser Permanente", "CVS Health", "Walgreens Boots Alliance",
      "Kindred Healthcare", "DaVita", "Humana", "Cigna", "Aetna", "UnitedHealth Group",
    ],
    titles: [
      "Registered Nurse", "Medical Assistant", "Patient Care Technician", "Home Health Aide",
      "Pharmacy Technician", "Clinical Coordinator", "Healthcare Administrator",
      "Medical Receptionist", "Billing Specialist", "Certified Nursing Assistant",
    ],
  },
  technology: {
    companies: [
      "Apple", "Amazon", "Google", "Meta", "Microsoft",
      "Salesforce", "IBM", "Oracle", "HP Inc.", "Dell Technologies",
    ],
    titles: [
      "Software Engineer", "IT Support Specialist", "Systems Administrator",
      "Data Analyst", "Product Manager", "UX Designer", "Technical Support Engineer",
      "DevOps Engineer", "Cybersecurity Analyst", "Business Analyst",
    ],
  },
  finance: {
    companies: [
      "JPMorgan Chase", "Bank of America", "Wells Fargo", "Citibank",
      "Capital One", "American Express", "Charles Schwab", "Fidelity Investments",
      "Northwestern Mutual", "State Farm",
    ],
    titles: [
      "Bank Teller", "Financial Advisor", "Loan Officer", "Branch Manager",
      "Accountant", "Auditor", "Insurance Agent", "Investment Analyst",
      "Customer Service Representative", "Mortgage Specialist",
    ],
  },
  logistics: {
    companies: [
      "UPS", "FedEx", "Amazon Logistics", "DHL", "XPO Logistics",
      "J.B. Hunt Transport", "Werner Enterprises", "Old Dominion Freight Line",
      "USPS", "Ryder System",
    ],
    titles: [
      "Delivery Driver", "Warehouse Associate", "Forklift Operator", "Logistics Coordinator",
      "Supply Chain Analyst", "Distribution Center Manager", "Fleet Manager",
      "Package Handler", "Shipping Coordinator", "Operations Supervisor",
    ],
  },
  education: {
    companies: [
      "Teach For America", "Sylvan Learning", "Kumon", "Mathnasium",
      "DeVry University", "Strayer University", "Kaplan", "Princeton Review",
      "Learning Care Group", "Bright Horizons",
    ],
    titles: [
      "Elementary School Teacher", "High School Teacher", "Substitute Teacher",
      "Teaching Assistant", "Instructional Designer", "Academic Advisor",
      "Tutor", "Curriculum Developer", "School Counselor", "After-School Program Director",
    ],
  },
  real_estate: {
    companies: [
      "RE/MAX", "Keller Williams Realty", "Century 21", "Coldwell Banker",
      "Berkshire Hathaway HomeServices", "Redfin", "Zillow", "Marcus & Millichap",
      "CBRE Group", "JLL",
    ],
    titles: [
      "Real Estate Agent", "Property Manager", "Leasing Consultant", "Real Estate Broker",
      "Mortgage Loan Officer", "Home Inspector", "Real Estate Appraiser",
      "Transaction Coordinator", "Commercial Property Manager", "Relocation Specialist",
    ],
  },
  hospitality: {
    companies: [
      "Marriott International", "Hilton Hotels", "Hyatt Hotels", "IHG Hotels & Resorts",
      "Wyndham Hotels & Resorts", "Best Western", "Airbnb", "Disney Parks",
      "Carnival Cruise Line", "Norwegian Cruise Line",
    ],
    titles: [
      "Front Desk Agent", "Hotel Manager", "Concierge", "Housekeeping Supervisor",
      "Events Coordinator", "Food and Beverage Manager", "Guest Services Representative",
      "Banquet Manager", "Resort Activities Director", "Revenue Manager",
    ],
  },
  construction: {
    companies: [
      "Bechtel", "Turner Construction", "Skanska USA", "Fluor Corporation",
      "Kiewit Corporation", "Clark Construction", "Suffolk Construction",
      "Hensel Phelps", "McCarthy Building Companies", "AECOM",
    ],
    titles: [
      "Construction Worker", "Project Manager", "Site Supervisor", "Carpenter",
      "Electrician", "Plumber", "HVAC Technician", "Safety Officer",
      "Estimator", "Construction Manager",
    ],
  },
};

export const INDUSTRY_KEYS = Object.keys(INDUSTRIES);
