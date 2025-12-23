import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_DECK } from './data/groups';
import { CardData, GameState, StatKey, GameMode, HighScore, NetworkMessage } from './types';
import { Card } from './components/Card';
import { Trophy, RefreshCw, Users, Play, Smartphone, User, ArrowRight, Wifi, Copy, CheckCircle, Globe, LogIn, Loader2, XCircle, Zap, Music, Star, Volume2, VolumeX } from 'lucide-react';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';

// --- SOUND MANAGER (Web Audio API for SFX) ---
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
    // Try to init if missing
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

// Generic dummy card for guest view of host deck
const DUMMY_CARD: CardData = {
    id: '???',
    name: 'AGUARDANDO...',
    imageColor: 'from-gray-700 via-gray-800 to-black',
    imageUrl: '', // Empty or placeholder
    stats: { members: 0, albums: 0, debutYear: 0, fame: 0, awards: 0 }
};

// Primary: CodeSkulptor Demo (MP3)
const BG_MUSIC_URL = "https://codeskulptor-demos.commondatastorage.googleapis.com/GalaxyInvaders/theme_01.mp3"; 
// Fallback: Google Actions Sci-Fi Underscore (OGG) - Highly Reliable
const FALLBACK_MUSIC_URL = "https://actions.google.com/sounds/v1/science_fiction/science_fiction_music_underscore.ogg";

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.SINGLE_PLAYER);
  
  const [playerDeck, setPlayerDeck] = useState<CardData[]>([]);
  const [cpuDeck, setCpuDeck] = useState<CardData[]>([]);
  
  const [playerCard, setPlayerCard] = useState<CardData | null>(null);
  const [cpuCard, setCpuCard] = useState<CardData | null>(null);
  
  // Turn: 'PLAYER' means ME (Local User), 'CPU' means OPPONENT (or AI).
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

  // -- Music State --
  const [isMusicOn, setIsMusicOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOnline = gameMode === GameMode.ONLINE_HOST || gameMode === GameMode.ONLINE_GUEST;

  // Ref to current handleNetworkMessage to avoid stale closures in event listeners
  const handleNetworkMessageRef = useRef<(msg: NetworkMessage) => void>(() => {});

  useEffect(() => {
    const saved = localStorage.getItem('kpop_trunfo_ranking');
    if (saved) {
      setHighScores(JSON.parse(saved));
    }
    
    // Initialize Music Object once
    if (!audioRef.current) {
        const audio = new Audio(BG_MUSIC_URL);
        audio.loop = true;
        audio.volume = 0.4; 
        // NOTE: crossOrigin removed to avoid CORS "no supported sources" errors on certain CDNs
        audio.preload = 'auto'; 
        
        audio.addEventListener('canplaythrough', () => {
             console.log("Audio loaded and ready.");
        }, { once: true });

        // Robust Error Handling with Fallback
        audio.onerror = (e) => {
            console.warn("Audio load error event:", e);
            if (audio.src === BG_MUSIC_URL) {
                console.log("Attempting fallback music source...");
                audio.src = FALLBACK_MUSIC_URL;
                audio.load();
                // If it was supposed to be playing, try playing again
                if (isMusicOn) {
                    audio.play().catch(err => console.error("Fallback play failed", err));
                }
            }
        };

        audioRef.current = audio;
    }

    return () => {
      if (peerRef.current) peerRef.current.destroy();
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMusic = () => {
      // 1. Init SFX Context
      SoundEffects.init();

      // 2. Handle Background Music
      if (!audioRef.current) return;

      if (isMusicOn) {
          // If it's on, pause it
          audioRef.current.pause();
          setIsMusicOn(false);
      } else {
          // If it's off, play it (DIRECTLY inside the click event)
          const playPromise = audioRef.current.play();
          
          if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    setIsMusicOn(true);
                })
                .catch(error => {
                    console.error("Music Playback Error:", error);
                    setIsMusicOn(false); 
                    // Optional: Don't show alert to user to avoid annoyance, just log it.
                    // If strictly needed: setMessage("Erro ao reproduzir áudio.");
                });
          }
      }
  };

  // Notificação com auto-dismiss
  useEffect(() => {
    if (message && gameState === GameState.PLAYING) {
      const timer = setTimeout(() => {
        setMessage("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, gameState]);

  // Check for Ready Start (Host Side mostly)
  useEffect(() => { 
      if (gameMode === GameMode.ONLINE_HOST && isPlayerReady && isOpponentReady && gameState === GameState.LOBBY) {
          startOnlineGameLogic();
      }
  }, [isPlayerReady, isOpponentReady, gameMode, gameState]);


  // --- ONLINE LOGIC ---

  const initializePeer = (isHost: boolean) => {
    if (peerRef.current) peerRef.current.destroy();
    
    setConnectionStatus('connecting');
    setMessage("Conectando ao servidor...");
    setIsPlayerReady(false);
    setIsOpponentReady(false);
    
    try {
        const peer = new Peer({
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
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
    } catch (e) {
        console.error("PeerJS initialization failed", e);
        setMessage("Erro ao iniciar modo online.");
        setConnectionStatus('error');
    }
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
      handleNetworkMessageRef.current(data as NetworkMessage);
    });

    conn.on('close', () => {
      setConnectionStatus(prev => {
          if (prev === 'connected') {
             setGameState(GameState.GAME_OVER);
             setMessage("Oponente desconectou do jogo.");
             return 'error';
          }
          return 'error';
      });
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
    setScores({ player: pDeck.length, cpu: cDeck.length });
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
        // GUEST ONLY
        const myDeck = msg.deck;
        const dummyHostDeck = Array(32 - myDeck.length).fill(DUMMY_CARD);
        
        setPlayerDeck(myDeck);
        setCpuDeck(dummyHostDeck);
        setPlayerCard(myDeck[0]);
        setCpuCard(dummyHostDeck[0]); 
        
        setScores({ player: myDeck.length, cpu: dummyHostDeck.length });
        setTurn('CPU'); // Host starts (CPU for Guest)
        setGameState(GameState.PLAYING);
        setMessage("Jogo iniciado! Vez do Host.");
        SoundEffects.play('start');
        break;

      case 'GUEST_MOVE':
        // HOST ONLY
        if (gameMode === GameMode.ONLINE_HOST) {
           calculateAndBroadcastResult(msg.stat);
        }
        break;

      case 'ROUND_RESULT':
        // BOTH RECEIVE
        if (gameMode === GameMode.ONLINE_GUEST) {
           applyRoundResult(msg.winner, msg.stat, msg.hostCard, msg.guestCard);
        }
        break;

      case 'NEXT_ROUND':
        if (roundWinner) resolveRound(roundWinner, true);
        break;
        
      case 'RESTART':
        if (gameMode === GameMode.ONLINE_HOST) {
             setMessage("Oponente pediu revanche! Reiniciando...");
             setTimeout(() => {
                 startOnlineGameLogic();
             }, 1500);
        }
        break;
    }
  };

  useEffect(() => {
    handleNetworkMessageRef.current = handleNetworkMessage;
  });

  // --- GAME LOGIC ---

  const calculateAndBroadcastResult = (stat: StatKey) => {
      // HOST LOGIC
      const hostCard = playerCard;
      const guestCard = cpuCard;
      
      if (!hostCard || !guestCard) return;

      const hostVal = hostCard.stats[stat];
      const guestVal = guestCard.stats[stat];

      let winner: 'PLAYER' | 'CPU' | 'DRAW' = 'DRAW';

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
      sendMessage({ 
          type: 'ROUND_RESULT', 
          stat, 
          winner, 
          hostCard: hostCard, 
          guestCard: guestCard 
      });
  };

  const applyRoundResult = (
      winnerRole: 'PLAYER' | 'CPU' | 'DRAW', 
      stat: StatKey, 
      hostCardData: CardData, 
      guestCardData: CardData
  ) => {
      setSelectedStat(stat);
      setGameState(GameState.RESULT);
      setIsProcessingMove(false);

      if (gameMode === GameMode.ONLINE_HOST) {
          setPlayerCard(hostCardData); 
          setCpuCard(guestCardData);
          setRoundWinner(winnerRole);
          
          if (winnerRole === 'PLAYER') {
             setMessage("Você venceu a rodada!");
             SoundEffects.play('win');
          } else if (winnerRole === 'CPU') {
             setMessage("Oponente venceu a rodada!");
             SoundEffects.play('lose');
          } else {
             setMessage("Empate!");
             SoundEffects.play('draw');
          }

      } else if (gameMode === GameMode.ONLINE_GUEST) {
          setPlayerCard(guestCardData); 
          setCpuCard(hostCardData);     

          let localWinner: 'PLAYER' | 'CPU' | 'DRAW' = 'DRAW';
          if (winnerRole === 'PLAYER') localWinner = 'CPU'; // Host won
          else if (winnerRole === 'CPU') localWinner = 'PLAYER'; // Guest won
          else localWinner = 'DRAW';
          
          setRoundWinner(localWinner);

          if (localWinner === 'PLAYER') {
              setMessage("Você venceu a rodada!");
              SoundEffects.play('win');
          } else if (localWinner === 'CPU') {
              setMessage("Oponente venceu a rodada!");
              SoundEffects.play('lose');
          } else {
              setMessage("Empate!");
              SoundEffects.play('draw');
          }
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
    setScores({ player: pDeck.length, cpu: cDeck.length });
    setPlayerCard(pDeck[0]);
    setCpuCard(cDeck[0]);
    setTurn('PLAYER');
    setGameState(mode === GameMode.TWO_PLAYERS ? GameState.WAITING_NEXT_TURN : GameState.PLAYING);
    setMessage(mode === GameMode.TWO_PLAYERS ? "Passe o aparelho para Jogador 1" : "Sua vez! Escolha um atributo.");
    setSelectedStat(null);
    setRoundWinner(null);
  };
  
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
      // Draw Logic: usually advantage to player who chose, or strict draw.
      // We'll treat as strict draw for visual, but turn stays.
      winner = 'DRAW';
      setMessage("Empate!");
      SoundEffects.play('draw');
    } else if (winner === 'PLAYER') {
      SoundEffects.play('win');
      setMessage("Você venceu a rodada!");
    } else {
      SoundEffects.play('lose');
      setMessage("Oponente venceu a rodada!");
    }

    setRoundWinner(winner);
  }

  const onStatClick = (stat: StatKey) => {
      SoundEffects.play('select');
      
      if (isOnline) {
          if (turn === 'CPU') return;
          setIsProcessingMove(true);
          
          if (gameMode === GameMode.ONLINE_HOST) {
              calculateAndBroadcastResult(stat);
          } else {
              sendMessage({ type: 'GUEST_MOVE', stat });
              setMessage("Aguardando resultado...");
          }
      } else {
          performMoveLegacy(stat);
      }
  }

  // --- UPDATED RESOLVE ROUND LOGIC (SUPER TRUNFO RULES: WINNER TAKES ALL) ---
  const resolveRound = (winner: 'PLAYER' | 'CPU' | 'DRAW', fromNetwork = false) => {
    if (!playerCard || !cpuCard) return;
    
    SoundEffects.play('select'); 

    if (isOnline && !fromNetwork) {
        sendMessage({ type: 'NEXT_ROUND' });
    }

    const currentPDeck = [...playerDeck];
    const currentCDeck = [...cpuDeck];
    
    // 1. Remove played cards from top
    const pCard = currentPDeck.shift(); // The card just played
    const cCard = currentCDeck.shift(); // The opponent's card just played

    if (!pCard || !cCard) return; // Safety

    // 2. Add cards to winner's deck (at bottom)
    if (winner === 'PLAYER') {
        currentPDeck.push(pCard, cCard);
        setTurn('PLAYER'); // Winner plays
    } else if (winner === 'CPU') {
        currentCDeck.push(cCard, pCard);
        setTurn('CPU'); // Winner plays
    } else {
        // DRAW: Both keep their cards (put at bottom)
        // Alternative rule: they go to a temporary pot. 
        // Simple rule: Return to owner's bottom.
        currentPDeck.push(pCard);
        currentCDeck.push(cCard);
        // Turn keeps with who selected (or swap? let's keep turn)
    }

    // 3. Update scores (Deck size)
    setScores({ player: currentPDeck.length, cpu: currentCDeck.length });

    // 4. Check Victory Condition (Empty Deck)
    if (currentPDeck.length === 0) {
        setCpuDeck(currentCDeck);
        setPlayerDeck(currentPDeck);
        finishGame(false); // Player Lost
        return;
    } 
    if (currentCDeck.length === 0) {
        setCpuDeck(currentCDeck);
        setPlayerDeck(currentPDeck);
        finishGame(true); // Player Won
        return;
    }

    // 5. Proceed to next round
    setPlayerDeck(currentPDeck);
    setCpuDeck(currentCDeck);
    setPlayerCard(currentPDeck[0]);
    setCpuCard(currentCDeck[0]);
    
    setSelectedStat(null);
    setRoundWinner(null);

    if (gameMode === GameMode.TWO_PLAYERS) {
        setGameState(GameState.WAITING_NEXT_TURN);
        const winnerName = winner === 'PLAYER' ? 'Jogador 1' : 'Jogador 2';
        const drawText = winner === 'DRAW' ? 'Empate' : `${winnerName} venceu`;
        setMessage(`${drawText}. Passe o aparelho para o próximo.`);
    } else {
        setGameState(GameState.PLAYING);
        // Update Message based on Turn
        if (winner === 'PLAYER' || (winner === 'DRAW' && turn === 'PLAYER')) {
             setMessage("Sua vez! Escolha um atributo.");
        } else {
             setMessage("Vez do Oponente...");
        }
    }
  };

  const saveHighScore = (name: string, score: number) => {
    // Score in Super Trunfo can be total cards or just a win record
    // We'll save just the win.
    const newScore: HighScore = {
      name,
      roundsWon: score, // Saving cards count or just 1 for win? Saving Deck Size (usually 32)
      date: new Date().toLocaleDateString(),
    };
    
    const updatedScores = [...highScores, newScore]
      .sort((a, b) => b.roundsWon - a.roundsWon)
      .slice(0, 5);

    setHighScores(updatedScores);
    localStorage.setItem('kpop_trunfo_ranking', JSON.stringify(updatedScores));
  };

  const finishGame = (playerWon: boolean) => {
      SoundEffects.play('gameover');
      setGameState(GameState.GAME_OVER);
      
      let winnerName = "";
      let finalMessage = "";

      if (playerWon) {
           winnerName = gameMode === GameMode.SINGLE_PLAYER ? 'Você' : (isOnline ? 'Você' : 'Jogador 1');
           finalMessage = `Parabéns! ${winnerName} conquistou todas as cartas!`;
           if (gameMode === GameMode.SINGLE_PLAYER) saveHighScore('Jogador', 32);
      } else {
           winnerName = gameMode === GameMode.SINGLE_PLAYER ? 'CPU' : (isOnline ? 'Oponente' : 'Jogador 2');
           finalMessage = `Fim de jogo! ${winnerName} conquistou todas as cartas.`;
      }

      setMessage(finalMessage);
  };

  // CPU AI (Only for Single Player)
  useEffect(() => {
    if (gameMode === GameMode.SINGLE_PLAYER && turn === 'CPU' && gameState === GameState.PLAYING && cpuCard) {
        setMessage("CPU está escolhendo...");
        const timer = setTimeout(() => {
            const stats = cpuCard.stats;
            const keys = Object.keys(stats) as StatKey[];
            // Simple AI: pick best relative stat
            let bestStat: StatKey = 'members';
            let bestScore = -Infinity;
            
            keys.forEach(key => {
                let score = 0;
                const val = stats[key];
                // Normalize roughly
                if (key === 'fame') score = val; // 1-40
                else if (key === 'debutYear') score = (2025 - val) * 2; // Younger is worse usually in this logic? No, wait. 
                // debutYear: Lower is better (Older group) in our logic.
                // So (2025 - val) makes older groups (e.g. 2005 -> 20) have higher score than newer (2022 -> 3).
                else if (key === 'members') score = val * 3;
                else if (key === 'albums') score = val * 4;
                else if (key === 'awards') score = val / 5; // Awards can be 400+, scale down
                
                // Add randomness so AI isn't perfect
                score += (Math.random() * 5); 

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
      <div className="h-[100dvh] flex flex-col items-center justify-center p-4 bg-[#0a0a0a] text-center overflow-hidden relative">
        
        {/* --- VIBRANT BACKGROUND --- */}
        <div className="absolute inset-0 z-0">
            <div className="absolute top-[-30%] left-[-20%] w-[80%] h-[80%] bg-purple-600/30 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-30%] right-[-20%] w-[80%] h-[80%] bg-pink-600/30 rounded-full blur-[120px] animate-pulse delay-1000"></div>
            <div className="absolute top-[30%] left-[30%] w-[50%] h-[50%] bg-cyan-500/20 rounded-full blur-[100px] animate-pulse delay-700"></div>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-40 mix-blend-screen"></div>
        </div>

        {/* --- STAGE LIGHTS --- */}
        <div className="absolute inset-0 pointer-events-none z-0 opacity-60 mix-blend-screen">
           <div className="absolute top-[-10%] left-1/2 w-1 h-[150%] bg-gradient-to-b from-transparent via-cyan-400 to-transparent transform -rotate-[35deg] origin-top blur-[2px] animate-spotlight-l"></div>
           <div className="absolute top-[-10%] left-1/2 w-1 h-[150%] bg-gradient-to-b from-transparent via-fuchsia-400 to-transparent transform rotate-[35deg] origin-top blur-[2px] animate-spotlight-r"></div>
        </div>

        {/* --- MUSIC TOGGLE --- */}
        <button 
            onClick={toggleMusic}
            className={`absolute top-4 right-4 z-50 p-3 rounded-full border border-white/20 backdrop-blur-md transition-all duration-300 hover:scale-110
                ${isMusicOn ? 'bg-pink-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.6)]' : 'bg-black/40 text-gray-400 hover:text-white'}
            `}
        >
            {isMusicOn ? <Volume2 className="w-6 h-6 animate-pulse" /> : <VolumeX className="w-6 h-6" />}
        </button>

        {/* --- MAIN CONTENT --- */}
        <div className="mb-12 relative z-20">
           <div className="absolute -inset-10 bg-gradient-to-r from-pink-500/30 to-purple-500/30 rounded-full blur-3xl opacity-70 animate-pulse"></div>
           
           <div className="relative transform hover:scale-105 transition-transform duration-500 group">
                <div className="flex justify-center items-center gap-3 mb-4">
                    <Star className="w-8 h-8 text-yellow-300 animate-spin-slow fill-yellow-300" />
                    <Music className="w-10 h-10 text-pink-400 animate-bounce" />
                    <Star className="w-8 h-8 text-cyan-300 animate-spin-slow fill-cyan-300 delay-150" />
                </div>
                
                <h1 className="text-7xl md:text-9xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-yellow-400 drop-shadow-[0_0_25px_rgba(236,72,153,0.6)] tracking-tighter leading-none">
                    K-POP
                </h1>
                
                <div className="relative">
                     <div className="text-3xl md:text-5xl font-black text-white tracking-[0.2em] mt-2 drop-shadow-[0_5px_5px_rgba(0,0,0,1)] uppercase italic transform -skew-x-12">
                        SUPER TRUNFO
                    </div>
                </div>
           </div>
        </div>
        
        {/* BUTTONS */}
        <div className="flex flex-col gap-4 w-full max-w-sm mb-32 z-30 relative">
            <button 
            onClick={() => startGame(GameMode.SINGLE_PLAYER)}
            className="group relative overflow-hidden flex items-center justify-center px-8 py-5 text-lg font-black text-white transition-all duration-300 bg-black/40 border-2 border-pink-500 rounded-full hover:bg-pink-600 hover:border-pink-400 hover:shadow-[0_0_40px_rgba(236,72,153,0.8)] active:scale-95 backdrop-blur-md"
            >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_1s_infinite]"></div>
            <Smartphone className="mr-3 w-6 h-6 group-hover:rotate-12 transition-transform" />
            <span className="tracking-wide">1 JOGADOR</span>
            </button>

            <button 
            onClick={() => startGame(GameMode.TWO_PLAYERS)}
            className="group relative overflow-hidden flex items-center justify-center px-8 py-5 text-lg font-black text-white transition-all duration-300 bg-black/40 border-2 border-cyan-500 rounded-full hover:bg-cyan-600 hover:border-cyan-400 hover:shadow-[0_0_40px_rgba(34,211,238,0.8)] active:scale-95 backdrop-blur-md"
            >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_1s_infinite]"></div>
            <Users className="mr-3 w-6 h-6 group-hover:rotate-12 transition-transform" />
            <span className="tracking-wide">2 JOGADORES</span>
            </button>

            <div className="grid grid-cols-2 gap-3 mt-2">
                <button 
                onClick={() => startGame(GameMode.ONLINE_HOST)}
                className="group relative flex items-center justify-center px-4 py-4 text-sm font-bold text-white transition-all duration-300 bg-black/40 border border-emerald-500 rounded-2xl hover:bg-emerald-600 hover:shadow-[0_0_20px_rgba(16,185,129,0.6)] active:scale-95 backdrop-blur-md"
                >
                <Globe className="mr-2 w-4 h-4 text-emerald-300 group-hover:text-white" />
                CRIAR SALA
                </button>
                <button 
                onClick={() => startGame(GameMode.ONLINE_GUEST)}
                className="group relative flex items-center justify-center px-4 py-4 text-sm font-bold text-white transition-all duration-300 bg-black/40 border border-violet-500 rounded-2xl hover:bg-violet-600 hover:shadow-[0_0_20px_rgba(139,92,246,0.6)] active:scale-95 backdrop-blur-md"
                >
                <LogIn className="mr-2 w-4 h-4 text-violet-300 group-hover:text-white" />
                ENTRAR
                </button>
            </div>
        </div>

        {/* --- DANCERS --- */}
        <div className="absolute bottom-0 left-0 w-full h-[40vh] z-10 pointer-events-none flex items-end justify-center overflow-hidden">
             <div className="absolute bottom-0 w-full h-full bg-gradient-to-t from-fuchsia-900 via-purple-900/30 to-transparent opacity-80"></div>
             <div className="absolute bottom-[-20px] md:bottom-[-40px] flex items-end justify-center gap-6 md:gap-12 opacity-100 z-20">
                 {[0, 1, 2, 3, 4].map((i) => (
                     <div key={`front-${i}`} 
                          className="shadow-dancer text-black transform origin-bottom animate-dance" 
                          style={{ 
                              animationDelay: `${i * 0.15}s`, 
                              transform: `scale(${i === 2 ? 1.1 : 0.95})`, 
                              filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))' 
                          }}>
                         <User size={180 + (i === 2 ? 40 : 0)} fill="#000000" strokeWidth={0} />
                     </div>
                 ))}
             </div>
        </div>
      </div>
    );
  }

  // --- LOBBY ---
  if (gameState === GameState.LOBBY) {
      return (
        <div className="h-[100dvh] flex flex-col items-center justify-center bg-gray-900 p-6 relative">
             <button 
                onClick={toggleMusic}
                className={`absolute top-4 right-4 z-50 p-2 rounded-full border border-white/20 backdrop-blur-md transition-all duration-300
                    ${isMusicOn ? 'bg-pink-600 text-white' : 'bg-black/40 text-gray-400'}
                `}
            >
                {isMusicOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>

            <button onClick={() => { setGameState(GameState.START); if (peerRef.current) peerRef.current.destroy(); }} className="absolute top-4 left-4 text-white/50 hover:text-white flex items-center gap-2">
                <XCircle className="w-6 h-6" /> Sair
            </button>
            
            <div className="w-full max-w-2xl bg-gray-800/80 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl text-center">
                <h2 className="text-3xl font-bold text-white mb-2">Sala de Espera</h2>
                <p className="text-gray-400 mb-8">{gameMode === GameMode.ONLINE_HOST ? 'Você é o Anfitrião' : 'Você é o Convidado'}</p>

                <div className="flex justify-center items-center gap-8 mb-8">
                    {/* YOU */}
                    <div className="flex flex-col items-center gap-3">
                        <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center relative bg-gray-700 ${isPlayerReady ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]' : 'border-blue-400'}`}>
                            <User className="w-12 h-12 text-white" />
                            {isPlayerReady && <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-1"><CheckCircle className="w-5 h-5 text-white" /></div>}
                        </div>
                        <span className="font-bold text-white">VOCÊ</span>
                    </div>

                    <div className="font-mono text-yellow-500">VS</div>

                    {/* OPPONENT */}
                    <div className="flex flex-col items-center gap-3">
                        <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center relative transition-all
                            ${connectionStatus === 'connected' 
                                ? (isOpponentReady ? 'border-green-500 bg-gray-700 shadow-[0_0_20px_rgba(34,197,94,0.5)]' : 'border-red-400 bg-gray-700') 
                                : 'border-white/10 border-dashed bg-transparent'}
                        `}>
                            {connectionStatus === 'connected' ? <User className="w-12 h-12 text-white" /> : <Loader2 className="w-8 h-8 text-white/30 animate-spin" />}
                            {isOpponentReady && <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-1"><CheckCircle className="w-5 h-5 text-white" /></div>}
                        </div>
                        <span className="font-bold text-white">{connectionStatus === 'connected' ? 'OPONENTE' : '...'}</span>
                    </div>
                </div>

                <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                    {connectionStatus === 'connecting' && <div className="flex items-center justify-center gap-2 text-yellow-400"><Loader2 className="animate-spin" /> Conectando...</div>}
                    {connectionStatus === 'error' && <p className="text-red-400">{message}</p>}
                    
                    {gameMode === GameMode.ONLINE_HOST && connectionStatus === 'idle' && peerId && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 bg-black/50 p-4 rounded-xl border border-white/10 group">
                                <code className="text-2xl font-mono text-emerald-400 tracking-wider flex-1">{peerId}</code>
                                <button onClick={() => { navigator.clipboard.writeText(peerId); setMessage("Código copiado!"); }} className="p-2 hover:bg-white/10 rounded-lg">
                                    <Copy className="w-5 h-5 text-gray-400 group-hover:text-white" />
                                </button>
                            </div>
                            <p className="text-sm text-gray-400 animate-pulse">Compartilhe o código...</p>
                        </div>
                    )}

                    {gameMode === GameMode.ONLINE_GUEST && connectionStatus === 'idle' && (
                        <div className="space-y-4">
                            <input 
                                type="text" 
                                value={joinId}
                                onChange={(e) => setJoinId(e.target.value)}
                                placeholder="Cole o código do anfitrião"
                                className="w-full bg-black/50 border border-white/20 rounded-xl p-4 text-center text-white font-mono text-lg focus:outline-none focus:border-emerald-500"
                            />
                            <button onClick={connectToPeer} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2">
                                <Zap className="w-5 h-5" /> Entrar na Sala
                            </button>
                        </div>
                    )}

                    {connectionStatus === 'connected' && !isPlayerReady && (
                        <button onClick={handlePlayerReady} className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xl rounded-xl shadow-lg transform hover:scale-[1.02] transition-all flex items-center justify-center gap-3 mt-4">
                            <CheckCircle className="w-6 h-6" /> ESTOU PRONTO!
                        </button>
                    )}
                </div>
            </div>
        </div>
      );
  }

  // --- GAME OVER ---
  if (gameState === GameState.GAME_OVER) {
    const isWin = scores.player > scores.cpu; // Simplified check, usually winner is whoever has cards
    // But in GameOver logic, usually one deck is 0. 
    // If player has cards (length > 0) and cpu has 0, player win.
    const realWin = playerDeck.length > 0;
    
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center p-6 bg-gray-900 text-center relative">
         <button onClick={toggleMusic} className="absolute top-4 right-4 z-50 p-2 rounded-full border border-white/20 backdrop-blur-md">
            {isMusicOn ? <Volume2 className="w-5 h-5 text-white" /> : <VolumeX className="w-5 h-5 text-gray-400" />}
        </button>

        <div className={`text-6xl mb-6 ${realWin ? 'text-yellow-400 animate-bounce' : 'text-gray-500'}`}>
          {realWin ? <Trophy className="w-24 h-24 mx-auto" /> : '💀'}
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">FIM DE JOGO</h1>
        <p className="text-pink-400 mb-8 text-xl font-bold px-4">{message}</p>
        
        <button
            onClick={() => {
                if (isOnline && gameMode === GameMode.ONLINE_HOST) {
                    startOnlineGameLogic();
                } else if (isOnline) {
                    sendMessage({ type: 'RESTART' });
                    setMessage("Solicitação de revanche enviada...");
                } else {
                    startGame(gameMode);
                }
            }}
            className="flex items-center px-8 py-3 mb-4 bg-emerald-600 text-white rounded-full font-bold hover:bg-emerald-500 transition-colors shadow-lg border border-emerald-400"
        >
            <Zap className="mr-2 fill-white" />
            Jogar Novamente {isOnline && "(Mesma Sala)"}
        </button>

        <button onClick={() => { if (peerRef.current) peerRef.current.destroy(); setGameState(GameState.START); }} className="flex items-center px-6 py-2 bg-indigo-900/50 text-indigo-200 rounded-full font-bold border border-indigo-500/30">
          <RefreshCw className="mr-2 w-4 h-4" />
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
  const isOpponentMinimized = !isResult;
  // Player minimized only in pass-n-play when it's cpu turn (meaning player 2 turn) and we are hiding P1
  // But logic above handles Waiting screen. 
  // In playing, we want both visible if RESULT, or only active visible.
  // Actually, for better UX: always show my card. Show opponent minimized until result.
  
  const opponentHeightClass = isResult ? 'flex-1' : (isOpponentMinimized ? 'h-14 shrink-0' : 'flex-1');
  const playerHeightClass = 'flex-1'; 

  const opponentVariant = isResult ? 'result' : (isOpponentMinimized ? 'minimized' : 'playing');
  const playerVariant = isResult ? 'result' : 'playing';

  return (
    <div className="h-[100dvh] bg-gray-900 flex flex-col overflow-hidden relative">
      <div className="h-10 bg-black/80 backdrop-blur-md flex items-center justify-between px-3 border-b border-white/10 z-50 shrink-0 text-xs">
         <div className="flex gap-2 items-center text-blue-300 font-bold">
            <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center">{scores.player}</span>
            <span>{isOnline ? 'VOCÊ' : 'P1'}</span>
         </div>
         <div className="flex items-center gap-1 font-mono text-gray-500 uppercase tracking-widest text-[10px]">
             {isOnline && <Wifi className={`w-3 h-3 ${connectionStatus === 'connected' ? 'text-green-500' : 'text-red-500'}`} />}
            {gameState === GameState.PLAYING ? 'ESCOLHA' : 'RESULTADO'}
         </div>
         <div className="flex gap-2 items-center text-red-300 font-bold">
            <span>{isOnline ? 'RIVAL' : (gameMode === GameMode.SINGLE_PLAYER ? 'CPU' : 'P2')}</span>
            <span className="bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center">{scores.cpu}</span>
         </div>

         <button 
            onClick={toggleMusic}
            className={`ml-2 p-1.5 rounded-full border border-white/20 transition-all duration-300
                ${isMusicOn ? 'bg-pink-600 text-white' : 'bg-transparent text-gray-400'}
            `}
         >
            {isMusicOn ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
         </button>
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
                    isHidden={(gameState === GameState.PLAYING) && !isOpponentMinimized}
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

        {isResult && (
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