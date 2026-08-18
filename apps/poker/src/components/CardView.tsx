import type { CardSlot } from '../types';

interface Props {
  card: CardSlot | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

const SUIT_IMAGE_BASE = [239, 226, 213, 200];

function cardImageNumber(value: number): number {
  const suitIdx = Math.floor(value / 13);
  const rankIdx = value % 13;
  const base = SUIT_IMAGE_BASE[suitIdx];
  const offset = (rankIdx + 12) % 13;
  return base + offset;
}

const SIZES = {
  xs:  'h-[9vh]  aspect-[5/7]',
  sm:  'h-[16vh] aspect-[5/7]',
  md:  'h-[16vh] aspect-[5/7]',
  lg:  'h-[14vh] aspect-[5/7]',
  xl:  'h-[22vh] aspect-[5/7]',
};

export function CardView({ card, size = 'md' }: Props) {
  const sizeClass = SIZES[size];

  if (!card) {
    return (
      <div className={`${sizeClass} flex-shrink-0 rounded-lg border-2 border-dashed border-gray-600/50 bg-gray-800/20`} />
    );
  }

  if (!card.faceUp || card.value === null) {
    return (
      <div className={`card-container card-shadow flex-shrink-0 ${sizeClass}`}>
        <img
          src="/cards/back.png"
          className="w-full h-full object-contain rounded-lg shadow-xl"
          alt="Card back"
        />
      </div>
    );
  }

  const imgNum = cardImageNumber(card.value);
  return (
    <div className={`card-container card-shadow flex-shrink-0 ${sizeClass}`}>
      <img
        src={`/cards/${imgNum}.png`}
        className="w-full h-full object-contain rounded-lg shadow-xl"
        alt={`Card ${imgNum}`}
      />
    </div>
  );
}
