import React, { useState, useRef, useEffect } from 'react';
import { CardData, StatKey, STAT_LABELS, CardSkinType } from '../types';
import { Users, Disc, Calendar, Star, Trophy } from 'lucide-react';

interface CardProps {
  data: CardData;
  isHidden?: boolean;
  onSelectStat?: (stat: StatKey) => void;
  selectedStat?: StatKey | null;
  disabled?: boolean;
  isWinner?: boolean;
  isLoser?: boolean;
  label?: string;
  variant?: 'playing' | 'result' | 'minimized';
  skin?: CardSkinType;
}

const STAT_ICONS: Record<StatKey, React.ReactNode> = {
  members: <Users className="w-4 h-4 md:w-5 md:h-5" />,
  albums: <Disc className="w-4 h-4 md:w-5 md:h-5" />,
  debutYear: <Calendar className="w-4 h-4 md:w-5 md:h-5" />,
  fame: <Star className="w-4 h-4 md:w-5 md:h-5" />,
  awards: <Trophy className="w-4 h-4 md:w-5 md:h-5" />,
};

export const Card: React.FC<CardProps> = ({ 
  data, 
  isHidden = false, 
  onSelectStat, 
  selectedStat,
  disabled = false,
  isWinner = false,
  isLoser = false,
  label,
  variant = 'playing',
  skin = 'default'
}) => {
  const [imgError, setImgError] = useState(false);
  
  // 3D Tilt Logic
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || isHidden || variant === 'minimized') return;
    
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / centerY) * -10; // Max rotation deg
      const rotateY = ((x - centerX) / centerX) * 10;

      setRotate({ x: rotateX, y: rotateY });
      setGlowPos({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
      setIsHovering(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setRotate({ x: 0, y: 0 });
  };

  // Função auxiliar para calcular a largura da barra
  const getBarWidth = (key: StatKey, value: number): number => {
      let percentage = 0;
      switch (key) {
        case 'members': percentage = (value / 16) * 100; break;
        case 'albums': percentage = (value / 15) * 100; break;
        case 'debutYear': percentage = ((2025 - value) / 22) * 100; break;
        case 'fame': percentage = (value / 40) * 100; break;
        case 'awards': percentage = (value / 500) * 100; break;
      }
      return Math.min(Math.max(percentage, 5), 100);
  };

  // --- SKIN STYLES ---
  const getSkinClasses = () => {
      if (skin === 'gold') return 'border-yellow-400 bg-gray-900 shadow-[0_0_30px_rgba(234,179,8,0.3)]';
      if (skin === 'holo') return 'border-cyan-300 bg-gray-900 shadow-[0_0_30px_rgba(34,211,238,0.3)]';
      return 'border-transparent bg-gray-900 shadow-2xl'; // default
  };

  const getSkinOverlay = () => {
      if (skin === 'gold') {
          return <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-amber-300/5 to-yellow-600/10 mix-blend-overlay pointer-events-none z-10 border-[3px] border-yellow-500/50 rounded-3xl"></div>;
      }
      if (skin === 'holo') {
          return <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 via-purple-500/10 to-pink-500/10 mix-blend-color-dodge pointer-events-none z-10 animate-pulse border-[2px] border-white/20 rounded-3xl"></div>;
      }
      return null;
  };

  // --- LAYOUT MINIMIZADO ---
  if (variant === 'minimized') {
    return (
      <div className={`w-full h-full rounded-b-3xl bg-gradient-to-r ${data.imageColor} shadow-2xl relative overflow-hidden flex items-end pb-2 justify-center`}>
         <div className="absolute inset-0 bg-black/20"></div>
         {!imgError ? (
           <img src={data.imageUrl} alt="" className="absolute inset-0 w-full h-full object-contain p-4 opacity-50 blur-sm mix-blend-overlay" onError={() => setImgError(true)} />
         ) : (
            <div className="absolute inset-0 flex items-center justify-center opacity-30">
               <span className="text-4xl font-black italic text-white uppercase">{data.name.substring(0,3)}</span>
            </div>
         )}
         <div className="relative z-10 flex items-center gap-3 bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/20">
            <span className="font-bold text-white/90 uppercase tracking-widest text-xs">{label || 'Oponente'}</span>
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                <span className="text-white text-[10px]">?</span>
            </div>
         </div>
      </div>
    );
  }

  const containerClass = "w-full h-full flex flex-col relative overflow-hidden transition-all duration-300 select-none";

  // --- CARTA OCULTA ---
  if (isHidden) {
    return (
      <div className={`${containerClass} rounded-2xl border-[6px] border-gray-800 animate-slide-down relative group bg-gray-900`}>
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 animate-pulse"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
           <div className="w-32 h-32 rounded-full border-4 border-white/20 flex items-center justify-center bg-white/10 backdrop-blur-sm shadow-[0_0_30px_rgba(255,0,255,0.3)] group-hover:scale-110 transition-transform duration-500">
              <span className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-cyan-400">K-POP</span>
           </div>
           <span className="mt-4 text-white/50 font-bold tracking-[0.5em] text-xs">SUPER TRUNFO</span>
        </div>
        {label && <div className="absolute top-6 bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 text-xs font-bold text-white uppercase tracking-widest z-20 shadow-xl">{label}</div>}
      </div>
    );
  }

  // --- CARTA VISÍVEL ---
  const borderStyle = isWinner 
    ? 'ring-4 ring-green-400 z-30 shadow-[0_0_40px_rgba(74,222,128,0.6)] scale-[1.02]' 
    : isLoser 
      ? 'ring-4 ring-red-500 opacity-80 z-10 grayscale-[0.5]' 
      : 'hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]';

  const isCompact = variant === 'result';
  const entryAnimation = isCompact ? '' : label?.includes('Oponente') || label?.includes('CPU') || label?.includes('P2') ? 'animate-flip-in' : 'animate-slide-up';
  const skinClasses = getSkinClasses();

  return (
    <div 
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`${containerClass} rounded-3xl ${borderStyle} ${entryAnimation} ${skinClasses}`}
        style={{
            transform: isHovering ? `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale(1.02)` : 'perspective(1000px) rotateX(0) rotateY(0) scale(1)',
            transition: isHovering ? 'transform 0.1s ease-out' : 'transform 0.5s ease-out'
        }}
    >
      {/* 3D Reflection Effect */}
      {isHovering && !isCompact && (
          <div 
            className="absolute inset-0 z-40 pointer-events-none mix-blend-soft-light"
            style={{
                background: `radial-gradient(circle at ${glowPos.x}% ${glowPos.y}%, rgba(255,255,255,0.4) 0%, transparent 50%)`
            }}
          ></div>
      )}

      {/* Skin Overlay */}
      {getSkinOverlay()}

      {/* Background Gradient Base */}
      <div className={`absolute inset-0 bg-gradient-to-b ${data.imageColor} opacity-90`}></div>
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>

      {/* --- HERO IMAGE SECTION --- */}
      <div className={`relative w-full overflow-hidden transition-all duration-500 group flex items-center justify-center ${isCompact ? 'h-[30%]' : 'h-[50%]'}`}>
         {!imgError ? (
            <img src={data.imageUrl} alt={data.name} className="absolute inset-0 w-full h-full object-contain p-8 md:p-12 transition-transform duration-700 group-hover:scale-110 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]" onError={() => setImgError(true)} />
         ) : (
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <h1 className={`font-black italic text-white uppercase tracking-tighter text-center leading-none drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] ${isCompact ? 'text-5xl' : 'text-7xl md:text-8xl'} break-words w-full opacity-90`}>{data.name}</h1>
            </div>
         )}
         {label && <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 text-[10px] font-bold text-white uppercase tracking-widest shadow-lg">{label}</div>}
         <div className="absolute bottom-2 left-4 right-4 z-20">
            <div className="flex items-end justify-between">
                <div>
                    <h2 className={`font-black text-white uppercase italic tracking-tighter leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${isCompact ? 'text-xl' : 'text-2xl md:text-3xl'}`}>{data.name}</h2>
                     <div className={`h-1 w-20 rounded-full mt-2 bg-white/50`}></div>
                </div>
                <div className="text-right">
                    <span className="text-[10px] font-bold text-white/80 block uppercase drop-shadow-md">ID Card</span>
                    <span className="text-2xl font-mono font-bold text-white drop-shadow-md">#{data.id.padStart(2, '0')}</span>
                </div>
            </div>
         </div>
      </div>

      {/* --- STATS SECTION --- */}
      <div className="flex-1 bg-gray-900/95 relative p-3 md:p-4 flex flex-col justify-center gap-2 md:gap-3 backdrop-blur-sm z-20">
        {(Object.keys(data.stats) as StatKey[]).map((key) => {
          const isSelected = selectedStat === key;
          const value = data.stats[key];
          const widthPercent = getBarWidth(key, value);
          
          return (
            <button
              key={key}
              onClick={() => !disabled && onSelectStat && onSelectStat(key)}
              disabled={disabled}
              className={`
                relative w-full flex items-center justify-between px-4 py-2 md:py-3 rounded-xl border transition-all duration-300 group overflow-hidden
                ${isSelected 
                    ? `bg-gradient-to-r ${data.imageColor} border-white/50 shadow-[0_4px_20px_rgba(0,0,0,0.5)] scale-[1.02] z-10` 
                    : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:bg-gray-800 hover:border-gray-500 hover:text-white'}
                ${disabled ? 'cursor-default' : 'cursor-pointer active:scale-95'}
                ${isCompact ? 'py-1 min-h-[32px]' : ''}
              `}
            >
              <div className="flex items-center gap-3 relative z-10">
                 <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-700 text-gray-400 group-hover:text-white group-hover:bg-gray-600'} transition-colors`}>{STAT_ICONS[key]}</div>
                 <span className={`text-xs md:text-sm font-bold uppercase tracking-wider ${isSelected ? 'text-white' : 'group-hover:text-white'}`}>{STAT_LABELS[key]}</span>
              </div>
              <div className="flex flex-col items-end relative z-10">
                  <span className={`font-mono font-black ${isSelected ? 'text-xl md:text-2xl text-white drop-shadow-md' : 'text-lg md:text-xl text-gray-300 group-hover:text-white'}`}>{key === 'awards' && value > 1000 ? '1k+' : value}</span>
                  {!isCompact && (
                      <div className="w-16 h-1 bg-gray-700 rounded-full mt-1 overflow-hidden">
                          <div className={`h-full rounded-full ${isSelected ? 'bg-white' : `bg-gradient-to-r ${data.imageColor}`}`} style={{ width: `${widthPercent}%` }}></div>
                      </div>
                  )}
              </div>
            </button>
          );
        })}
      </div>
      
      {/* OVERLAY RESULTS */}
      {isWinner && (
         <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/20 pointer-events-none backdrop-blur-[2px]">
            <div className="relative transform rotate-[-12deg] animate-pop-win"><div className="absolute inset-0 bg-green-500 blur-lg opacity-50"></div><div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-4xl md:text-6xl font-black px-8 py-4 shadow-2xl border-4 border-white tracking-tighter uppercase rounded-xl">WIN!</div></div>
         </div>
      )}
       {isLoser && (
         <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/20 pointer-events-none backdrop-blur-[2px]">
             <div className="relative transform rotate-[12deg] animate-pop-lose"><div className="absolute inset-0 bg-red-600 blur-lg opacity-50"></div><div className="bg-gradient-to-r from-red-600 to-orange-700 text-white text-4xl md:text-6xl font-black px-8 py-4 shadow-2xl border-4 border-white tracking-tighter uppercase rounded-xl">LOSE</div></div>
         </div>
      )}
    </div>
  );
};
