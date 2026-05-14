// Italian-flavored page-name word pools and bio templates.
export const NAME_PREFIXES = [
  "Bella", "Antica", "Nuova", "Bottega", "Caffè", "Casa", "Villa", "Piccola",
  "Buona", "Fresca", "Dolce", "Forno", "Trattoria", "Osteria", "Locanda", "Cucina",
  "Officina", "Studio", "Atelier", "Mercato", "Borgo", "Vecchia", "Verde", "Oro",
  "Argento", "Sole", "Stella", "Luna", "Mare", "Monte",
  "Vigna", "Frutteto", "Giardino", "Piazza", "Corte", "Palazzo", "Loggia", "Riva",
  "Sapore", "Aroma", "Profumo", "Sentiero", "Quattro", "Sette", "Tre", "Una",
  "Sapori", "Cose", "Bel", "Buon",
];

export const NAME_NOUNS = [
  "Bottega", "Forno", "Cucina", "Caffè", "Bar", "Trattoria", "Osteria", "Locanda",
  "Pizzeria", "Pasticceria", "Gelateria", "Enoteca", "Studio", "Atelier",
  "Officina", "Laboratorio", "Sapore", "Aroma", "Sentiero", "Piazza",
  "Borgo", "Casale", "Cascina", "Tenuta", "Villa", "Corte",
  "Piazzetta", "Vicolo", "Vigna", "Vigneto", "Frutteto", "Orto",
  "Giardino", "Casetta", "Palazzo", "Pasticceria", "Macelleria", "Salumeria",
  "Panetteria", "Drogheria", "Bottega", "Tavola", "Cantina", "Botte",
  "Centro", "Punto", "Spazio", "Quartiere", "Stanza", "Piazzale",
  "Vista", "Riva",
];

export const BIO_TEMPLATES_BY_TONE = {
  casual: [
    "{pageName} è un {category} di quartiere dedicato a {focus}. Passa a trovarci e seguici per le novità di ogni giorno.",
    "Benvenuti da {pageName} — un {category} appassionato di {focus}. Persone vere, sapori veri e una comunità che torna sempre.",
    "Da {pageName} ci dedichiamo a {focus}. Siamo un {category} fatto di buone idee, qualità e passaparola.",
    "{pageName} è quel {category} di cui parli agli amici. Tutto ruota intorno a {focus} e ai dettagli che fanno la differenza.",
  ],
  professional: [
    "{pageName} è un {category} affidabile, specializzato in {focus}. Condividiamo consigli pratici, casi reali e risposte chiare.",
    "Benvenuti da {pageName}. Come {category}, aiutiamo i nostri clienti con {focus} in modo chiaro, etico e puntuale.",
    "Da {pageName} offriamo {focus} con esperienza e competenza. Sulla pagina trovi aggiornamenti, consigli e informazioni utili.",
    "{pageName} è il tuo {category} per {focus}. Seguici per approfondimenti, guide e risposte alle domande più frequenti.",
  ],
  wellness: [
    "{pageName} è un {category} dedicato a {focus}. Condividiamo routine, recuperi e piccoli gesti quotidiani che fanno la differenza.",
    "Benvenuti da {pageName}. Come {category}, crediamo in {focus} — e vogliamo accompagnarti nel tuo percorso di benessere.",
    "Da {pageName} il nostro lavoro nasce da {focus}. Questa pagina condivide consigli, storie dei clienti e piccoli promemoria.",
    "{pageName} è un {category} sereno e accogliente, focalizzato su {focus}. Seguici per ispirazione, motivazione e dietro le quinte.",
  ],
  creative: [
    "{pageName} è un {category} costruito intorno a {focus}. Condividiamo lavori in corso, opere finite e le storie dietro ognuna.",
    "Benvenuti da {pageName} — un {category} dove {focus} prende vita. Aspettati processo creativo, clienti e ispirazione.",
    "Da {pageName} viviamo per {focus}. Come {category}, trattiamo ogni progetto come una storia che vale la pena raccontare.",
    "{pageName} è un {category} con una visione precisa di {focus}. Seguici per portfolio, dietro le quinte e note creative.",
  ],
  service: [
    "{pageName} è un {category} affidabile che si occupa di {focus}. Puntualità, lavoro fatto bene e comunicazione chiara.",
    "Benvenuti da {pageName}. Come {category}, siamo specializzati in {focus} — per privati, aziende e chi cerca qualità.",
    "Da {pageName} ci occupiamo di {focus} senza stress. Sulla pagina trovi consigli di manutenzione, prima/dopo e aggiornamenti.",
    "{pageName} è il {category} che chiami quando {focus} va fatto bene al primo colpo. Locale, qualificato e sempre disponibile.",
  ],
  education: [
    "{pageName} è un {category} focalizzato su {focus}. Condividiamo consigli di studio, traguardi degli studenti e risorse utili.",
    "Benvenuti da {pageName} — un {category} dove {focus} si realizza con pazienza, metodo e curiosità.",
    "Da {pageName} crediamo che il vero apprendimento nasca da {focus}. La pagina racconta progressi e suggerimenti di studio.",
    "{pageName} è un {category} di supporto, costruito intorno a {focus}. Seguici per novità, consigli e storie degli studenti.",
  ],
  community: [
    "{pageName} è un {category} impegnato in {focus}. Ogni condivisione e contributo aiuta la nostra missione a crescere.",
    "Benvenuti da {pageName}. Come {category}, esistiamo per {focus} — e questa pagina ci tiene vicini al nostro quartiere.",
    "Da {pageName} il nostro lavoro è dedicato a {focus}. Sulla pagina trovi inviti al volontariato, aggiornamenti e storie locali.",
    "{pageName} è un {category} guidato dalla comunità, dedicato a {focus}. Seguici per scoprire come dare una mano e restare connessi.",
  ],
};
