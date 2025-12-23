export interface CardStats {
  members: number;
  albums: number;
  debutYear: number;
  fame: number; // 1 to 40
  awards: number;
}

export interface CardData {
  id: string;
  name: string;
  imageColor: string; // Gradient string for placeholder logo background
  imageUrl: string; // URL da imagem do grupo
  stats: CardStats;
}

export enum GameState {
  START = 'START',
  LOBBY = 'LOBBY', // Novo estado para criar/entrar na sala
  PLAYING = 'PLAYING',
  RESULT = 'RESULT', // Showing the comparison
  WAITING_NEXT_TURN = 'WAITING_NEXT_TURN', // For 2P pass-and-play
  GAME_OVER = 'GAME_OVER',
}

export enum GameMode {
  SINGLE_PLAYER = 'SINGLE_PLAYER',
  TWO_PLAYERS = 'TWO_PLAYERS', // Local
  ONLINE_HOST = 'ONLINE_HOST', // P2P Host
  ONLINE_GUEST = 'ONLINE_GUEST', // P2P Guest
}

export interface HighScore {
  name: string;
  roundsWon: number;
  date: string;
}

export type StatKey = keyof CardStats;

export const STAT_LABELS: Record<StatKey, string> = {
  members: 'Membros',
  albums: 'Álbuns',
  debutYear: 'Debut',
  fame: 'Fama',
  awards: 'Prêmios',
};

// Tipos para comunicação P2P
export type NetworkMessage = 
  | { type: 'READY' }                        
  | { type: 'START_GAME'; deck: CardData[] } 
  | { type: 'GUEST_MOVE'; stat: StatKey } // Convidado solicita movimento
  | { type: 'ROUND_RESULT'; stat: StatKey; winner: 'PLAYER' | 'CPU' | 'DRAW'; hostCard: CardData; guestCard: CardData } // Host envia resultado final
  | { type: 'NEXT_ROUND' }                   
  | { type: 'RESTART' };

// --- NEW: PROGRESSION SYSTEM ---
export type CardSkinType = 'default' | 'holo' | 'gold';

export interface UserProfile {
  level: number;
  currentXp: number;
  nextLevelXp: number;
  unlockedSkins: CardSkinType[];
  selectedSkin: CardSkinType;
}
