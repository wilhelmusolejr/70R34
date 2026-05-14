// 5 archetypes localized to Italian culture — Italian music, TV, film,
// sports clubs, plus international games (the gaming scene reads global).
export const ARCHETYPES = {
  outdoor: {
    hobbies: [
      "Trekking", "Campeggio", "Pesca", "Arrampicata", "Mountain bike",
      "Trail running", "Canoa", "Sci", "Vela", "Giardinaggio",
    ],
    music: [
      "Cantautori italiani", "Folk italiano", "Rock italiano", "Fabrizio De André",
      "Lucio Battisti", "Ligabue", "Francesco De Gregori", "Francesco Guccini",
    ],
    tvShows: [
      "Linea Verde", "Geo", "Sereno Variabile", "Kilimangiaro",
      "Donnavventura", "Pianeta Mare", "Overland", "Alpe Adria",
    ],
    movies: [
      "Le otto montagne", "Il vento fa il suo giro", "Mediterraneo",
      "Into the Wild", "The Revenant", "L'ultimo lupo", "Everest",
    ],
    games: [
      "Red Dead Redemption 2", "Minecraft", "Stardew Valley",
      "Firewatch", "The Forest", "Breath of the Wild",
    ],
    sportsTeams: [
      "Nazionale italiana di sci", "Bergamasca Atalanta", "Hellas Verona",
      "Trentino Volley", "Squadra Italia ciclismo",
    ],
  },
  creative: {
    hobbies: [
      "Fotografia", "Pittura", "Disegno", "Scrittura",
      "Blog", "Artigianato", "Design d'interni", "Moda",
      "Cucina", "Ceramica",
    ],
    music: [
      "Calcutta", "Cesare Cremonini", "Mahmood", "Marco Mengoni",
      "Gazzelle", "Pinguini Tattici Nucleari", "Paolo Conte",
      "Jazz italiano", "Indie italiano",
    ],
    tvShows: [
      "MasterChef Italia", "Pechino Express", "X Factor Italia",
      "Italia's Got Talent", "Cortesie per gli ospiti",
      "Casa a prima vista", "Project Runway", "Atelier Fontana",
    ],
    movies: [
      "La grande bellezza", "Pane e tulipani", "Call Me by Your Name",
      "La meglio gioventù", "Hanno tutti ragione", "Mid90s",
      "Amélie", "Midnight in Paris",
    ],
    games: [
      "The Sims 4", "Animal Crossing: New Horizons", "Stardew Valley",
      "Unpacking", "Spiritfarer", "Journey",
    ],
    sportsTeams: [
      "AS Roma", "Fiorentina", "Lazio", "Bologna FC", "Torino FC",
    ],
  },
  technical: {
    hobbies: [
      "Gaming", "Programmazione", "Stampa 3D", "Elettronica",
      "Costruire PC", "Radio amatoriale", "Scacchi",
      "Astronomia", "Investimenti", "Robotica",
    ],
    music: [
      "Elettronica", "Techno", "EDM", "Synthwave",
      "Marracash", "Salmo", "Tedua", "Lazza", "Sfera Ebbasta",
    ],
    tvShows: [
      "Mr. Robot", "Silicon Valley", "Black Mirror",
      "Westworld", "Severance", "Devs",
      "Suburra", "ZeroZeroZero",
    ],
    movies: [
      "The Social Network", "Interstellar", "Matrix",
      "Ex Machina", "Inception", "Blade Runner 2049",
      "Her", "Diabolik", "Lo chiamavano Jeeg Robot",
    ],
    games: [
      "Civilization VI", "Elden Ring", "Half-Life: Alyx",
      "Portal 2", "Factorio", "Kerbal Space Program", "StarCraft II",
    ],
    sportsTeams: [
      "Scuderia Ferrari F1", "Inter", "Atalanta",
      "Pirelli Sport", "Aprilia Racing",
    ],
  },
  social: {
    hobbies: [
      "Viaggiare", "Aperitivo", "Cucinare",
      "Degustazione vini", "Ballare", "Volontariato",
      "Eventi", "Yoga", "Lettura", "Brunch",
    ],
    music: [
      "Tiziano Ferro", "Eros Ramazzotti", "Laura Pausini",
      "Negramaro", "Annalisa", "Elodie", "Giorgia",
      "Pop italiano", "Reggaeton", "Latin",
    ],
    tvShows: [
      "Grande Fratello", "Uomini e Donne", "Temptation Island",
      "C'è posta per te", "Amici di Maria De Filippi", "Il Collegio",
      "Don Matteo", "Boris", "Mare fuori", "Doc - Nelle tue mani",
    ],
    movies: [
      "Mediterraneo", "Pane e tulipani", "Smetto quando voglio",
      "Perfetti sconosciuti", "Sotto il sole della Toscana",
      "Ricomincio da tre", "Benvenuti al Sud", "Tre Metri Sopra Il Cielo",
    ],
    games: [
      "Jackbox Party Pack", "Mario Kart 8", "Among Us",
      "Just Dance", "Trivia Crack", "Parole intelligenti",
    ],
    sportsTeams: [
      "Juventus", "Milan", "Inter", "Roma", "Napoli",
      "Fiorentina", "Lazio", "Nazionale italiana di calcio",
    ],
  },
  athletic: {
    hobbies: [
      "Calcio", "Tennis", "Padel", "Palestra",
      "Ciclismo", "Corsa", "Nuoto", "Pallavolo",
      "Boxe", "Arti marziali",
    ],
    music: [
      "Marracash", "Salmo", "Capo Plaza", "Sfera Ebbasta",
      "Hip Hop italiano", "Trap italiana",
      "EDM motivazionale", "Pop energico",
    ],
    tvShows: [
      "La Domenica Sportiva", "Pressing", "Quelli che il calcio",
      "Tiki Taka", "90° minuto", "Calciomercato L'Originale",
      "Drive to Survive", "Last Chance U",
    ],
    movies: [
      "Rocky", "Creed", "Italia '90 - Notti magiche",
      "Allenati", "Moneyball", "Coach Carter",
      "L'allenatore nel pallone", "Eccezzziunale... veramente",
    ],
    games: [
      "FIFA 24", "eFootball 2024", "NBA 2K24",
      "F1 24", "EA Sports FC", "Madden NFL 24",
    ],
    sportsTeams: [
      "Juventus", "Inter", "Milan", "Napoli", "Roma",
      "Lazio", "Atalanta", "Nazionale italiana di calcio",
      "Scuderia Ferrari F1",
    ],
  },
};

export const ARCHETYPE_KEYS = Object.keys(ARCHETYPES);

// Italian-style short aliases / nicknames
export const ALIAS_NAMES = [
  "Mia", "Lia", "Ada", "Eva", "Cri", "Bea", "Vi", "Sam",
  "Niki", "Anto", "Fede", "Vale", "Susy", "Cri", "Pippa",
  "Manu", "Ele", "Roby", "Saro", "Lara",
  "Gigi", "Pippo", "Toni", "Sandro", "Beppe", "Lele",
  "Mimmo", "Dado", "Ema", "Andre", "Cri", "Marco",
  "Nino", "Vito", "Carlo", "Bruno", "Memo", "Pino",
  "Massi", "Ricky", "Tommi", "Ale", "Edo", "Nicco",
  "Tea", "Gaia", "Ila", "Cami", "Vivi", "Pia",
];

// Italian-language language names (what you'd see on an Italian-locale Facebook profile)
export const LANGUAGES = [
  "Italiano", "Inglese", "Spagnolo", "Francese", "Tedesco",
  "Portoghese", "Russo", "Olandese", "Greco", "Polacco",
  "Cinese", "Giapponese", "Arabo", "Albanese", "Rumeno",
];
