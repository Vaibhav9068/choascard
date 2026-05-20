
import BaseCard, { type BaseCardProps } from './BaseCard';

export interface NumberCardProps extends BaseCardProps {
  value: string | number;
}

export default function NumberCard({ value, colorTheme, ...props }: NumberCardProps) {
  return (
    <BaseCard colorTheme={colorTheme} {...props}>
      {/* Top Left Corner */}
      <div className="absolute top-2 left-2 text-white font-bold text-lg leading-none drop-shadow-md">
        {value}
      </div>

      {/* Center Graphic */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* Dynamic Curved SVG Background (Subtle ellipse) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-30">
          <div className="w-[120%] h-[120%] rounded-full bg-white blur-xl mix-blend-overlay rotate-12 transform -translate-x-4"></div>
        </div>
        
        {/* Large Center Number */}
        <div className="relative z-10 text-white font-black text-6xl drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
          {value}
        </div>
      </div>

      {/* Bottom Right Corner */}
      <div className="absolute bottom-2 right-2 text-white font-bold text-lg leading-none rotate-180 drop-shadow-md">
        {value}
      </div>
    </BaseCard>
  );
}
