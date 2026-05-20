
import BaseCard, { type BaseCardProps } from './BaseCard';
import { FaForward, FaBan, FaPlus } from 'react-icons/fa';

export interface ActionCardProps extends BaseCardProps {
  value: 'Reverse' | 'Skip' | '+2';
}

export default function ActionCard({ value, colorTheme, ...props }: ActionCardProps) {
  const getIcon = (size: number) => {
    switch (value) {
      case 'Reverse':
        return <div className="flex"><FaForward size={size} className="scale-x-[-1] -mr-2" /><FaForward size={size} className="-mr-2" /></div>;
      case 'Skip':
        return <FaBan size={size} />;
      case '+2':
        return <div className="flex items-center"><FaPlus size={size * 0.7} className="mr-1" /><span className="font-black">2</span></div>;
      default:
        return null;
    }
  };

  return (
    <BaseCard colorTheme={colorTheme} {...props}>
      {/* Motion Streak Background */}
      <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.8)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shine_3s_infinite_linear]" />
      </div>

      <div className="absolute top-2 left-2 text-white font-bold text-lg drop-shadow-md flex items-center">
        {getIcon(16)}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative z-10 text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
        <div className="text-5xl mb-2">
          {getIcon(48)}
        </div>
      </div>

      <div className="absolute bottom-2 right-2 text-white font-bold text-lg rotate-180 drop-shadow-md flex items-center">
        {getIcon(16)}
      </div>
    </BaseCard>
  );
}
