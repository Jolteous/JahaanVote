import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Crown } from 'lucide-react';

export interface FloatingEmoji {
  id: number;
  emoji: string;
  user_name: string;
}

interface EmojiReactionsProps {
  emojis: FloatingEmoji[];
  onAnimationEnd: (id: number) => void;
}

function getDeterministicX(id: number, user_name: string) {
  let hash = id;
  for (let i = 0; i < user_name.length; i++) {
    hash = (hash * 31 + user_name.charCodeAt(i)) % 10000;
  }
  return (hash % 40) - 5; // -5px to +35px, less spread
}
const getRandomDuration = () => 1.5 + Math.random() * 0.5; // shorter duration

function isHost(name: string) {
  return name && name.toLowerCase().includes('host');
}

const EmojiReactions: React.FC<EmojiReactionsProps> = ({ emojis, onAnimationEnd }) => {
  return (
    <div className="fixed right-4 bottom-24 z-50 pointer-events-none select-none" style={{ minWidth: 40 }}>
      {emojis.map(({ id, emoji, user_name }) => (
        <span
          key={id + '-' + user_name}
          className="emoji-float"
          style={{
            position: 'absolute',
            right: `${getDeterministicX(id, user_name)}px`,
            bottom: 0,
            animationDuration: `${getRandomDuration()}s`,
            willChange: 'transform, opacity',
            fontSize: '1.6rem', // smaller emoji
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
          onAnimationEnd={() => onAnimationEnd(id)}
        >
          {emoji}
          <Badge
            variant={isHost(user_name) ? 'destructive' : 'secondary'}
            className={
              'ml-1 text-xs bg-white/80 text-gray-800 border border-gray-300 shadow flex items-center gap-1 ' +
              (isHost(user_name) ? 'bg-yellow-500 text-white' : '')
            }
          >
            {isHost(user_name) && <Crown size={12} className="mr-1" />}
            {user_name}
          </Badge>
        </span>
      ))}
      <style>{`
        @keyframes emoji-float {
          0% { opacity: 0; transform: translateY(0) scale(1); }
          10% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-80px) scale(1.1); }
        }
        .emoji-float {
          animation: emoji-float 1.7s cubic-bezier(0.4,0,0.2,1) forwards;
        }
      `}</style>
    </div>
  );
};

export default EmojiReactions;
