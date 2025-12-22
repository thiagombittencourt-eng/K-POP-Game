import { CardData } from '../types';

// Helper to generate consistent gradients based on group vibe
const gradients = [
  'from-pink-500 via-rose-500 to-red-600',
  'from-violet-600 via-purple-500 to-indigo-600',
  'from-blue-400 via-cyan-400 to-teal-400',
  'from-emerald-400 via-green-500 to-lime-600',
  'from-orange-400 via-amber-500 to-yellow-500',
  'from-fuchsia-500 via-magenta-500 to-purple-600',
  'from-yellow-400 via-orange-500 to-red-500',
  'from-slate-700 via-gray-800 to-black',
];

const getGradient = (index: number) => gradients[index % gradients.length];

// Logos dos Grupos (SVG Diretos)
const logos = {
  bts: 'https://upload.wikimedia.org/wikipedia/commons/2/23/BTS_Logo.svg',
  blackpink: 'https://upload.wikimedia.org/wikipedia/commons/6/67/Blackpink_Logo.svg',
  exo: 'https://upload.wikimedia.org/wikipedia/commons/8/87/Exo_logo.svg',
  twice: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Twice_logo.svg',
  seventeen: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Seventeen_Logo.svg',
  redvelvet: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Red_Velvet_logo.svg',
  nct: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Nct_127_logo.svg',
  mamamoo: 'https://upload.wikimedia.org/wikipedia/commons/0/07/Mamamoo_logo.svg',
  bigbang: 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Big_Bang_Logo.svg',
  snsd: 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Girls%27_Generation_logo_text.svg',
  suju: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Super_Junior_logo.svg',
  shinee: 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Shinee_logo.svg',
  ne1: 'https://upload.wikimedia.org/wikipedia/commons/7/7d/2NE1_Logo.png',
  wonder: 'https://upload.wikimedia.org/wikipedia/commons/f/f2/Wonder_Girls_logo.svg',
  tvxq: 'https://upload.wikimedia.org/wikipedia/commons/9/90/TVXQ_Logo.svg',
  sistar: 'https://upload.wikimedia.org/wikipedia/commons/0/0d/Sistar_logo.svg',
  straykids: 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Stray_Kids_logo.svg',
  newjeans: 'https://upload.wikimedia.org/wikipedia/commons/1/18/NewJeans_Logo.svg',
  txt: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Tomorrow_X_Together_Logo.svg',
  itzy: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Itzy_logo.svg',
  aespa: 'https://upload.wikimedia.org/wikipedia/commons/3/36/Aespa_logo.svg',
  enhypen: 'https://upload.wikimedia.org/wikipedia/commons/4/49/Enhypen_logo.svg',
  ive: 'https://upload.wikimedia.org/wikipedia/commons/9/90/Ive_logo.svg',
  lesserafim: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Le_Sserafim_Logo.svg',
  gidle: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/%28G%29I-dle_logo.svg',
  ateez: 'https://upload.wikimedia.org/wikipedia/commons/9/94/Ateez_logo.svg',
  monstax: 'https://upload.wikimedia.org/wikipedia/commons/9/90/Monsta_X_logo.svg',
  treasure: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Treasure_Logo.svg',
  nmixx: 'https://upload.wikimedia.org/wikipedia/commons/7/75/Nmixx_logo.svg',
  stayc: 'https://upload.wikimedia.org/wikipedia/commons/0/07/STAYC_logo.svg',
  dreamcatcher: 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Dreamcatcher_logo.svg',
  theboyz: 'https://upload.wikimedia.org/wikipedia/commons/5/52/The_Boyz_logo.svg',
};

