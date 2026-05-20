
import BaseCard, { type BaseCardProps } from './BaseCard';
import { FaPalette } from 'react-icons/fa';

export interface WildCardProps extends BaseCardProps {
  value: 'ColorChange' | '+4';
  activeColor?: string; // If wild has been played, show selected color
}

export default function WildCard({ value, activeColor, ...props }: WildCardProps) {
  
  // Use standard black base if not played, or the selected color if played
  const theme = activeColor ? (activeColor.toLowerCase() as BaseCardProps['colorTheme']) : 'black';

  return (
    <BaseCard colorTheme={theme} {...props} className={props.className}>
      {/* Rainbow Stripes Background */}
      <div className="absolute inset-0 flex overflow-hidden opacity-80 pointer-events-none">
        {!activeColor && (
          <>
            <div className="flex-1 bg-card-red transform -skew-x-12 scale-110" />
            <div className="flex-1 bg-card-blue transform -skew-x-12 scale-110" />
            <div className="flex-1 bg-card-green transform -skew-x-12 scale-110" />
            <div className="flex-1 bg-card-yellow transform -skew-x-12 scale-110" />
          </>
        )}
      </div>

      {/* Dark overlay for contrast */}
      <div className="absolute inset-2 bg-black/60 rounded-[8px] pointer-events-none" />

      <div className="absolute top-2 left-2 text-white font-bold text-lg drop-shadow-md flex items-center z-10">
        {value === '+4' ? '+4' : <FaPalette size={16} />}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative z-10 text-white drop-shadow-[0_4px_4px_rgba(0,0,0,1)]">
        <div className="text-4xl font-black italic tracking-tighter text-center">
          {value === '+4' ? (
            <span className="text-5xl">+4</span>
          ) : (
            <>
              <span className="text-card-red">W</span>
              <span className="text-card-blue">I</span>
              <span className="text-card-green">L</span>
              <span className="text-card-yellow">D</span>
            </>
          )}
        </div>
      </div>

      <div className="absolute bottom-2 right-2 text-white font-bold text-lg rotate-180 drop-shadow-md flex items-center z-10">
        {value === '+4' ? '+4' : <FaPalette size={16} />}
      </div>
    </BaseCard>
  );
}
