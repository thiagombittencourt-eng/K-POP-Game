import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_DECK } from './data/groups';
import { CardData, GameState, StatKey, GameMode, HighScore, NetworkMessage } from './types';
import { Card } from './components/Card';
import { Trophy, RefreshCw, Users, Play, Smartphone, User, ArrowRight, Wifi, Copy, CheckCircle, Globe, LogIn } from 'lucide-react';
import Peer, { DataConnection } from 'peerjs';

// --- SOUND MANAGER (Web Audio API) ---
const SoundEffects = {
  ctx: null as AudioContext | null,

  init: () => {
    if (!SoundEffects.ctx) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        SoundEffects.ctx = new AudioContext();
      }
    }
    if (SoundEffects.ctx && SoundEffects.ctx.state === 'suspended') {
      SoundEffects.ctx.resume();
    }
  },

  play: (type: 'select' | 'win' | 'lose' | 'draw' | 'gameover' | 'start') => {
    if (!SoundEffects.ctx) SoundEffects.init();
    const ctx = SoundEffects.ctx;
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case 'select':
        // High blip
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
        break;

      case 'start':
        // Swipe sound
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.linearRampToValueAtTime(600, t + 0.2);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.2);
        break;

      case 'win':
        // Major Chord Arpeggio (C - E - G)
        const winOsc2 = ctx.createOscillator();
        const winOsc3 = ctx.createOscillator();
        const winGain2 = ctx.createGain();
        const winGain3 = ctx.createGain();
        
        winOsc2.connect(winGain2); winGain2.connect(ctx.destination);
        winOsc3.connect(winGain3); winGain3.connect(ctx.destination);

        // Note 1
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, t); // C5
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.4);
        osc.start(t); osc.stop(t + 0.4);

        // Note 2
        winOsc2.type = 'triangle';
        winOsc2.frequency.setValueAtTime(659.25, t + 0.1); // E5
        winGain2.gain.setValueAtTime(0.05, t + 0.1);
        winGain2.gain.linearRampToValueAtTime(0, t + 0.5);
        winOsc2.start(t + 0.1); winOsc2.stop(t + 0.5);

        // Note 3
        winOsc3.type = 'triangle';
        winOsc3.frequency.setValueAtTime(783.99, t + 0.2); // G5
        winGain3.gain.setValueAtTime(0.05, t + 0.2);
        winGain3.gain.linearRampToValueAtTime(0, t + 0.8);
        winOsc3.start(t + 0.2); winOsc3.stop(t + 0.8);
        break;

      case 'lose':
        // Discordant / Descending
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.linearRampToValueAtTime(100, t + 0.4);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
        break;
      
      case 'draw':
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, t);
        gain.gain.setValueAtTime(0.03, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.2);
        break;

      case 'gameover':
        // Fanfareish
        const gOsc = ctx.createOscillator();
        const gGain = ctx.createGain();
        gOsc.connect(gGain); gGain.connect(ctx.destination);
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(523.25, t); // C5
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.setValueAtTime(0, t+0.15);
        osc.start(t); osc.stop(t + 0.2);

        setTimeout(() => {
           const o2 = ctx.createOscillator();
           const g2 = ctx.createGain();
           o2.type = 'square'; o2.connect(g2); g2.connect(ctx.destination);
           o2.frequency.setValueAtTime(523.25, ctx.currentTime);
           g2.gain.setValueAtTime(0.1, ctx.currentTime);
           g2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
           o2.start(ctx.currentTime); o2.stop(ctx.currentTime + 0.4);
        }, 150);

        setTimeout(() => {
           const o3 = ctx.createOscillator();
           const g3 = ctx.createGain();
           o3.type = 'square'; o3.connect(g3); g3.connect(ctx.destination);
           o3.frequency.setValueAtTime(783.99, ctx.currentTime);
           g3.gain.setValueAtTime(0.1, ctx.currentTime);
           g3.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);
           o3.start(ctx.currentTime); o3.stop(ctx.currentTime + 1.0);
        }, 300);
        break;
    }
  }
};


