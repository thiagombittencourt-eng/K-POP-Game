import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_DECK } from './data/groups';
import { CardData, GameState, StatKey, GameMode, HighScore, NetworkMessage } from './types';
import { Card } from './components/Card';
import { Trophy, RefreshCw, Users, Play, Smartphone, User, ArrowRight, Wifi, Copy, CheckCircle, Globe, LogIn, Loader2, XCircle, Zap } from 'lucide-react';
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

  play: (type: 'select' | 'win' | 'lose' | 'draw' | 'gameover' | 'start' | 'ready') => {
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
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.start(t); osc.stop(t + 0.1);
        break;
      case 'ready':
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.linearRampToValueAtTime(800, t + 0.1);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.3);
        osc.start(t); osc.stop(t + 0.3);
        break;
      case 'start':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.linearRampToValueAtTime(600, t + 0.2);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.2);
        osc.start(t); osc.stop(t + 0.2);
        break;
      case 'win':
        // Major Chord
        const wOsc2 = ctx.createOscillator(); const wGain2 = ctx.createGain();
        wOsc2.connect(wGain2); wGain2.connect(ctx.destination);
        osc.type = 'triangle'; osc.frequency.setValueAtTime(523.25, t);
        gain.gain.setValueAtTime(0.05, t); gain.gain.linearRampToValueAtTime(0, t + 0.4);
        wOsc2.type = 'triangle'; wOsc2.frequency.setValueAtTime(659.25, t + 0.1);
        wGain2.gain.setValueAtTime(0.05, t + 0.1); wGain2.gain.linearRampToValueAtTime(0, t + 0.5);
        osc.start(t); osc.stop(t + 0.4); wOsc2.start(t + 0.1); wOsc2.stop(t + 0.5);
        break;
      case 'lose':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.linearRampToValueAtTime(100, t + 0.4);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.4);
        osc.start(t); osc.stop(t + 0.4);
        break;
      case 'draw':
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, t);
        gain.gain.setValueAtTime(0.03, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.2);
        osc.start(t); osc.stop(t + 0.2);
        break;
      case 'gameover':
        osc.type = 'square';
        osc.frequency.setValueAtTime(523.25, t);
        gain.gain.setValueAtTime(0.1, t); gain.gain.linearRampToValueAtTime(0, t+0.2);
        osc.start(t); osc.stop(t + 0.2);
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
  
  // Turn: 'PLAYER' means ME (Local User), 'CPU' means OPPONENT (or AI).
  // In Online Host mode: PLAYER = Host, CPU = Guest
  // In Online Guest mode: PLAYER = Guest, CPU = Host
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
  const [isProcessingMove, setIsProcessingMove] = useState(false);
  
  // Lobby "Ready" States
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isOpponentReady, setIsOpponentReady] = useState(false);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOnline = gameMode === GameMode.ONLINE_HOST || gameMode === GameMode.ONLINE_GUEST;

  // Use refs to track state in event listeners (closure trap)
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Ref for turn and cards to access in callbacks
  const gameDataRef = useRef({ turn, playerCard, cpuCard, playerDeck, cpuDeck });
  useEffect(() => { 
      gameDataRef.current = { turn, playerCard, cpuCard, playerDeck, cpuDeck }; 
  }, [turn, playerCard, cpuCard, playerDeck, cpuDeck]);

  const readyRef = useRef({ player: false, opponent: false });
  useEffect(() => { 
      readyRef.current = { player: isPlayerReady, opponent: isOpponentReady };
      
      // HOST ONLY: Check if both ready to start game
      if (gameMode === GameMode.ONLINE_HOST && isPlayerReady && isOpponentReady && gameState === GameState.LOBBY) {
          startOnlineGameLogic();
      }
  }, [isPlayerReady, isOpponentReady, gameMode, gameState]);


  useEffect(() => {
    const saved = localStorage.getItem('kpop_trunfo_ranking');
    if (saved) {
      setHighScores(JSON.parse(saved));
    }
    return () => {
      if (peerRef.current) peerRef.current.destroy();
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    };
  }, []);

  // Notificação com auto-dismiss
  useEffect(() => {
    if (message && gameState === GameState.PLAYING) {
      const timer = setTimeout(() => {
        setMessage("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, gameState]);

  // --- ONLINE LOGIC ---

  const initializePeer = (isHost: boolean) => {
    if (peerRef.current) peerRef.current.destroy();
    
    setConnectionStatus('connecting');
    setMessage("Conectando ao servidor...");
    setIsPlayerReady(false);
    setIsOpponentReady(false);
    
    const peer = new Peer({
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
      },
      debug: 1
    });
    
    peerRef.current = peer;

    peer.on('open', (id) => {
      setPeerId(id);
      setConnectionStatus('idle');
      if (isHost) {
        setMessage("Aguardando oponente entrar na sala...");
      } else {
        setMessage("Insira o código da sala.");
      }
    });

    peer.on('connection', (conn) => {
      handleConnection(conn);
    });

    peer.on('error', (err: any) => {
      console.warn('PeerJS Error:', err);
      if (err.type === 'peer-unavailable') {
          setConnectionStatus('idle'); 
          setMessage("Sala não encontrada. Verifique o código.");
      } else {
          setConnectionStatus('error');
          setMessage("Erro de conexão. Tente recarregar.");
      }
    });
  };

  const connectToPeer = () => {
    const cleanId = joinId.trim().replace(/\s/g, ''); 
    if (!peerRef.current || !cleanId) return;
    
    setConnectionStatus('connecting');
    setMessage("Buscando sala...");
    
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    connectionTimeoutRef.current = setTimeout(() => {
        if (connectionStatus === 'connecting') {
            setConnectionStatus('error');
            setMessage("Tempo esgotado. Verifique o código.");
            if (connRef.current) connRef.current.close();
        }
    }, 15000);

    const conn = peerRef.current.connect(cleanId, { serialization: 'json' });
    handleConnection(conn);
  };

  const handleConnection = (conn: DataConnection) => {
    connRef.current = conn;

    conn.on('open', () => {
      if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
      }
      setConnectionStatus('connected');
      setMessage("Conectado! Aguardando ambos estarem prontos.");
    });

    conn.on('data', (data: unknown) => {
      handleNetworkMessage(data as NetworkMessage);
    });

    conn.on('close', () => {
      const currentGs = gameStateRef.current;
      if (currentGs === GameState.LOBBY) {
           setConnectionStatus('error');
           setMessage("Oponente saiu da sala.");
           setIsOpponentReady(false);
      } else if (currentGs !== GameState.GAME_OVER) {
           setGameState(GameState.GAME_OVER);
           setMessage("Oponente desconectou do jogo.");
      }
    });
    
    conn.on('error', (err) => {
        console.error("Connection data error", err);
        setMessage("Erro na transmissão de dados.");
    });
  };

  const handlePlayerReady = () => {
      if (!connRef.current || connectionStatus !== 'connected') return;
      
      SoundEffects.play('select');
      setIsPlayerReady(true);
      sendMessage({ type: 'READY' });
  };

  const startOnlineGameLogic = () => {
    // HOST ONLY LOGIC
    SoundEffects.play('start');
    
    const fullDeck = shuffleDeck(INITIAL_DECK);
    const mid = Math.floor(fullDeck.length / 2);
    const pDeck = fullDeck.slice(0, mid); // Host Deck (Real)
    const cDeck = fullDeck.slice(mid);    // Guest Deck (Real - stored on Host to check winner)

    setPlayerDeck(pDeck);
    setCpuDeck(cDeck); // Host keeps Guest's deck to calculate results
    setPlayerCard(pDeck[0]);
    setCpuCard(cDeck[0]);
    setScores({ player: 0, cpu: 0 });
    setTurn('PLAYER'); // Host starts

    // Send Guest their deck
    sendMessage({ type: 'START_GAME', deck: cDeck });

    setGameState(GameState.PLAYING);
    setMessage("Jogo iniciado! Sua vez.");
  };

  const sendMessage = (msg: NetworkMessage) => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send(msg);
    }
  };

  const handleNetworkMessage = (msg: NetworkMessage) => {
    switch (msg.type) {
      case 'READY':
        setIsOpponentReady(true);
        SoundEffects.play('ready');
        break;

      case 'START_GAME':
        // GUEST ONLY: Receives deck from Host
        const myDeck = msg.deck;
        const dummyHostDeck = Array(32 - myDeck.length).fill({ ...myDeck[0], id: 'dummy' });
        
        setPlayerDeck(myDeck);
        setCpuDeck(dummyHostDeck); // Guest only has dummy host deck
        setPlayerCard(myDeck[0]);
        setCpuCard(dummyHostDeck[0]); 
        
        setScores({ player: 0, cpu: 0 });
        setTurn('CPU'); // Host starts (CPU for Guest)
        setGameState(GameState.PLAYING);
        setMessage("Jogo iniciado! Vez do Host.");
        SoundEffects.play('start');
        break;

      case 'GUEST_MOVE':
        // HOST ONLY: Guest sent a move. Host calculates result.
        if (gameMode === GameMode.ONLINE_HOST) {
           calculateAndBroadcastResult(msg.stat);
        }
        break;

      case 'ROUND_RESULT':
        // BOTH RECEIVE (Guest handles ui, Host ignores if it sent it, but good for sync)
        if (gameMode === GameMode.ONLINE_GUEST) {
           applyRoundResult(msg.winner, msg.stat, msg.hostCard, msg.guestCard);
        }
        break;

      case 'NEXT_ROUND':
        if (roundWinner) resolveRound(roundWinner, true);
        break;
        
      case 'RESTART':
        window.location.reload();
        break;
    }
  };

  // --- GAME LOGIC ---

  const calculateAndBroadcastResult = (stat: StatKey) => {
      // Logic runs ONLY on HOST
      // playerCard = Host Card
      // cpuCard = Guest Card (Real data on Host)
      
      const hostCard = playerCard!;
      const guestCard = cpuCard!;
      
      const hostVal = hostCard.stats[stat];
      const guestVal = guestCard.stats[stat];

      let winner: 'PLAYER' | 'CPU' | 'DRAW' = 'DRAW';
      // Note: In Host context: PLAYER = Host, CPU = Guest

      if (stat === 'debutYear') {
        if (hostVal < guestVal) winner = 'PLAYER'; // Host wins (older)
        else if (hostVal > guestVal) winner = 'CPU'; // Guest wins
      } else {
        if (hostVal > guestVal) winner = 'PLAYER';
        else if (hostVal < guestVal) winner = 'CPU';
      }
      
      if (hostVal === guestVal) winner = 'DRAW';

      // Apply locally for Host
      applyRoundResult(winner, stat, hostCard, guestCard);

      // Send result to Guest
      // Important: Translate winner for Guest perspective
      // If Host (PLAYER) wins, Guest receives 'CPU' wins.
      // If Guest (CPU) wins, Guest receives 'PLAYER' wins.
      // Actually, let's keep it consistent: 'PLAYER' in message means HOST won, 'CPU' means GUEST won.
      // We will handle the mapping in applyRoundResult.
      
      // Let's stick to strict roles in message to avoid confusion:
      // We send 'PLAYER' if HOST won, 'CPU' if GUEST won.
      sendMessage({ 
          type: 'ROUND_RESULT', 
          stat, 
          winner, 
          hostCard: hostCard, 
          guestCard: guestCard 
      });
  };

  const applyRoundResult = (
      winnerRole: 'PLAYER' | 'CPU' | 'DRAW', // PLAYER=HOST, CPU=GUEST
      stat: StatKey, 
      hostCardData: CardData, 
      guestCardData: CardData
  ) => {
      setSelectedStat(stat);
      setGameState(GameState.RESULT);
      setIsProcessingMove(false);

      // Update displayed cards
      if (gameMode === GameMode.ONLINE_HOST) {
          // Host already has correct cards, but ensure consistency
          setPlayerCard(hostCardData); 
          setCpuCard(guestCardData);
          setRoundWinner(winnerRole);
          
          if (winnerRole === 'PLAYER') {
             setScores(prev => ({ ...prev, player: prev.player + 1 }));
             setMessage("Você venceu a rodada!");
             SoundEffects.play('win');
          } else if (winnerRole === 'CPU') {
             setScores(prev => ({ ...prev, cpu: prev.cpu + 1 }));
             setMessage("Oponente venceu a rodada!");
             SoundEffects.play('lose');
          } else {
             setMessage("Empate!");
             SoundEffects.play('draw');
          }

      } else if (gameMode === GameMode.ONLINE_GUEST) {
          // Guest: playerCard is Guest, cpuCard is Host
          // Update cards from message
          setPlayerCard(guestCardData); // My card (verified)
          setCpuCard(hostCardData);     // Host card (revealed)

          // Translate Winner Role for Guest
          // Msg PLAYER = Host -> Guest CPU
          // Msg CPU = Guest -> Guest PLAYER
          let localWinner: 'PLAYER' | 'CPU' | 'DRAW' = 'DRAW';
          if (winnerRole === 'PLAYER') localWinner = 'CPU'; // Host won
          else if (winnerRole === 'CPU') localWinner = 'PLAYER'; // Guest won
          
          setRoundWinner(localWinner);

          if (localWinner === 'PLAYER') {
              setScores(prev => ({ ...prev, player: prev.player + 1 }));
              setMessage("Você venceu a rodada!");
              SoundEffects.play('win');
          } else if (localWinner === 'CPU') {
              setScores(prev => ({ ...prev, cpu: prev.cpu + 1 }));
              setMessage("Oponente venceu a rodada!");
              SoundEffects.play('lose');
          } else {
              setMessage("Empate!");
              SoundEffects.play('draw');
          }
      } else {
          // Local modes (handled by performMoveLegacy)
      }
  };


  const startGame = (mode: GameMode) => {
    SoundEffects.init();
    SoundEffects.play('start');

    if (mode === GameMode.ONLINE_HOST || mode === GameMode.ONLINE_GUEST) {
      setGameState(GameState.LOBBY);
      setGameMode(mode);
      initializePeer(mode === GameMode.ONLINE_HOST);
      return;
    }

    // Local Logic (Single/Two Players)
    const fullDeck = shuffleDeck(INITIAL_DECK);
    const mid = Math.floor(fullDeck.length / 2);
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
  
  // Legacy function for offline modes
  const performMoveLegacy = (stat: StatKey) => {
    setSelectedStat(stat);
    setGameState(GameState.RESULT);

    const pVal = playerCard!.stats[stat];
    const cVal = cpuCard!.stats[stat];

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
    
    if (winner === 'PLAYER') setScores(prev => ({ ...prev, player: prev.player + 1 }));
    if (winner === 'CPU') setScores(prev => ({ ...prev, cpu: prev.cpu + 1 }));

    const winnerName = winner === 'PLAYER' ? 'Você' : 'Oponente';
    const msg = winner === 'DRAW' ? 'Empate!' : `${winnerName} venceu a rodada!`;
    setMessage(msg);
  }

  const onStatClick = (stat: StatKey) => {
      SoundEffects.play('select');
      
      if (isOnline) {
          // If it's not my turn, ignore
          if (turn === 'CPU') return;
          
          setIsProcessingMove(true);
          
          if (gameMode === GameMode.ONLINE_HOST) {
              // Host plays directly
              calculateAndBroadcastResult(stat);
          } else {
              // Guest requests move
              sendMessage({ type: 'GUEST_MOVE', stat });
              setMessage("Aguardando resultado...");
          }
      } else {
          performMoveLegacy(stat);
      }
  }

  const resolveRound = (winner: 'PLAYER' | 'CPU' | 'DRAW', fromNetwork = false) => {
    if (!playerCard || !cpuCard) return;
    
    SoundEffects.play('select'); 

    if (isOnline && !fromNetwork) {
        sendMessage({ type: 'NEXT_ROUND' });
    }

    const newPlayerDeck = [...playerDeck];
    const newCpuDeck = [...cpuDeck]; 
    newPlayerDeck.shift();
    newCpuDeck.shift();

    if (newPlayerDeck.length === 0) {
        finishGame();
    } else {
        setPlayerDeck(newPlayerDeck);
        setCpuDeck(newCpuDeck);
        setPlayerCard(newPlayerDeck[0]);
        setCpuCard(newCpuDeck[0]);
        
        // Determine Turn
        let nextTurn: 'PLAYER' | 'CPU' = turn; // Default keep turn on draw
        if (winner === 'PLAYER') nextTurn = 'PLAYER';
        else if (winner === 'CPU') nextTurn = 'CPU';
        
        setTurn(nextTurn);
        
        setSelectedStat(null);
        setRoundWinner(null);

        if (gameMode === GameMode.TWO_PLAYERS) {
            setGameState(GameState.WAITING_NEXT_TURN);
            setMessage(`Rodada finalizada. Passe para ${winner === 'PLAYER' ? 'Jogador 1' : 'Jogador 2'}`);
        } else {
            setGameState(GameState.PLAYING);
            // Dynamic message based on who is playing
            if (nextTurn === 'PLAYER') setMessage("Sua vez! Escolha um atributo.");
            else setMessage("Vez do Oponente...");
        }
    }
  };

  const saveHighScore = (name: string, score: number) => {
    const newScore: HighScore = {
      name,
      roundsWon: score,
      date: new Date().toLocaleDateString(),
    };
    
    const updatedScores = [...highScores, newScore]
      .sort((a, b) => b.roundsWon - a.roundsWon)
      .slice(0, 5);

    setHighScores(updatedScores);
    localStorage.setItem('kpop_trunfo_ranking', JSON.stringify(updatedScores));
  };

  const finishGame = () => {
      SoundEffects.play('gameover');
      setGameState(GameState.GAME_OVER);
      
      let winnerName = "";
      let finalMessage = "";

      if (scores.player > scores.cpu) {
           winnerName = gameMode === GameMode.SINGLE_PLAYER ? 'Você' : (isOnline ? 'Você' : 'Jogador 1');
           finalMessage = `${winnerName} venceu por pontos (${scores.player} x ${scores.cpu})!`;
           if (gameMode === GameMode.SINGLE_PLAYER) saveHighScore('Jogador', scores.player);
      } else if (scores.cpu > scores.player) {
           winnerName = gameMode === GameMode.SINGLE_PLAYER ? 'CPU' : (isOnline ? 'Oponente' : 'Jogador 2');
           finalMessage = `${winnerName} venceu por pontos (${scores.cpu} x ${scores.player})!`;
      } else {
           finalMessage = `Empate no placar final! (${scores.player} x ${scores.cpu})`;
      }

      setMessage(finalMessage);
      if (isOnline) {
         if (peerRef.current) peerRef.current.destroy();
      }
  };

  // CPU AI (Only for Single Player)
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
            performMoveLegacy(bestStat);
        }, 1500);
        return () => clearTimeout(timer);
    }
  }, [turn, gameState, cpuCard, gameMode]);


  // --- RENDERS ---

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
      </div>
    );
  }

  // --- NEW LOBBY SCREEN WITH VIRTUAL WAITING ROOM ---
  if (gameState === GameState.LOBBY) {
      return (
        <div className="h-[100dvh] flex flex-col items-center justify-center bg-gray-900 p-6 relative">
            <button onClick={() => { setGameState(GameState.START); if (peerRef.current) peerRef.current.destroy(); }} className="absolute top-4 left-4 text-white/50 hover:text-white flex items-center gap-2">
                <XCircle className="w-6 h-6" /> Sair
            </button>
            
            <div className="w-full max-w-2xl bg-gray-800/80 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl text-center">
                <h2 className="text-3xl font-bold text-white mb-2">Sala de Espera</h2>
                <p className="text-gray-400 mb-8">{gameMode === GameMode.ONLINE_HOST ? 'Você é o Anfitrião' : 'Você é o Convidado'}</p>

                {/* --- VIRTUAL ROOM AVATARS --- */}
                <div className="flex justify-center items-center gap-8 mb-8">
                    
                    {/* YOU */}
                    <div className="flex flex-col items-center gap-3">
                        <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center relative bg-gray-700 ${isPlayerReady ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]' : 'border-blue-400'}`}>
                            <User className="w-12 h-12 text-white" />
                            {isPlayerReady && <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-1"><CheckCircle className="w-5 h-5 text-white" /></div>}
                        </div>
                        <span className="font-bold text-white">VOCÊ</span>
                        <span className={`text-xs uppercase px-2 py-1 rounded ${isPlayerReady ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                            {isPlayerReady ? 'PRONTO' : 'AGUARDANDO'}
                        </span>
                    </div>

                    <div className="flex flex-col items-center">
                         <div className="h-[2px] w-10 bg-white/10"></div>
                         <div className="p-2 bg-black/40 rounded-full border border-white/10 my-2">
                            <span className="font-mono text-xs text-yellow-500">VS</span>
                         </div>
                         <div className="h-[2px] w-10 bg-white/10"></div>
                    </div>

                    {/* OPPONENT */}
                    <div className="flex flex-col items-center gap-3">
                        <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center relative transition-all
                            ${connectionStatus === 'connected' 
                                ? (isOpponentReady ? 'border-green-500 bg-gray-700 shadow-[0_0_20px_rgba(34,197,94,0.5)]' : 'border-red-400 bg-gray-700') 
                                : 'border-white/10 border-dashed bg-transparent'}
                        `}>
                            {connectionStatus === 'connected' ? (
                                <User className="w-12 h-12 text-white" />
                            ) : (
                                <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
                            )}
                            {isOpponentReady && <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-1"><CheckCircle className="w-5 h-5 text-white" /></div>}
                        </div>
                        <span className="font-bold text-white">{connectionStatus === 'connected' ? 'OPONENTE' : '...'}</span>
                         <span className={`text-xs uppercase px-2 py-1 rounded 
                            ${connectionStatus !== 'connected' ? 'text-transparent' : 
                              isOpponentReady ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                            {isOpponentReady ? 'PRONTO' : 'AGUARDANDO'}
                        </span>
                    </div>

                </div>

                {/* --- CONNECTION STATUS & CONTROLS --- */}
                <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                    {connectionStatus === 'connecting' && <div className="flex items-center justify-center gap-2 text-yellow-400"><Loader2 className="animate-spin" /> Conectando...</div>}
                    {connectionStatus === 'error' && <p className="text-red-400">{message}</p>}
                    
                    {/* HOST CONTROLS */}
                    {gameMode === GameMode.ONLINE_HOST && (
                        <>
                            {connectionStatus === 'idle' && peerId && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 bg-black/50 p-4 rounded-xl border border-white/10 group">
                                        <code className="text-2xl font-mono text-emerald-400 tracking-wider flex-1">{peerId}</code>
                                        <button 
                                            onClick={() => { navigator.clipboard.writeText(peerId); setMessage("Código copiado!"); }}
                                            className="p-2 hover:bg-white/10 rounded-lg"
                                        >
                                            <Copy className="w-5 h-5 text-gray-400 group-hover:text-white" />
                                        </button>
                                    </div>
                                    <p className="text-sm text-gray-400 animate-pulse">Compartilhe o código e aguarde o oponente...</p>
                                </div>
                            )}
                        </>
                    )}

                    {/* GUEST CONTROLS */}
                    {gameMode === GameMode.ONLINE_GUEST && connectionStatus === 'idle' && (
                        <div className="space-y-4">
                            <input 
                                type="text" 
                                value={joinId}
                                onChange={(e) => setJoinId(e.target.value)}
                                placeholder="Cole o código do anfitrião"
                                className="w-full bg-black/50 border border-white/20 rounded-xl p-4 text-center text-white font-mono text-lg focus:outline-none focus:border-emerald-500"
                            />
                            <button
                                onClick={connectToPeer}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                            >
                                <Zap className="w-5 h-5" /> Entrar na Sala
                            </button>
                        </div>
                    )}

                    {/* READY BUTTON (SHOWN WHEN CONNECTED) */}
                    {connectionStatus === 'connected' && (
                        <div className="mt-4 animate-slide-up">
                            {!isPlayerReady ? (
                                <button
                                    onClick={handlePlayerReady}
                                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xl rounded-xl shadow-lg transform hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
                                >
                                    <CheckCircle className="w-6 h-6" /> ESTOU PRONTO!
                                </button>
                            ) : (
                                <div className="p-4 bg-green-900/30 border border-green-500/30 rounded-xl text-green-400 font-bold animate-pulse">
                                    {isOpponentReady ? 'Iniciando jogo...' : 'Aguardando oponente ficar pronto...'}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
      );
  }

  // --- GAME OVER / WAITING SCREENS ---

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

  const showNextButton = isResult; 

  return (
    <div className="h-[100dvh] bg-gray-900 flex flex-col overflow-hidden relative">
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
        
        <div className={`w-full transition-all duration-500 ease-in-out relative z-10 ${opponentHeightClass}`}>
            {cpuCard && (
                <Card 
                    key={cpuCard.id}
                    data={cpuCard} 
                    isHidden={(gameState === GameState.PLAYING) || (isOnline && gameState !== GameState.RESULT && !isOpponentMinimized)}
                    selectedStat={selectedStat}
                    isWinner={roundWinner === 'CPU'}
                    isLoser={roundWinner === 'PLAYER'}
                    disabled={true} 
                    onSelectStat={() => {}} 
                    label={isOnline ? "Oponente" : (gameMode === GameMode.SINGLE_PLAYER ? "CPU" : "Jogador 2")}
                    variant={opponentVariant}
                />
            )}
        </div>

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

        <div className={`w-full transition-all duration-500 ease-in-out relative z-20 ${playerHeightClass}`}>
            {playerCard && (
                <Card 
                    key={playerCard.id}
                    data={playerCard} 
                    isHidden={false} 
                    onSelectStat={onStatClick}
                    selectedStat={selectedStat}
                    disabled={gameState !== GameState.PLAYING || (isOnline && turn === 'CPU') || (!isOnline && turn === 'CPU') || isProcessingMove}
                    isWinner={roundWinner === 'PLAYER'}
                    isLoser={roundWinner === 'CPU'}
                    label={isOnline ? "Você" : (gameMode === GameMode.TWO_PLAYERS ? "Jogador 1" : "Você")}
                    variant={playerVariant}
                />
            )}
        </div>
        
      </div>
    </div>
  );
};

export default App;