// 5 archetypes — each has coherent pools for hobbies, music, tvShows, movies, games, sportsTeams
export const ARCHETYPES = {
  outdoor: {
    hobbies: ["Hiking", "Camping", "Fishing", "Rock Climbing", "Mountain Biking", "Trail Running", "Kayaking", "Hunting", "Bird Watching", "Gardening"],
    music: ["Country", "Folk", "Bluegrass", "Classic Rock", "Americana", "Southern Rock", "Indie Folk"],
    tvShows: ["Yellowstone", "Alone", "Survivor", "The Walking Dead", "Ozark", "Manifest", "Justified", "Deadliest Catch", "Mountain Men"],
    movies: ["Into the Wild", "127 Hours", "Wild", "The Revenant", "A Walk in the Woods", "Everest", "Hunt for the Wilderpeople"],
    games: ["Red Dead Redemption 2", "The Legend of Zelda: Breath of the Wild", "Minecraft", "Stardew Valley", "The Forest", "Firewatch"],
    sportsTeams: ["Green Bay Packers", "Denver Broncos", "Seattle Seahawks", "Colorado Rockies", "Portland Trail Blazers", "Utah Jazz"],
  },
  creative: {
    hobbies: ["Photography", "Painting", "Drawing", "Writing", "Blogging", "Crafting", "Interior Design", "Fashion Styling", "Cooking", "Pottery"],
    music: ["Indie Pop", "Alternative", "R&B", "Soul", "Jazz", "Neo-Soul", "Lo-fi Hip Hop", "Indie Rock"],
    tvShows: ["Emily in Paris", "The Crown", "Schitt's Creek", "Bridgerton", "Selling Sunset", "The Great British Bake Off", "Project Runway", "Queer Eye"],
    movies: ["La La Land", "The Grand Budapest Hotel", "Amélie", "Midnight in Paris", "Julie & Julia", "The Devil Wears Prada", "Chef"],
    games: ["The Sims 4", "Animal Crossing: New Horizons", "Stardew Valley", "Unpacking", "Spiritfarer", "Journey"],
    sportsTeams: ["LA Lakers", "Miami Heat", "New York Knicks", "Golden State Warriors", "Chicago Bulls"],
  },
  technical: {
    hobbies: ["Gaming", "Coding", "3D Printing", "Electronics", "Building PCs", "Amateur Radio", "Chess", "Astronomy", "Investing", "Robotics"],
    music: ["Electronic", "EDM", "Techno", "Hip Hop", "Progressive Rock", "Synthwave", "Drum and Bass", "Metal"],
    tvShows: ["Mr. Robot", "Silicon Valley", "The IT Crowd", "Westworld", "Black Mirror", "Halt and Catch Fire", "Devs", "Severance"],
    movies: ["The Social Network", "Interstellar", "The Matrix", "Ex Machina", "Inception", "Blade Runner 2049", "Her", "2001: A Space Odyssey"],
    games: ["Civilization VI", "StarCraft II", "Elden Ring", "Half-Life: Alyx", "Factorio", "Portal 2", "Kerbal Space Program", "Dwarf Fortress"],
    sportsTeams: ["Golden State Warriors", "San Francisco 49ers", "San Jose Sharks", "Sacramento Kings", "Seattle Seahawks"],
  },
  social: {
    hobbies: ["Traveling", "Going Out", "Cooking", "Wine Tasting", "Dancing", "Volunteering", "Event Planning", "Yoga", "Reading", "Brunch"],
    music: ["Pop", "Hip Hop", "Dance", "R&B", "Latin", "Reggaeton", "Top 40", "Disco Classics"],
    tvShows: ["The Bachelor", "Love Island", "Real Housewives", "Grey's Anatomy", "Stranger Things", "Friends", "The Office", "Abbott Elementary"],
    movies: ["Crazy Rich Asians", "The Notebook", "Girls Trip", "Bridesmaids", "Mamma Mia!", "Pretty Woman", "How to Lose a Guy in 10 Days"],
    games: ["Jackbox Party Pack", "Mario Kart 8", "Among Us", "Just Dance", "Trivia Crack", "Words with Friends"],
    sportsTeams: ["New York Yankees", "LA Dodgers", "New England Patriots", "Dallas Cowboys", "Chicago Cubs", "Miami Dolphins"],
  },
  athletic: {
    hobbies: ["Working Out", "Running", "CrossFit", "Cycling", "Swimming", "Basketball", "Soccer", "Tennis", "Martial Arts", "Yoga"],
    music: ["Hip Hop", "Rap", "Pop", "EDM", "Motivational Podcasts", "Classic Hip Hop", "Trap", "Workout Playlists"],
    tvShows: ["Hard Knocks", "Last Chance U", "The Last Dance", "Formula 1: Drive to Survive", "Ted Lasso", "All American", "Ballers"],
    movies: ["Rocky", "Space Jam", "Creed", "Remember the Titans", "Coach Carter", "The Blind Side", "Moneyball", "I, Tonya"],
    games: ["FIFA 24", "NBA 2K24", "Madden NFL 24", "EA Sports FC", "WWE 2K", "Tony Hawk's Pro Skater 1+2"],
    sportsTeams: ["Kansas City Chiefs", "Los Angeles Rams", "Golden State Warriors", "Boston Celtics", "New York Mets", "Chicago Bears"],
  },
};

export const ARCHETYPE_KEYS = Object.keys(ARCHETYPES);

// Other names (aliases) — 1 syllable style
export const ALIAS_NAMES = [
  "Bree", "Kay", "Mae", "Joy", "Jen", "Beth", "Sue", "Kate", "Ann", "Lee",
  "Rae", "Drew", "Cole", "Dean", "Blake", "Chase", "Brent", "Craig", "Neil", "Todd",
  "Brooke", "Jade", "Quinn", "Paige", "Sage", "Lane", "Cait", "Skye", "Dawn", "Rain",
  "Jace", "Rhys", "Knox", "Colt", "Blaine", "Shawn", "Heath", "Troy", "Cliff", "Ross",
  "Mel", "Val", "Bette", "Dot", "Fay", "Grace", "Kat", "Lu", "Nan", "Pearl",
  "Ace", "Dash", "Finn", "Grant", "Hank", "Jack", "Kent", "Lloyd", "Mitch", "Nash",
];

// Languages pool
export const LANGUAGES = [
  "English", "Spanish", "French", "Portuguese", "Italian", "German",
  "Mandarin", "Japanese", "Korean", "Arabic", "Hindi", "Tagalog",
  "Vietnamese", "Russian", "Polish", "Greek", "Dutch",
];
