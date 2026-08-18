import { CardView } from './CardView';
import type { CardSlot } from '../types';

interface Props {
  cards: CardSlot[];
  size?: 'xs' | 'sm' | 'md';
}

export function CommunityCards({ cards, size = 'sm' }: Props) {
  const slots: (CardSlot | null)[] = Array.from({ length: 5 }, (_, i) => cards[i] ?? null);
  const flop = slots.slice(0, 3);
  const turnRiver = slots.slice(3, 5);

  return (
    <div className="flex items-end gap-2">
      {/* Flop – 3 cards */}
      <div className="flex items-end gap-0.5">
        {flop.map((card, i) => (
          <CardView key={i} card={card} size={size} />
        ))}
      </div>

      {/* Divider */}
      <div className="self-stretch w-px bg-white/10 mx-0.5" />

      {/* Turn + River – 2 cards */}
      <div className="flex items-end gap-0.5">
        {turnRiver.map((card, i) => (
          <CardView key={i + 3} card={card} size={size} />
        ))}
      </div>
    </div>
  );
}