// Shuffle function (Fisher-Yates)
const shuffleDeck = (deck: CardData[]): CardData[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.SINGLE_PLAYER);
  
  const [playerDeck, setPlayerDeck] = useState<CardData[]>([]);
  const [cpuDeck, setCpuDeck] = useState<CardData[]>([]);
  
  const [playerCard, setPlayerCard] = useState<CardData | null>(null);
  const [cpuCard, setCpuCard] = useState<CardData | null>(null);
  
  const [turn, setTurn] = useState<'PLAYER' | 'CPU'>('PLAYER');
  const [selectedStat, setSelectedStat] = useState<StatKey | null>(null);
  const [roundWinner, setRoundWinner] = useState<'PLAYER' | 'CPU' | 'DRAW' | null>(null);
  const [message, setMessage] = useState<string>("");
  
  const [scores, setScores] = useState({ player: 0, cpu: 0 });
  const [highScores, setHighScores] = useState<HighScore[]>([]);

  // -- P2P States --
  const [peerId, setPeerId] = useState<string>('');
  const [joinId, setJoinId] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOnline = gameMode === GameMode.ONLINE_HOST || gameMode === GameMode.ONLINE_GUEST;

  // Use refs to track state in event listeners (closure trap)
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  useEffect(() => {
    const saved = localStorage.getItem('kpop_trunfo_ranking');
    if (saved) {
      setHighScores(JSON.parse(saved));
    }
    // Cleanup peer on unmount
    return () => {
      if (peerRef.current) peerRef.current.destroy();
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    };
  }, []);

  // Notificação com auto-dismiss quando o jogo está em andamento (para não atrapalhar a escolha)
  useEffect(() => {
    if (message && gameState === GameState.PLAYING) {
      const timer = setTimeout(() => {
        setMessage("");
      }, 2500); // Some após 2.5 segundos
      return () => clearTimeout(timer);
    }
  }, [message, gameState]);

  const saveHighScore = (winnerName: string, points: number) => {
    const newScore: HighScore = { name: winnerName, roundsWon: points, date: new Date().toLocaleDateString() };
    const updated = [...highScores, newScore].sort((a, b) => b.roundsWon - a.roundsWon).slice(0, 5);
    setHighScores(updated);
    localStorage.setItem('kpop_trunfo_ranking', JSON.stringify(updated));
  };

  // --- ONLINE LOGIC ---

  const initializePeer = (isHost: boolean) => {
    if (peerRef.current) {
        peerRef.current.destroy();
    }
    
    // Status inicial: conectando ao servidor de sinalização
    setConnectionStatus('connecting');
    setMessage("Conectando ao servidor...");
    
    // Configuração com STUN Servers do Google para furar NAT (essencial para funcionar fora da rede local)
    const peerConfig = {
      debug: 2, // Log levels: 0-3
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    };

    // Create Peer
    const peer = new Peer(peerConfig);
    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log('My Peer ID:', id);
      setPeerId(id);
      setConnectionStatus('idle'); // Pronto para interação
      if (isHost) {
        setMessage("Aguardando oponente...");
      } else {
        setMessage("Insira o código do anfitrião.");
      }
    });

    peer.on('connection', (conn) => {
      console.log('Incoming connection from:', conn.peer);
      // HOST receives connection
      handleConnection(conn);
    });

    peer.on('error', (err: any) => {
      console.warn('PeerJS Error:', err);
      
      // Tratamento amigável de erros
      if (err.type === 'peer-unavailable') {
          // Reset to idle so user can try again
          setConnectionStatus('idle');
          setMessage("Sala não encontrada. Verifique o código.");
      } else if (err.type === 'disconnected') {
          setConnectionStatus('error');
          setMessage("Desconectado do servidor. Tentando reconectar...");
          peer.reconnect();
      } else if (err.type === 'network') {
          setConnectionStatus('error');
          setMessage("Erro de rede. Verifique sua internet.");
      } else {
          setConnectionStatus('error');
          setMessage("Erro de conexão P2P.");
      }
    });
  };

  const connectToPeer = () => {
    const cleanId = joinId.trim();
    if (!peerRef.current || !cleanId) return;
    
    setConnectionStatus('connecting');
    setMessage("Buscando sala...");
    
    // Safety Timeout: Se não conectar em 10 segundos, cancela
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    
    connectionTimeoutRef.current = setTimeout(() => {
        if (connectionStatus === 'connecting') {
            setConnectionStatus('error');
            setMessage("Tempo esgotado. Tente novamente.");
            if (connRef.current) connRef.current.close();
        }
    }, 10000);

    console.log('Attempting to connect to:', cleanId);
    // Connect with JSON serialization to avoid binary pack issues
    const conn = peerRef.current.connect(cleanId, { 
        serialization: 'json'
    });
    handleConnection(conn);
  };

  const handleConnection = (conn: DataConnection) => {
    connRef.current = conn;

    conn.on('open', () => {
      console.log('Connection established with:', conn.peer);
      
      // Limpa timeout de conexão se existir
      if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
      }

      setConnectionStatus('connected');
      setMessage("Conectado! Preparando jogo...");
      SoundEffects.play('start');
      
      // If I am Host, I need to start the game logic
      if (gameMode === GameMode.ONLINE_HOST) {
        startOnlineGameAsHost();
      }
    });

    conn.on('data', (data: unknown) => {
      handleCustomNetworkMessage(data);
    });

    conn.on('error', (err) => {
        console.warn("Connection Error:", err);
        setConnectionStatus('error');
        setMessage("Erro na conexão de dados.");
    });

    conn.on('close', () => {
      console.log('Connection closed');
      // Check current game state via Ref to avoid stale closure
      const currentGs = gameStateRef.current;
      if (currentGs === GameState.LOBBY || currentGs === GameState.START) {
           setConnectionStatus('error');
           setMessage("Conexão falhou.");
      } else {
           setConnectionStatus('error');
           setMessage("Oponente desconectou.");
           setGameState(GameState.GAME_OVER);
      }
    });
  };

  const startOnlineGameAsHost = () => {
    const fullDeck = shuffleDeck(INITIAL_DECK);
    const mid = Math.floor(fullDeck.length / 2);
    const pDeck = fullDeck.slice(0, mid); // Host Deck
    const cDeck = fullDeck.slice(mid);    // Guest Deck

    // Setup Local (Host)
    setPlayerDeck(pDeck);
    setCpuDeck(cDeck); // In online mode, 'CPU' variable holds the remote player's state
    setPlayerCard(pDeck[0]);
    setCpuCard(cDeck[0]);
    setScores({ player: 0, cpu: 0 });
    setTurn('PLAYER'); // Host starts

    // Send Guest Deck to Guest
    sendMessage({ type: 'START_GAME', deck: cDeck });

    setGameState(GameState.PLAYING);
    setMessage("Sua vez! Escolha um atributo.");
  };

  const sendMessage = (msg: NetworkMessage) => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send(msg);
    }
  };

  const handleNetworkMessage = (msg: NetworkMessage) => {
    switch (msg.type) {
      case 'START_GAME':
        // Guest receives their deck
        const myDeck = msg.deck;
        const dummyHostDeck = Array(32 - myDeck.length).fill({ ...myDeck[0], id: 'dummy' });
        
        setPlayerDeck(myDeck);
        setCpuDeck(dummyHostDeck);
        setPlayerCard(myDeck[0]);
        setCpuCard(dummyHostDeck[0]); 
        
        setScores({ player: 0, cpu: 0 });
        setTurn('CPU'); // Host starts, so for Guest, it's 'CPU' (Opponent) turn
        setGameState(GameState.PLAYING);
        setMessage("Aguardando Jogador 1 (Host)...");
        SoundEffects.play('start');
        break;

      case 'MOVE':
        // Opponent made a move
        handleStatSelect(msg.stat, true);
        break;

      case 'NEXT_ROUND':
        // Opponent clicked "Next"
        if (roundWinner) resolveRound(roundWinner, true);
        break;
        
      case 'RESTART':
        window.location.reload();
        break;
    }
  };

  // --- GAME LOGIC ---

  const startGame = (mode: GameMode) => {
    SoundEffects.init(); // Resume AudioContext
    SoundEffects.play('start');

    if (mode === GameMode.ONLINE_HOST || mode === GameMode.ONLINE_GUEST) {
      setGameState(GameState.LOBBY);
      setGameMode(mode); // Set mode immediately so UI renders correctly
      initializePeer(mode === GameMode.ONLINE_HOST);
      return;
    }

    // Local/Single Player Logic
    const fullDeck = shuffleDeck(INITIAL_DECK);
    const mid = Math.floor(fullDeck.length / 2); // 16 cartas para cada
    const pDeck = fullDeck.slice(0, mid);
    const cDeck = fullDeck.slice(mid);

    setGameMode(mode);
    setPlayerDeck(pDeck);
    setCpuDeck(cDeck);
    setScores({ player: 0, cpu: 0 });
    setPlayerCard(pDeck[0]);
    setCpuCard(cDeck[0]);
    setTurn('PLAYER');
    setGameState(mode === GameMode.TWO_PLAYERS ? GameState.WAITING_NEXT_TURN : GameState.PLAYING);
    setMessage(mode === GameMode.TWO_PLAYERS ? "Passe o aparelho para Jogador 1" : "Sua vez! Escolha um atributo.");
    setSelectedStat(null);
    setRoundWinner(null);
  };
  
  // Re-implementing handleStatSelect with the logic fix:
  const performMove = (stat: StatKey, remoteCard?: CardData) => {
    setSelectedStat(stat);
    setGameState(GameState.RESULT);

    // If we received a remote card (Online mode), update the placeholder cpuCard
    if (remoteCard) {
        setCpuCard(remoteCard);
    }

    const pVal = playerCard!.stats[stat];
    // Use remote card stats if available, otherwise current cpuCard
    const comparisonCard = remoteCard || cpuCard!;
    const cVal = comparisonCard.stats[stat];

    let winner: 'PLAYER' | 'CPU' | 'DRAW' = 'DRAW';

    if (stat === 'debutYear') {
      if (pVal < cVal) winner = 'PLAYER';
      else if (pVal > cVal) winner = 'CPU';
      else winner = 'DRAW';
    } else {
      if (pVal > cVal) winner = 'PLAYER';
      else if (pVal < cVal) winner = 'CPU';
      else winner = 'DRAW';
    }

    if (winner === 'DRAW') {
      winner = turn; 
      setMessage("Empate! Vantagem de quem escolheu.");
      SoundEffects.play('draw');
    } else if (winner === 'PLAYER') {
      SoundEffects.play('win');
    } else {
      SoundEffects.play('lose');
    }

    setRoundWinner(winner);
    
    // Atualiza placar
    if (winner === 'PLAYER') setScores(prev => ({ ...prev, player: prev.player + 1 }));
    if (winner === 'CPU') setScores(prev => ({ ...prev, cpu: prev.cpu + 1 }));

    // Update Message for Result
    if (isOnline) {
       const winnerName = winner === 'PLAYER' ? 'Você' : 'Oponente';
       setMessage(`${winnerName} venceu a rodada!`);
    } else {
        const winnerName = winner === 'PLAYER' ? 'Você' : 'Oponente';
        const msg = winner === 'DRAW' ? 'Empate!' : `${winnerName} venceu a rodada!`;
        setMessage(msg);
    }
  }

  // Wrapper for the UI interaction
  const onStatClick = (stat: StatKey) => {
      SoundEffects.play('select');
      if (isOnline) {
          if (turn === 'CPU') return; // Not my turn
          // Send my card details so opponent can see
          sendMessage({ type: 'MOVE', stat, card: playerCard } as any); 
          performMove(stat);
      } else {
          handleStatSelect(stat);
      }
  }

  // Original Local Logic (Kept for compatibility)
  const handleStatSelect = (stat: StatKey, fromNetwork = false) => {
      performMove(stat);
  }

  const resolveRound = (winner: 'PLAYER' | 'CPU' | 'DRAW', fromNetwork = false) => {
    if (!playerCard || !cpuCard) return;
    
    // Play a small shuffle sound when cards move
    SoundEffects.play('select'); 

    if (isOnline && !fromNetwork) {
        sendMessage({ type: 'NEXT_ROUND' });
    }

    // REGRA NOVA: CARTAS SÃO DESCARTADAS, NÃO REAPROVEITADAS
    // Remove a carta do topo de ambos os baralhos
    const newPlayerDeck = [...playerDeck];
    const newCpuDeck = [...cpuDeck]; 
    newPlayerDeck.shift();
    newCpuDeck.shift();

    // Se acabaram as cartas, fim de jogo
    if (newPlayerDeck.length === 0) {
        finishGame();
    } else {
        // Continua o jogo com as próximas cartas
        setPlayerDeck(newPlayerDeck);
        setCpuDeck(newCpuDeck);
        setPlayerCard(newPlayerDeck[0]);
        setCpuCard(newCpuDeck[0]);
        
        // Define turno baseado no vencedor da rodada anterior
        if (winner === 'PLAYER') setTurn('PLAYER');
        else if (winner === 'CPU') setTurn('CPU');
        // Se empate, o turno continua com quem estava
        
        setSelectedStat(null);
        setRoundWinner(null);

        if (gameMode === GameMode.TWO_PLAYERS) {
            setGameState(GameState.WAITING_NEXT_TURN);
            setMessage(`Rodada finalizada. Passe para ${winner === 'PLAYER' ? 'Jogador 1' : 'Jogador 2'}`);
        } else {
            setGameState(GameState.PLAYING);
            // Notification message that will auto-dismiss
            setMessage(winner === 'PLAYER' ? "Você venceu! Sua vez." : "Oponente venceu! Vez dele.");
        }
    }
  };

  const finishGame = () => {
      SoundEffects.play('gameover');
      setGameState(GameState.GAME_OVER);
      
      let winnerName = "";
      let finalMessage = "";

      // Decide vencedor por pontos
      if (scores.player > scores.cpu) {
           winnerName = gameMode === GameMode.SINGLE_PLAYER ? 'Você' : (isOnline ? 'Você' : 'Jogador 1');
           finalMessage = `${winnerName} venceu por pontos (${scores.player} x ${scores.cpu})!`;
           if (gameMode === GameMode.SINGLE_PLAYER) {
                saveHighScore('Jogador', scores.player);
           }
      } else if (scores.cpu > scores.player) {
           winnerName = gameMode === GameMode.SINGLE_PLAYER ? 'CPU' : (isOnline ? 'Oponente' : 'Jogador 2');
           finalMessage = `${winnerName} venceu por pontos (${scores.cpu} x ${scores.player})!`;
      } else {
           finalMessage = `Empate no placar final! (${scores.player} x ${scores.cpu})`;
      }

      setMessage(finalMessage);
      
      if (isOnline) {
         if (peerRef.current) peerRef.current.destroy(); // Close connection
      }
  };

  // CPU AI
  useEffect(() => {
    if (gameMode === GameMode.SINGLE_PLAYER && turn === 'CPU' && gameState === GameState.PLAYING && cpuCard) {
        setMessage("CPU está analisando...");
        const timer = setTimeout(() => {
            const stats = cpuCard.stats;
            const keys = Object.keys(stats) as StatKey[];
            let bestStat: StatKey = 'members';
            let bestScore = -1;
            keys.forEach(key => {
                let score = 0;
                const val = stats[key];
                if (key === 'fame') score = val / 40;
                else if (key === 'debutYear') score = (2025 - val) / 20; 
                else if (key === 'members') score = val / 13;
                else if (key === 'albums') score = val / 10;
                else if (key === 'awards') score = val / 200;
                score += (Math.random() * 0.1); 
                if (score > bestScore) { bestScore = score; bestStat = key; }
            });
            performMove(bestStat);
        }, 1500);
        return () => clearTimeout(timer);
    }
  }, [turn, gameState, cpuCard, gameMode]);

  // Handle Incoming Custom Messages with Card Data
  const handleCustomNetworkMessage = (msg: any) => {
     if (msg.type === 'MOVE') {
         performMove(msg.stat, msg.card);
     } else {
         handleNetworkMessage(msg);
     }
  }

  // --- SCREENS ---

  if (gameState === GameState.START) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center p-4 bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-indigo-900 via-purple-900 to-pink-900 text-center overflow-hidden">
        <div className="mb-6 relative mt-4">
           <div className="absolute -inset-4 bg-pink-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
           <div className="relative bg-white text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-600 text-6xl font-black italic transform -rotate-6">
             K-POP
           </div>
           <div className="text-4xl font-bold text-white tracking-widest mt-2">SUPER TRUNFO</div>
        </div>
        
        <div className="flex flex-col gap-4 w-full max-w-sm mb-8 z-10">
            <button 
            onClick={() => startGame(GameMode.SINGLE_PLAYER)}
            className="group relative flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-pink-600 rounded-2xl hover:bg-pink-500 active:scale-95 shadow-lg border border-pink-400"
            >
            <Smartphone className="mr-3 w-6 h-6" />
            1 Jogador (vs CPU)
            </button>

            <button 
            onClick={() => startGame(GameMode.TWO_PLAYERS)}
            className="group relative flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-indigo-600 rounded-2xl hover:bg-indigo-500 active:scale-95 shadow-lg border border-indigo-400"
            >
            <Users className="mr-3 w-6 h-6" />
            2 Jogadores (Local)
            </button>

            <div className="grid grid-cols-2 gap-3">
                <button 
                onClick={() => startGame(GameMode.ONLINE_HOST)}
                className="group relative flex items-center justify-center px-4 py-4 text-sm md:text-lg font-bold text-white transition-all duration-200 bg-emerald-600 rounded-2xl hover:bg-emerald-500 active:scale-95 shadow-lg border border-emerald-400"
                >
                <Globe className="mr-2 w-5 h-5" />
                Criar Sala
                </button>
                <button 
                onClick={() => startGame(GameMode.ONLINE_GUEST)}
                className="group relative flex items-center justify-center px-4 py-4 text-sm md:text-lg font-bold text-white transition-all duration-200 bg-teal-600 rounded-2xl hover:bg-teal-500 active:scale-95 shadow-lg border border-teal-400"
                >
                <LogIn className="mr-2 w-5 h-5" />
                Entrar
                </button>
            </div>
        </div>

        {highScores.length > 0 && (
            <div className="w-full max-w-xs glass-panel rounded-xl p-4 mb-4 flex-1 max-h-[150px] overflow-y-auto no-scrollbar">
                <div className="flex items-center justify-center gap-2 mb-3 text-yellow-400 font-bold tracking-wider sticky top-0 bg-black/20 backdrop-blur-md py-1 rounded">
                    <Trophy className="w-5 h-5" /> HALL DA FAMA
                </div>
                <div className="space-y-2">
                    {highScores.map((score, idx) => (
                        <div key={idx} className="flex justify-between text-sm text-white/80 border-b border-white/10 pb-1 last:border-0">
                            <span>{idx + 1}. {score.name}</span>
                            <span className="font-mono text-pink-300">{score.roundsWon} pts</span>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
    );
  }

  // Lobby Screen
  if (gameState === GameState.LOBBY) {
      return (
        <div className="h-[100dvh] flex flex-col items-center justify-center bg-gray-900 p-6 relative">
            <button onClick={() => { setGameState(GameState.START); if (peerRef.current) peerRef.current.destroy(); }} className="absolute top-4 left-4 text-white/50 hover:text-white">
                ← Voltar
            </button>
            <div className="w-full max-w-md bg-gray-800/80 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl text-center">
                <Globe className="w-16 h-16 mx-auto mb-4 text-emerald-400 animate-pulse" />
                <h2 className="text-2xl font-bold text-white mb-6">Sala Online</h2>
                
                {connectionStatus === 'connecting' && <p className="text-yellow-400 animate-pulse">Conectando...</p>}
                {connectionStatus === 'error' && <p className="text-red-400 mb-4">{message}</p>}

                {gameMode === GameMode.ONLINE_HOST && peerId && (
                    <div className="space-y-6">
                        <p className="text-gray-400 text-sm">Envie este código para seu amigo:</p>
                        <div className="flex items-center gap-2 bg-black/50 p-4 rounded-xl border border-white/10 relative group">
                            <code className="text-2xl font-mono text-emerald-400 tracking-wider flex-1">{peerId}</code>
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(peerId);
                                    setMessage("Código copiado!");
                                }}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <Copy className="w-5 h-5 text-gray-400 group-hover:text-white" />
                            </button>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-white/50 text-sm">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                            Aguardando oponente...
                        </div>
                    </div>
                )}

                {gameMode === GameMode.ONLINE_GUEST && (
                     <div className="space-y-4">
                        <p className="text-gray-400 text-sm">Cole o código do anfitrião:</p>
                        <input 
                            type="text" 
                            value={joinId}
                            onChange={(e) => setJoinId(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && joinId && connectionStatus !== 'connecting') {
                                    SoundEffects.init();
                                    connectToPeer();
                                }
                            }}
                            placeholder={!peerId ? "Inicializando..." : "Ex: codigo-aqui"}
                            disabled={!peerId || connectionStatus === 'connecting'}
                            className="w-full bg-black/50 border border-white/20 rounded-xl p-4 text-center text-white font-mono text-lg focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
                        />
                        <button
                            onClick={() => { SoundEffects.init(); connectToPeer(); }}
                            disabled={!joinId || !peerId || connectionStatus === 'connecting'}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            {connectionStatus === 'connecting' ? <RefreshCw className="animate-spin" /> : <CheckCircle />}
                            {connectionStatus === 'connecting' ? 'Conectando...' : 'Entrar na Sala'}
                        </button>
                     </div>
                )}
            </div>
        </div>
      );
  }

  // --- EXISTING SCREENS (GAME OVER / WAITING) ---

  if (gameState === GameState.GAME_OVER) {
    const isWin = scores.player > scores.cpu;
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center p-6 bg-gray-900 text-center">
        <div className={`text-6xl mb-6 ${isWin ? 'text-yellow-400 animate-bounce' : 'text-gray-500'}`}>
          {isWin ? <Trophy className="w-24 h-24 mx-auto" /> : '💀'}
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">JOGO FINALIZADO</h1>
        <p className="text-pink-400 mb-8 text-xl font-bold px-4">{message}</p>
        
        <button 
          onClick={() => {
              if (peerRef.current) peerRef.current.destroy();
              setGameState(GameState.START);
          }}
          className="flex items-center px-8 py-3 bg-indigo-600 text-white rounded-full font-bold hover:bg-indigo-500 transition-colors shadow-lg"
        >
          <RefreshCw className="mr-2" />
          Menu Principal
        </button>
      </div>
    );
  }

  if (gameState === GameState.WAITING_NEXT_TURN) {
      return (
        <div className="h-[100dvh] flex flex-col items-center justify-center bg-gray-950 p-6 text-center relative overflow-hidden">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
             <div className="z-10 bg-gray-900/80 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl max-w-md w-full">
                <User className={`w-16 h-16 mx-auto mb-4 ${turn === 'PLAYER' ? 'text-blue-400' : 'text-red-400'}`} />
                <h2 className="text-2xl font-bold text-white mb-2">
                    Vez do {turn === 'PLAYER' ? 'Jogador 1' : 'Jogador 2'}
                </h2>
                <p className="text-gray-400 mb-8">
                    Não deixe o oponente ver sua carta!
                </p>
                <button
                    onClick={() => setGameState(GameState.PLAYING)}
                    className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center
                        ${turn === 'PLAYER' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-red-600 hover:bg-red-500'}
                    `}
                >
                    <Play className="mr-2 fill-current" />
                    VER CARTA
                </button>
             </div>
        </div>
      )
  }

  const isResult = gameState === GameState.RESULT;
  
  const isOpponentMinimized = !isResult && turn === 'PLAYER';
  const isPlayerMinimized = !isResult && turn === 'CPU' && gameMode === GameMode.TWO_PLAYERS;
  
  const opponentHeightClass = isResult 
      ? 'flex-1' 
      : (isOpponentMinimized ? 'h-12 shrink-0' : 'flex-1');
      
  const playerHeightClass = isResult
      ? 'flex-1'
      : (isPlayerMinimized ? 'h-12 shrink-0' : 'flex-1');

  const opponentVariant = isResult ? 'result' : (isOpponentMinimized ? 'minimized' : 'playing');
  const playerVariant = isResult ? 'result' : (isPlayerMinimized ? 'minimized' : 'playing');

  // BOTÃO PRÓXIMA AGORA SEMPRE VISÍVEL NO RESULTADO
  const showNextButton = isResult; 

  return (
    <div className="h-[100dvh] bg-gray-900 flex flex-col overflow-hidden relative">
      {/* HUD */}
      <div className="h-10 bg-black/80 backdrop-blur-md flex items-center justify-between px-3 border-b border-white/10 z-50 shrink-0 text-xs">
         <div className="flex gap-2 items-center text-blue-300 font-bold">
            <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center">{playerDeck.length}</span>
            <span>{isOnline ? 'VOCÊ' : 'P1'} ({scores.player})</span>
         </div>
         <div className="flex items-center gap-1 font-mono text-gray-500 uppercase tracking-widest text-[10px]">
             {isOnline && <Wifi className={`w-3 h-3 ${connectionStatus === 'connected' ? 'text-green-500' : 'text-red-500'}`} />}
            {gameState === GameState.PLAYING ? 'ESCOLHA' : 'RESULTADO'}
         </div>
         <div className="flex gap-2 items-center text-red-300 font-bold">
            <span>{isOnline ? 'RIVAL' : (gameMode === GameMode.SINGLE_PLAYER ? 'CPU' : 'P2')} ({scores.cpu})</span>
            <span className="bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center">{cpuDeck.length}</span>
         </div>
      </div>

       {/* MESSAGE NOTIFICATION - MOVED TO TOP */}
       <div className="absolute top-14 left-0 w-full pointer-events-none z-50 flex justify-center">
         {message && (
            <div className="animate-slide-down bg-black/90 backdrop-blur-xl px-6 py-2 rounded-full border border-white/20 shadow-2xl mx-4">
                <p className={`text-sm md:text-base font-bold drop-shadow-md transition-all duration-300 whitespace-nowrap
                    ${roundWinner === 'PLAYER' ? 'text-green-400' : 
                    roundWinner === 'CPU' ? 'text-red-400' : 'text-white'}
                `}>
                {message}
                </p>
            </div>
         )}
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden bg-gray-950">
        
        {/* Opponent Card Area (Top) */}
        <div className={`w-full transition-all duration-500 ease-in-out relative z-10 ${opponentHeightClass}`}>
            {cpuCard && (
                <Card 
                    key={cpuCard.id}
                    data={cpuCard} 
                    // In Online: Always hide opponent card until result, or if it's minimized
                    isHidden={(gameState === GameState.PLAYING) || (isOnline && gameState !== GameState.RESULT && !isOpponentMinimized)}
                    selectedStat={selectedStat}
                    isWinner={roundWinner === 'CPU'}
                    isLoser={roundWinner === 'PLAYER'}
                    disabled={true} // Opponent card never clickable
                    onSelectStat={() => {}} 
                    label={isOnline ? "Oponente" : (gameMode === GameMode.SINGLE_PLAYER ? "CPU" : "Jogador 2")}
                    variant={opponentVariant}
                />
            )}
        </div>

        {/* Divider / Action Button */}
        {showNextButton && (
             <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 w-full flex justify-center pointer-events-auto">
                 <button 
                 onClick={() => resolveRound(roundWinner || 'DRAW')}
                 className="animate-bounce bg-white text-indigo-900 px-6 py-2 rounded-full font-black shadow-[0_0_20px_rgba(255,255,255,0.5)] flex items-center gap-2 hover:bg-indigo-50 border-4 border-indigo-200 scale-90 md:scale-100"
               >
                 PRÓXIMA <ArrowRight className="w-5 h-5" />
               </button>
            </div>
        )}

        {/* Player Card Area (Bottom) */}
        <div className={`w-full transition-all duration-500 ease-in-out relative z-20 ${playerHeightClass}`}>
            {playerCard && (
                <Card 
                    key={playerCard.id}
                    data={playerCard} 
                    isHidden={false} 
                    onSelectStat={onStatClick}
                    selectedStat={selectedStat}
                    // Disable if not my turn or if showing result
                    disabled={gameState !== GameState.PLAYING || (isOnline && turn === 'CPU') || (!isOnline && turn === 'CPU')}
                    isWinner={roundWinner === 'PLAYER'}
                    isLoser={roundWinner === 'CPU'}
                    label={isOnline ? "Você" : (gameMode === GameMode.TWO_PLAYERS ? "Jogador 1" : "Você")}
                    variant={playerVariant}
                />
            )}
        </div>
        
      </div>
      
      {/* Network Listener Injection */}
      <div className="hidden">
         {/* This is a hack to attach the listener to the peer connection since we are using refs.
             The logic is actually inside useEffect/callbacks, so no UI needed here. */}
      </div>
    </div>
  );
};

export default App;