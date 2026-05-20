
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for merging tailwind classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface BaseCardProps {
  children?: React.ReactNode;
  className?: string;
  isPlayable?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  colorTheme?: 'red' | 'green' | 'blue' | 'yellow' | 'wild' | 'super' | 'black';
}

export default function BaseCard({ 
  children, 
  className, 
  isPlayable = false, 
  isSelected = false, 
  onClick, 
  style,
  colorTheme = 'black'
}: BaseCardProps) {
  
  // Theme color maps for borders and glow
  const themeColors = {
    red: 'border-card-red shadow-card-red/50',
    green: 'border-card-green shadow-card-green/50',
    blue: 'border-card-blue shadow-card-blue/50',
    yellow: 'border-card-yellow shadow-card-yellow/50',
    wild: 'border-card-wild shadow-card-wild/50',
    super: 'border-card-super shadow-card-super/50',
    black: 'border-accent shadow-accent/50',
  };

  const bgColors = {
    red: 'bg-card-red',
    green: 'bg-card-green',
    blue: 'bg-card-blue',
    yellow: 'bg-card-yellow',
    wild: 'bg-card-wild',
    super: 'bg-card-super',
    black: 'bg-surface',
  };

  return (
    <motion.div
      onClick={isPlayable ? onClick : undefined}
      className={cn(
        "relative flex flex-col justify-between overflow-hidden shrink-0",
        "w-[120px] h-[180px] sm:w-[140px] sm:h-[210px]",
        "rounded-[16px] border-[4px] cursor-default select-none",
        "transition-shadow duration-300",
        bgColors[colorTheme],
        themeColors[colorTheme],
        isPlayable && "cursor-pointer hover:shadow-xl hover:-translate-y-4",
        isPlayable && isSelected && "ring-4 ring-white shadow-2xl",
        !isPlayable && "opacity-80 brightness-75 grayscale-[20%]",
        className
      )}
      style={{
        boxShadow: isPlayable ? '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.5)' : '0 4px 6px -1px rgba(0,0,0,0.5)',
        ...style
      }}
      whileHover={isPlayable ? { scale: 1.05, y: -15, rotateZ: (Math.random() - 0.5) * 4 } : {}}
      whileTap={isPlayable ? { scale: 0.95 } : {}}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* Subtle overlay texture/grunge effect */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white to-black mix-blend-overlay pointer-events-none" />
      {/* Inner border line for premium feel */}
      <div className="absolute inset-1 border-[1px] border-white/20 rounded-[12px] pointer-events-none" />
      
      <div className="relative z-10 w-full h-full flex flex-col">
        {children}
      </div>
    </motion.div>
  );
}
