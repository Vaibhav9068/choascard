
import BaseCard, { type BaseCardProps } from './BaseCard';
import { FaFistRaised, FaBomb } from 'react-icons/fa';

export interface SuperCardProps extends BaseCardProps {
  value: '+6' | '+10' | 'PunchBack' | 'Slam';
}

export default function SuperCard({ value, ...props }: SuperCardProps) {
  
  const getStyleParams = () => {
    switch (value) {
      case '+6':
        return {
          bg: 'bg-gradient-to-br from-orange-500 to-red-600',
          title: '+6',
          subtitle: 'DEVASTATION',
          icon: <FaBomb size={24} />
        };
      case '+10':
        return {
          bg: 'bg-gradient-to-br from-red-600 via-red-900 to-black',
          title: '+10',
          subtitle: 'ANNIHILATION',
          icon: <FaBomb size={32} className="text-accent" />
        };
      case 'PunchBack':
        return {
          bg: 'bg-gradient-to-br from-gray-800 to-black',
          title: 'PUNCH',
          subtitle: 'BACK',
          icon: <FaFistRaised size={28} className="text-white" />
        };
      case 'Slam':
        return {
          bg: 'bg-gradient-to-br from-yellow-500 to-orange-700',
          title: 'SLAM',
          subtitle: 'TARGET +3',
          icon: <FaBomb size={28} className="text-black" />
        };

      default:
        return { bg: 'bg-black', title: '?', subtitle: '', icon: null };
    }
  };

  const params = getStyleParams();

  return (
    <BaseCard colorTheme="super" {...props} className={props.className}>
      
      {/* Background effect */}
      <div className={`absolute inset-0 opacity-90 ${params.bg} pointer-events-none`} />
      
      {/* Fire/Grunge Texture overlay (CSS radial + lines) */}
      <div className="absolute inset-0 opacity-40 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.2)_10px,rgba(0,0,0,0.2)_20px)] pointer-events-none" />

      <div className="absolute top-2 left-2 text-white font-bold text-sm drop-shadow-md flex items-center z-10">
        {params.icon}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative z-10 text-white drop-shadow-[0_4px_6px_rgba(0,0,0,1)]">
        <div className="text-4xl font-black italic tracking-tighter text-center leading-none">
          {params.title}
        </div>
        <div className="text-[0.6rem] font-bold tracking-widest mt-1 opacity-90 text-center uppercase">
          {params.subtitle}
        </div>
      </div>

      <div className="absolute bottom-2 right-2 text-white font-bold text-sm rotate-180 drop-shadow-md flex items-center z-10">
        {params.icon}
      </div>
    </BaseCard>
  );
}
