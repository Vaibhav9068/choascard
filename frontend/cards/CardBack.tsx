
import BaseCard, { type BaseCardProps } from './BaseCard';

export default function CardBack(props: BaseCardProps) {
  return (
    <BaseCard colorTheme="black" isPlayable={false} {...props}>
      {/* Dark textured background */}
      <div className="absolute inset-0 bg-surface pointer-events-none" />
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white to-black pointer-events-none" />

      {/* Symmetrical tech border */}
      <div className="absolute inset-2 border-2 border-accent/20 rounded-[8px] pointer-events-none" />
      <div className="absolute inset-4 border border-accent/10 rounded-[4px] pointer-events-none" />

      {/* Center Logo */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10">
        <div className="w-16 h-16 rounded-full bg-black border-2 border-accent flex items-center justify-center shadow-[0_0_15px_rgba(250,229,0,0.3)]">
          <div className="text-accent font-black italic text-xl tracking-tighter leading-none text-center">
            NO<br/>MERCY
          </div>
        </div>
        <div className="mt-4 text-white/50 font-bold tracking-widest text-[0.6rem]">
          CHAOS DECK
        </div>
      </div>
    </BaseCard>
  );
}
