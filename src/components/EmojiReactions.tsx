import React, { useEffect, useRef } from 'react';

export interface FloatingEmoji {
  id: number;
  emoji: string;
}

interface EmojiReactionsProps {
  emojis: FloatingEmoji[];
  onAnimationEnd: (id: number) => void;
}

const EmojiReactions: React.FC<EmojiReactionsProps> = ({ emojis, onAnimationEnd }) => {
  return (
    <div className="fixed right-4 bottom-24 z-50 pointer-events-none select-none" style={{ minWidth: 40 }}>
      {emojis.map(({ id, emoji }) => (
        <span
          key={id}
          className="emoji-float block text-3xl animate-emoji-float"
          style={{ position: 'absolute', right: Math.random() * 20, bottom: 0, animationDuration: `${1.8 + Math.random()}s` }}
          onAnimationEnd={() => onAnimationEnd(id)}
        >
          {emoji}
        </span>
      ))}
      <style>{`
        @keyframes emoji-float {
          0% { opacity: 0; transform: translateY(0) scale(1); }
          10% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-180px) scale(1.3); }
        }
        .animate-emoji-float {
          animation: emoji-float 2.2s cubic-bezier(0.4,0,0.2,1) forwards;
        }
      `}</style>
    </div>
  );
};

export default EmojiReactions;
