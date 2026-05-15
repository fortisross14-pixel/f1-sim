// Country & name database for drivers and directors.
// Countries are weighted toward F1's prominent nations historically and currently.
// Each country has its own first-name and surname pool, so drivers' names feel
// believable for their nationality (e.g., a German driver named Klaus Schmidt, not Klaus Rossi).

export interface CountryEntry {
  code: string;        // ISO 3166-1 alpha-2
  name: string;        // display name
  flag: string;        // emoji
  weight: number;      // relative roll weight in the universe; sums need not be 100
  firstNames: string[];
  surnames: string[];
}

// Helper: build flag emoji from country code.
// (Defined inline literal flags below to ensure correctness.)

export const COUNTRIES: CountryEntry[] = [
  // ===== Top-tier F1 nations =====
  {
    code: 'GB', name: 'United Kingdom', flag: '🇬🇧', weight: 14,
    firstNames: ['James', 'Oliver', 'Harry', 'George', 'Jack', 'Thomas', 'Charlie', 'William', 'Alfie', 'Henry', 'Lewis', 'Daniel', 'Edward', 'Jamie', 'Callum', 'Liam', 'Finlay', 'Archie'],
    surnames: ['Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Davies', 'Evans', 'Thomas', 'Roberts', 'Hughes', 'Walker', 'Wright', 'Clarke', 'Hamilton', 'Russell', 'Norris', 'Hall', 'Foster'],
  },
  {
    code: 'IT', name: 'Italy', flag: '🇮🇹', weight: 9,
    firstNames: ['Marco', 'Luca', 'Andrea', 'Matteo', 'Giovanni', 'Francesco', 'Lorenzo', 'Alessandro', 'Davide', 'Pietro', 'Stefano', 'Riccardo', 'Antonio', 'Federico', 'Giacomo', 'Tommaso'],
    surnames: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Conti', 'Costa', 'Bruno', 'Galli', 'Lombardi', 'Moretti'],
  },
  {
    code: 'DE', name: 'Germany', flag: '🇩🇪', weight: 10,
    firstNames: ['Klaus', 'Stefan', 'Michael', 'Hans', 'Lukas', 'Maximilian', 'Sebastian', 'Felix', 'Jonas', 'Niclas', 'Florian', 'Andreas', 'Tobias', 'Manuel', 'Mick', 'Pascal'],
    surnames: ['Schmidt', 'Müller', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Hoffmann', 'Schulz', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Schwarz'],
  },
  {
    code: 'FR', name: 'France', flag: '🇫🇷', weight: 8,
    firstNames: ['Pierre', 'Jean', 'Lucas', 'Hugo', 'Louis', 'Antoine', 'Romain', 'Esteban', 'Mathieu', 'Théo', 'Julien', 'Maxime', 'Nicolas', 'Sébastien', 'Florent', 'Bastien'],
    surnames: ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Laurent', 'Roux', 'Gasly', 'Ocon', 'Prost', 'Vergne', 'Grosjean'],
  },
  {
    code: 'ES', name: 'Spain', flag: '🇪🇸', weight: 7,
    firstNames: ['Carlos', 'Fernando', 'Pablo', 'Javier', 'Diego', 'Sergio', 'Alejandro', 'Daniel', 'Adrián', 'Álvaro', 'Mario', 'Manuel', 'Roberto', 'Jorge', 'Iván', 'Rubén'],
    surnames: ['García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Sainz', 'Alonso', 'Ramírez', 'Torres', 'Flores', 'Ruiz', 'Hernández'],
  },
  {
    code: 'BR', name: 'Brazil', flag: '🇧🇷', weight: 8,
    firstNames: ['Bruno', 'Felipe', 'Rafael', 'Gabriel', 'Lucas', 'Pedro', 'Rodrigo', 'Diogo', 'Caio', 'Murilo', 'Vinicius', 'Thiago', 'Henrique', 'Leonardo', 'André', 'Fabio'],
    surnames: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Ferreira', 'Costa', 'Almeida', 'Carvalho', 'Senna', 'Massa', 'Piquet', 'Barrichello', 'Fittipaldi', 'Bortoleto'],
  },
  {
    code: 'NL', name: 'Netherlands', flag: '🇳🇱', weight: 7,
    firstNames: ['Max', 'Daan', 'Sem', 'Lucas', 'Liam', 'Finn', 'Bram', 'Levi', 'Thijs', 'Sven', 'Jasper', 'Niels', 'Bas', 'Joris', 'Pim', 'Stijn'],
    surnames: ['de Vries', 'van Dijk', 'Jansen', 'de Jong', 'Bakker', 'Visser', 'Smit', 'Meijer', 'Mulder', 'de Boer', 'Verstappen', 'van der Berg', 'Vermeulen', 'Hartog', 'Klaassen', 'Postma'],
  },
  {
    code: 'FI', name: 'Finland', flag: '🇫🇮', weight: 5,
    firstNames: ['Mika', 'Kimi', 'Valtteri', 'Heikki', 'Juha', 'Antti', 'Pekka', 'Lauri', 'Mikael', 'Tomi', 'Jari', 'Aleksi', 'Eero', 'Onni', 'Otto', 'Veikko'],
    surnames: ['Korhonen', 'Virtanen', 'Mäkinen', 'Nieminen', 'Heikkinen', 'Räikkönen', 'Hakkinen', 'Bottas', 'Salo', 'Kovalainen', 'Lehto', 'Niemi', 'Laine', 'Saari', 'Hämäläinen', 'Karjalainen'],
  },
  {
    code: 'AU', name: 'Australia', flag: '🇦🇺', weight: 6,
    firstNames: ['Daniel', 'Mark', 'Oscar', 'Jack', 'Ryan', 'Liam', 'Cooper', 'Tyler', 'Hunter', 'Connor', 'Nathan', 'Toby', 'Lachlan', 'Brodie', 'Hayden', 'Riley'],
    surnames: ['Smith', 'Jones', 'Williams', 'Brown', 'Taylor', 'Wilson', 'Anderson', 'Thompson', 'White', 'Webber', 'Ricciardo', 'Piastri', 'Doohan', 'Harrison', 'Mitchell', 'Campbell'],
  },
  {
    code: 'JP', name: 'Japan', flag: '🇯🇵', weight: 5,
    firstNames: ['Yuki', 'Kenji', 'Takuma', 'Hiroshi', 'Kazuki', 'Ryo', 'Sho', 'Daichi', 'Akira', 'Naoki', 'Haruto', 'Sota', 'Yuto', 'Ren', 'Kaito', 'Hayato'],
    surnames: ['Sato', 'Suzuki', 'Tanaka', 'Yamamoto', 'Watanabe', 'Ito', 'Nakamura', 'Kobayashi', 'Tsunoda', 'Honda', 'Aguri', 'Yamashita', 'Inoue', 'Hayashi', 'Mori', 'Kato'],
  },
  {
    code: 'US', name: 'United States', flag: '🇺🇸', weight: 6,
    firstNames: ['Logan', 'Mason', 'Hunter', 'Jake', 'Tyler', 'Connor', 'Brody', 'Cooper', 'Blake', 'Cole', 'Ethan', 'Mason', 'Wyatt', 'Carter', 'Bryce', 'Travis'],
    surnames: ['Sargeant', 'Andretti', 'Hill', 'Power', 'Newgarden', 'Rossi', 'Herta', 'Daly', 'Kirkwood', 'O\'Ward', 'Lundgaard', 'Foster', 'Hayes', 'Reed', 'Cole', 'Bennett'],
  },
  {
    code: 'MX', name: 'Mexico', flag: '🇲🇽', weight: 4,
    firstNames: ['Sergio', 'Pato', 'Esteban', 'Miguel', 'Eduardo', 'Carlos', 'Diego', 'Alejandro', 'Hector', 'Roberto', 'Mateo', 'Santiago', 'Emiliano', 'Daniel', 'Andrés', 'Rodrigo'],
    surnames: ['Pérez', 'Hernández', 'García', 'Martínez', 'López', 'González', 'Rodríguez', 'Gutiérrez', 'Mendoza', 'Ramírez', 'Vázquez', 'Aguilar', 'Reyes', 'Castillo', 'Ortiz', 'Cruz'],
  },
  {
    code: 'CA', name: 'Canada', flag: '🇨🇦', weight: 4,
    firstNames: ['Lance', 'Nicholas', 'Jacques', 'Gilles', 'Patrick', 'Tristan', 'Devlin', 'Mason', 'Connor', 'Ethan', 'Liam', 'Ryan', 'Tyler', 'Logan', 'Hudson', 'Kai'],
    surnames: ['Stroll', 'Latifi', 'Villeneuve', 'Tremblay', 'Roy', 'Bouchard', 'Beaulieu', 'Lévesque', 'Côté', 'Lefebvre', 'Brunelle', 'Gagnon', 'Pelletier', 'Carter', 'Murphy', 'Walsh'],
  },
  {
    code: 'AR', name: 'Argentina', flag: '🇦🇷', weight: 4,
    firstNames: ['Juan', 'Diego', 'Sebastián', 'Lautaro', 'Franco', 'Tomás', 'Mateo', 'Joaquín', 'Bruno', 'Agustín', 'Nicolás', 'Esteban', 'Federico', 'Martín', 'Lucas', 'Gabriel'],
    surnames: ['Fangio', 'Reutemann', 'González', 'Pironi', 'Colapinto', 'Romero', 'Fernández', 'Sosa', 'Acosta', 'Benítez', 'Castro', 'Núñez', 'Ríos', 'Vega', 'Aguirre', 'Cabrera'],
  },
  {
    code: 'BE', name: 'Belgium', flag: '🇧🇪', weight: 4,
    firstNames: ['Stoffel', 'Thierry', 'Jacky', 'Olivier', 'Maxime', 'Arthur', 'Lucien', 'Bernard', 'Guillaume', 'Vincent', 'Sebastien', 'Christophe', 'Frédéric', 'Renaud', 'Pieter', 'Bart'],
    surnames: ['Vandoorne', 'Boutsen', 'Ickx', 'Beretta', 'Janssens', 'Peeters', 'Maes', 'Jacobs', 'Mertens', 'Willems', 'Claeys', 'De Smet', 'Verhoeven', 'Lambert', 'Dewulf', 'Lemaitre'],
  },
  {
    code: 'AT', name: 'Austria', flag: '🇦🇹', weight: 4,
    firstNames: ['Niki', 'Gerhard', 'Jochen', 'Lukas', 'Maximilian', 'Stefan', 'Florian', 'Benedikt', 'Andreas', 'Markus', 'Christoph', 'Sebastian', 'Manuel', 'Patrick', 'Thomas', 'Philipp'],
    surnames: ['Lauda', 'Berger', 'Rindt', 'Wurz', 'Gruber', 'Huber', 'Wagner', 'Maier', 'Bauer', 'Steiner', 'Hofer', 'Pichler', 'Schwarz', 'Lechner', 'Reiter', 'Brunner'],
  },
  {
    code: 'MC', name: 'Monaco', flag: '🇲🇨', weight: 3,
    firstNames: ['Charles', 'Louis', 'Albert', 'Stefano', 'Marco', 'Edouard', 'François', 'Henri', 'Olivier', 'Jean-Marc', 'Antoine', 'Pierre', 'Romain', 'Bastien', 'Sébastien', 'Théophile'],
    surnames: ['Leclerc', 'Beretta', 'Grimaldi', 'Crovetto', 'Notari', 'Marquet', 'Vatrican', 'Pastor', 'Boisson', 'Aureglia', 'Médecin', 'Galéa', 'Imperti', 'Brych', 'Tartaglia', 'Rinaldi'],
  },
  {
    code: 'CH', name: 'Switzerland', flag: '🇨🇭', weight: 3,
    firstNames: ['Sébastien', 'Romain', 'Marc', 'Lucas', 'Maxime', 'Yannick', 'Cédric', 'Patrick', 'Florian', 'Stefan', 'Andreas', 'Reto', 'Lukas', 'Severin', 'Noah', 'Elias'],
    surnames: ['Buemi', 'Grosjean', 'Sutil', 'Schenker', 'Müller', 'Meier', 'Schmid', 'Keller', 'Weber', 'Huber', 'Steiner', 'Frei', 'Brunner', 'Egger', 'Bühler', 'Lehmann'],
  },
  {
    code: 'DK', name: 'Denmark', flag: '🇩🇰', weight: 3,
    firstNames: ['Kevin', 'Magnus', 'Jan', 'Frederik', 'Mikkel', 'Anders', 'Lars', 'Morten', 'Søren', 'Mads', 'Peter', 'Christian', 'Nikolaj', 'Oliver', 'Emil', 'Victor'],
    surnames: ['Magnussen', 'Lundgaard', 'Nielsen', 'Jensen', 'Hansen', 'Pedersen', 'Andersen', 'Christensen', 'Larsen', 'Sørensen', 'Rasmussen', 'Jørgensen', 'Petersen', 'Madsen', 'Kristensen', 'Olsen'],
  },
  {
    code: 'SE', name: 'Sweden', flag: '🇸🇪', weight: 3,
    firstNames: ['Marcus', 'Erik', 'Lars', 'Anders', 'Johan', 'Magnus', 'Henrik', 'Oskar', 'Viktor', 'Linus', 'Felix', 'Axel', 'Hugo', 'Olle', 'William', 'Liam'],
    surnames: ['Ericsson', 'Rosenqvist', 'Andersson', 'Johansson', 'Karlsson', 'Nilsson', 'Eriksson', 'Larsson', 'Olsson', 'Persson', 'Svensson', 'Lindberg', 'Berg', 'Lindgren', 'Lundberg', 'Holm'],
  },
  {
    code: 'PL', name: 'Poland', flag: '🇵🇱', weight: 3,
    firstNames: ['Robert', 'Krzysztof', 'Bartosz', 'Kamil', 'Mateusz', 'Adam', 'Tomasz', 'Michał', 'Jakub', 'Piotr', 'Marcin', 'Łukasz', 'Filip', 'Kacper', 'Wojciech', 'Patryk'],
    surnames: ['Kubica', 'Nowak', 'Kowalski', 'Wiśniewski', 'Wójcik', 'Kowalczyk', 'Kamiński', 'Lewandowski', 'Zieliński', 'Szymański', 'Woźniak', 'Dąbrowski', 'Kozłowski', 'Jankowski', 'Mazur', 'Krawczyk'],
  },
  {
    code: 'RU', name: 'Russia', flag: '🇷🇺', weight: 3,
    firstNames: ['Daniil', 'Vitaly', 'Sergey', 'Nikita', 'Robert', 'Aleksandr', 'Dmitry', 'Mikhail', 'Andrey', 'Igor', 'Pavel', 'Maksim', 'Ivan', 'Roman', 'Artyom', 'Yuri'],
    surnames: ['Kvyat', 'Petrov', 'Sirotkin', 'Mazepin', 'Smolensky', 'Ivanov', 'Volkov', 'Sokolov', 'Pavlov', 'Kuznetsov', 'Popov', 'Lebedev', 'Novikov', 'Morozov', 'Vasiliev', 'Fedorov'],
  },
  {
    code: 'TH', name: 'Thailand', flag: '🇹🇭', weight: 2,
    firstNames: ['Alex', 'Niko', 'Krit', 'Phuwasit', 'Tanin', 'Somchai', 'Somsak', 'Surat', 'Wichai', 'Pongsak', 'Anan', 'Chai', 'Pratep', 'Sakda', 'Boon', 'Kasem'],
    surnames: ['Albon', 'Wattanasin', 'Suthi', 'Phanit', 'Naron', 'Boonprasert', 'Charoen', 'Lim', 'Thaksin', 'Kittikachorn', 'Wong', 'Saisuk', 'Sukhum', 'Pongthep', 'Anuwat', 'Watcharakorn'],
  },
  {
    code: 'CN', name: 'China', flag: '🇨🇳', weight: 3,
    firstNames: ['Guanyu', 'Wei', 'Chao', 'Liang', 'Jian', 'Hao', 'Bo', 'Xiang', 'Lei', 'Tao', 'Yong', 'Long', 'Hui', 'Peng', 'Zhen', 'Feng'],
    surnames: ['Zhou', 'Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang', 'Zhao', 'Wu', 'Sun', 'Hu', 'Lin', 'Guo', 'Lu', 'Tang'],
  },
  {
    code: 'NZ', name: 'New Zealand', flag: '🇳🇿', weight: 2,
    firstNames: ['Bruce', 'Denny', 'Brendon', 'Scott', 'Liam', 'Mitch', 'Hayden', 'Cooper', 'Connor', 'Mason', 'Logan', 'Tyler', 'Cody', 'Riley', 'Hunter', 'Jaxon'],
    surnames: ['McLaren', 'Hulme', 'Hartley', 'Dixon', 'Lawson', 'Evans', 'Cassidy', 'Murray', 'Walker', 'Mitchell', 'Campbell', 'Stewart', 'Anderson', 'Wilson', 'Thompson', 'Roberts'],
  },
];

// Roll a country weighted by `weight`.
export function rollCountry<R extends { range: (lo: number, hi: number) => number }>(rng: R): CountryEntry {
  const total = COUNTRIES.reduce((a, c) => a + c.weight, 0);
  let pick = rng.range(0, total);
  for (const c of COUNTRIES) {
    pick -= c.weight;
    if (pick <= 0) return c;
  }
  return COUNTRIES[0];
}

// Generate a full name from a country's pools.
export function rollNameForCountry<R extends { pick: <T>(arr: T[]) => T }>(country: CountryEntry, rng: R): string {
  const first = rng.pick(country.firstNames);
  const last = rng.pick(country.surnames);
  return `${first} ${last}`;
}