export const INITIAL_DECK: CardData[] = [
  // Gen 3 & Titans
  { id: '1', name: 'BTS', imageColor: getGradient(0), imageUrl: logos.bts, stats: { members: 7, albums: 9, debutYear: 2013, fame: 40, awards: 483 } },
  { id: '2', name: 'BLACKPINK', imageColor: getGradient(1), imageUrl: logos.blackpink, stats: { members: 4, albums: 2, debutYear: 2016, fame: 39, awards: 120 } },
  { id: '3', name: 'EXO', imageColor: getGradient(2), imageUrl: logos.exo, stats: { members: 9, albums: 7, debutYear: 2012, fame: 36, awards: 170 } },
  { id: '4', name: 'TWICE', imageColor: getGradient(3), imageUrl: logos.twice, stats: { members: 9, albums: 7, debutYear: 2015, fame: 37, awards: 115 } },
  { id: '5', name: 'SEVENTEEN', imageColor: getGradient(4), imageUrl: logos.seventeen, stats: { members: 13, albums: 4, debutYear: 2015, fame: 35, awards: 85 } },
  { id: '6', name: 'Red Velvet', imageColor: getGradient(5), imageUrl: logos.redvelvet, stats: { members: 5, albums: 3, debutYear: 2014, fame: 33, awards: 60 } },
  { id: '7', name: 'NCT 127', imageColor: getGradient(6), imageUrl: logos.nct, stats: { members: 9, albums: 5, debutYear: 2016, fame: 32, awards: 45 } },
  { id: '8', name: 'MAMAMOO', imageColor: getGradient(7), imageUrl: logos.mamamoo, stats: { members: 4, albums: 4, debutYear: 2014, fame: 28, awards: 40 } },
  
  // Gen 2 Legends
  { id: '9', name: 'BIGBANG', imageColor: getGradient(0), imageUrl: logos.bigbang, stats: { members: 4, albums: 3, debutYear: 2006, fame: 38, awards: 140 } },
  { id: '10', name: 'Girls\' Generation', imageColor: getGradient(1), imageUrl: logos.snsd, stats: { members: 8, albums: 6, debutYear: 2007, fame: 38, awards: 130 } },
  { id: '11', name: 'Super Junior', imageColor: getGradient(2), imageUrl: logos.suju, stats: { members: 9, albums: 11, debutYear: 2005, fame: 34, awards: 110 } },
  { id: '12', name: 'SHINee', imageColor: getGradient(3), imageUrl: logos.shinee, stats: { members: 5, albums: 7, debutYear: 2008, fame: 35, awards: 95 } },
  { id: '13', name: '2NE1', imageColor: getGradient(4), imageUrl: logos.ne1, stats: { members: 4, albums: 2, debutYear: 2009, fame: 36, awards: 80 } },
  { id: '14', name: 'Wonder Girls', imageColor: getGradient(5), imageUrl: logos.wonder, stats: { members: 4, albums: 3, debutYear: 2007, fame: 30, awards: 65 } },
  { id: '15', name: 'TVXQ!', imageColor: getGradient(6), imageUrl: logos.tvxq, stats: { members: 2, albums: 8, debutYear: 2003, fame: 32, awards: 90 } },
  { id: '16', name: 'SISTAR', imageColor: getGradient(7), imageUrl: logos.sistar, stats: { members: 4, albums: 2, debutYear: 2010, fame: 29, awards: 55 } },

  // Gen 4 & New Hits
  { id: '17', name: 'Stray Kids', imageColor: getGradient(0), imageUrl: logos.straykids, stats: { members: 8, albums: 4, debutYear: 2018, fame: 35, awards: 55 } },
  { id: '18', name: 'NewJeans', imageColor: getGradient(1), imageUrl: logos.newjeans, stats: { members: 5, albums: 2, debutYear: 2022, fame: 36, awards: 30 } },
  { id: '19', name: 'TXT', imageColor: getGradient(2), imageUrl: logos.txt, stats: { members: 5, albums: 3, debutYear: 2019, fame: 32, awards: 40 } },
  { id: '20', name: 'ITZY', imageColor: getGradient(3), imageUrl: logos.itzy, stats: { members: 5, albums: 1, debutYear: 2019, fame: 31, awards: 45 } },
  { id: '21', name: 'AESPA', imageColor: getGradient(4), imageUrl: logos.aespa, stats: { members: 4, albums: 1, debutYear: 2020, fame: 33, awards: 48 } },
  { id: '22', name: 'ENHYPEN', imageColor: getGradient(5), imageUrl: logos.enhypen, stats: { members: 7, albums: 2, debutYear: 2020, fame: 30, awards: 35 } },
  { id: '23', name: 'IVE', imageColor: getGradient(6), imageUrl: logos.ive, stats: { members: 6, albums: 1, debutYear: 2021, fame: 32, awards: 38 } },
  { id: '24', name: 'LE SSERAFIM', imageColor: getGradient(7), imageUrl: logos.lesserafim, stats: { members: 5, albums: 1, debutYear: 2022, fame: 31, awards: 25 } },

  // Rising & Others
  { id: '25', name: '(G)I-DLE', imageColor: getGradient(0), imageUrl: logos.gidle, stats: { members: 5, albums: 2, debutYear: 2018, fame: 31, awards: 50 } },
  { id: '26', name: 'ATEEZ', imageColor: getGradient(1), imageUrl: logos.ateez, stats: { members: 8, albums: 2, debutYear: 2018, fame: 30, awards: 30 } },
  { id: '27', name: 'MONSTA X', imageColor: getGradient(2), imageUrl: logos.monstax, stats: { members: 6, albums: 4, debutYear: 2015, fame: 29, awards: 60 } },
  { id: '28', name: 'TREASURE', imageColor: getGradient(3), imageUrl: logos.treasure, stats: { members: 10, albums: 2, debutYear: 2020, fame: 26, awards: 20 } },
  { id: '29', name: 'NMIXX', imageColor: getGradient(4), imageUrl: logos.nmixx, stats: { members: 6, albums: 1, debutYear: 2022, fame: 25, awards: 10 } },
  { id: '30', name: 'STAYC', imageColor: getGradient(5), imageUrl: logos.stayc, stats: { members: 6, albums: 1, debutYear: 2020, fame: 24, awards: 15 } },
  { id: '31', name: 'DREAMCATCHER', imageColor: getGradient(6), imageUrl: logos.dreamcatcher, stats: { members: 7, albums: 2, debutYear: 2017, fame: 23, awards: 5 } },
  { id: '32', name: 'THE BOYZ', imageColor: getGradient(7), imageUrl: logos.theboyz, stats: { members: 11, albums: 2, debutYear: 2017, fame: 27, awards: 35 } },
];