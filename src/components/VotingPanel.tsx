import React, { useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import useAppContext from '@/contexts/useAppContext';
import { CheckCircle, Trash2, User2, ChevronsDown, ChevronsUp } from 'lucide-react';
import type { Poll, VoteOption } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription } from '@/components/ui/dialog';
import Confetti from './Confetti';
import EmojiReactions, { FloatingEmoji } from './EmojiReactions';
import { Skeleton } from '@/components/ui/skeleton';
import { useSpring, animated } from '@react-spring/web';

const VotingPanel: React.FC = () => {
  const { activePoll, previousPolls, vote, user, deletePoll, undoVote, removeUserVote, sendEmojiReaction, emojiReactions } = useAppContext();
  const [localVotedOptionId, setLocalVotedOptionId] = React.useState<string | null>(null);
  const [hasVoted, setHasVoted] = React.useState(false);
  const [showPrevious, setShowPrevious] = React.useState(false);
  const [loadingVoteStatus, setLoadingVoteStatus] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [votersModalOpen, setVotersModalOpen] = React.useState(false);
  const [voters, setVoters] = React.useState<string[]>([]);
  const [votersLoading, setVotersLoading] = React.useState(false);
  const [votersPollQuestion, setVotersPollQuestion] = React.useState<string>('');
  const previousPollsButtonRef = React.useRef<HTMLButtonElement>(null);
  const previousPollsModalRef = React.useRef<HTMLDivElement>(null);
  const votersModalRef = React.useRef<HTMLDivElement>(null);
  const [lastFocused, setLastFocused] = React.useState<HTMLElement | null>(null);
  const liveRegionRef = React.useRef<HTMLDivElement>(null);
  const [confettiActive, setConfettiActive] = React.useState(false);
  const [floatingEmojis, setFloatingEmojis] = React.useState<FloatingEmoji[]>([]);
  const emojiOptions = ['🎉', '👍', '😂', '🔥', '👏', '😍'];
  const emojiId = React.useRef(0);
  const lastEmojiId = React.useRef<string | null>(null);
  const [lastEmojiSentAt, setLastEmojiSentAt] = React.useState<number>(0);
  const EMOJI_COOLDOWN_MS = 1500;
  const [emojisEnabled, setEmojisEnabled] = React.useState(() => {
    // Persist preference in localStorage
    const stored = localStorage.getItem('emojisEnabled');
    return stored === null ? true : stored === 'true';
  });
  const [emojiBarVisible, setEmojiBarVisible] = React.useState(true);
  const [emojiBarRender, setEmojiBarRender] = React.useState(true);
  const [showBarButton, setShowBarButton] = React.useState(false);
  const [showBarButtonVisible, setShowBarButtonVisible] = React.useState(false);
  const [emojiBarEntering, setEmojiBarEntering] = React.useState(false);

  // On poll or user change, check if user has voted and update local state
  React.useEffect(() => {
    let cancelled = false;
    const checkVoted = async () => {
      setLoadingVoteStatus(true);
      if (!activePoll || !user?.name) {
        setHasVoted(false);
        setLocalVotedOptionId(null);
        setLoadingVoteStatus(false);
        return;
      }
      const { data, error } = await supabase
        .from('poll_votes')
        .select('option_id')
        .eq('poll_id', activePoll.id)
        .eq('user_name', user.name)
        .maybeSingle();
      if (!cancelled) {
        setHasVoted(!!data);
        setLocalVotedOptionId(data?.option_id || null);
        setLoadingVoteStatus(false);
      }
    };
    checkVoted();
    return () => { cancelled = true; };
  }, [activePoll, user?.name]);

  // Per-option voting state to prevent all buttons from re-rendering/flickering
  const [votingOptionId, setVotingOptionId] = React.useState<string | null>(null);

  // Optimistically update local vote state on vote
  const handleVote = async (pollId: string, optionId: string) => {
    if (!hasVoted && !loadingVoteStatus && votingOptionId === null) {
      setVotingOptionId(optionId);
      setLocalVotedOptionId(optionId); // Optimistically set
      setHasVoted(true);
      await vote(pollId, optionId);
      setVotingOptionId(null);
      // After Supabase update, the real-time effect will sync the state
      setConfettiActive(true);
    }
  };

  // Optimistically update local vote state on undo
  const handleUndoVote = async (pollId: string) => {
    if (activePoll && !loadingVoteStatus) {
      setVotingOptionId('undo');
      setLocalVotedOptionId(null);
      setHasVoted(false);
      await undoVote(pollId);
      setVotingOptionId(null);
    }
  };

  // Fetch voters for a poll
  const handleShowVoters = async (pollId: string, pollQuestion: string) => {
    setVotersModalOpen(true);
    setVotersPollQuestion(pollQuestion);
    setVotersLoading(true);
    const { data, error } = await supabase
      .from('poll_votes')
      .select('user_name')
      .eq('poll_id', pollId);
    if (!error && data) {
      setVoters(data.map((v: { user_name: string }) => v.user_name));
    } else {
      setVoters([]);
    }
    setVotersLoading(false);
  };

  // Focus trap for modals
  React.useEffect(() => {
    function trapFocus(e: KeyboardEvent) {
      const modal = modalOpen ? previousPollsModalRef.current : votersModalOpen ? votersModalRef.current : null;
      if (!modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }
    if (modalOpen || votersModalOpen) {
      document.addEventListener('keydown', trapFocus);
      // Save last focused element
      setLastFocused(document.activeElement as HTMLElement);
      // Focus modal
      setTimeout(() => {
        const modal = modalOpen ? previousPollsModalRef.current : votersModalOpen ? votersModalRef.current : null;
        if (modal) {
          const focusable = modal.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          focusable?.focus();
        }
      }, 0);
    }
    return () => {
      document.removeEventListener('keydown', trapFocus);
      // Restore focus
      if (!modalOpen && !votersModalOpen && lastFocused) {
        lastFocused.focus();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, votersModalOpen]);

  // Keyboard shortcuts
  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Ctrl+Shift+P (cross-platform)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setModalOpen(true);
      }
      if (e.key === 'Escape') {
        if (modalOpen) setModalOpen(false);
        if (votersModalOpen) setVotersModalOpen(false);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modalOpen, votersModalOpen]);

  // Announce voting status
  React.useEffect(() => {
    if (hasVoted && liveRegionRef.current) {
      liveRegionRef.current.textContent = 'You have voted!';
      setTimeout(() => {
        if (liveRegionRef.current) liveRegionRef.current.textContent = '';
      }, 2000);
    }
  }, [hasVoted]);

  const renderPoll = (poll: Poll, disableVoting = false) => {
    const totalVotes = poll.options.reduce((sum: number, option: VoteOption) => sum + option.votes, 0);
    const canVote = !disableVoting && !hasVoted;
    // Sort options by id for consistent order
    const sortedOptions = [...poll.options].sort((a, b) => a.id.localeCompare(b.id));
    return (
      <Card className="bg-gradient-to-br from-green-50 to-emerald-100 border-0 shadow-lg mb-6" key={poll.id}>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            🗳️ {poll.question}
            <button
              type="button"
              className="ml-1 p-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 border border-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              title="Show voters"
              aria-label="Show voters for this poll"
              onClick={() => handleShowVoters(poll.id, poll.question)}
              style={{ lineHeight: 0 }}
            >
              <User2 size={18} />
            </button>
            {user?.isHost && !disableVoting && (
              <Button size="icon" variant="ghost" onClick={() => deletePoll(poll.id)} className="ml-2 text-red-500 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-red-500" title="Delete Poll" aria-label="Delete poll">
                <Trash2 size={20} />
              </Button>
            )}
          </CardTitle>
          {totalVotes > 0 && (
            <p className="text-gray-600" aria-live="polite">{totalVotes} total votes</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {sortedOptions.map((option: VoteOption) => {
            const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
            const isVoting = votingOptionId === option.id;
            const isUserVoted = localVotedOptionId === option.id;
            return (
              <div key={option.id} className="space-y-2">
                {canVote ? (
                  <PollOptionButton
                    pollId={poll.id}
                    option={option}
                    canVote={canVote}
                    loadingVoteStatus={isVoting}
                    isUserVoted={isUserVoted}
                    handleVote={handleVote}
                  />
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <span className={isUserVoted ? "font-bold text-emerald-700" : "font-medium"}>{option.text}</span>
                      <span className="text-sm text-gray-600">
                        <AnimatedNumber value={option.votes} /> votes
                      </span>
                    </div>
                    <Progress value={percentage} className="h-3" />
                    <div className="text-right text-sm text-gray-600">
                      {percentage.toFixed(1)}%
                    </div>
                  </>
                )}
              </div>
            );
          })}
          {!disableVoting && hasVoted && (
            <div className="flex flex-col items-center justify-center gap-2 mt-4 text-green-600" aria-live="polite">
              <div className="flex items-center gap-2">
                <CheckCircle size={20} />
                <span className="font-medium">You have voted!</span>
              </div>
              <UndoVoteButton
                loading={votingOptionId === 'undo'}
                onClick={() => handleUndoVote(activePoll.id)}
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Custom memoization: only re-render if poll id or options count changes
  const MemoizedPollCard = React.memo(
    (props: { poll: Poll; disableVoting?: boolean }) => renderPoll(props.poll, props.disableVoting),
    (prev, next) => {
      // Only re-render if poll id or options count changes
      return (
        prev.poll.id === next.poll.id &&
        prev.poll.options.length === next.poll.options.length &&
        prev.disableVoting === next.disableVoting
      );
    }
  );

  // Skeleton loader for poll card
  const PollSkeleton = () => (
    <Card className="bg-gradient-to-br from-green-50 to-emerald-100 border-0 shadow-lg mb-6 animate-pulse">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-gray-300 flex items-center gap-2">
          <Skeleton className="w-8 h-8 rounded-full mr-2" />
          <Skeleton className="h-6 w-2/3" />
        </CardTitle>
        <Skeleton className="h-4 w-1/4 mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
        <div className="flex flex-col items-center justify-center gap-2 mt-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-8 w-24 mt-2" />
        </div>
      </CardContent>
    </Card>
  );

  // Track previous emojiReactions length to detect new reactions
  const prevEmojiReactions = React.useRef(emojiReactions.length);
  // Track last processed emoji id even when emojis are disabled
  const lastProcessedEmojiId = React.useRef<string | null>(null);

  // Show new floating emoji only when a new reaction is received and emojis are enabled
  React.useEffect(() => {
    if (!emojisEnabled) return;
    if (
      emojiReactions.length > 0 &&
      emojiReactions.length > prevEmojiReactions.current
    ) {
      const last = emojiReactions[emojiReactions.length - 1];
      if (lastProcessedEmojiId.current !== last.id) {
        setFloatingEmojis((prev) => [
          ...prev,
          { id: emojiId.current++, emoji: last.emoji, user_name: last.user_name },
        ]);
        lastProcessedEmojiId.current = last.id;
      }
    }
    prevEmojiReactions.current = emojiReactions.length;
  }, [emojiReactions, emojisEnabled]);

  // When emojis are disabled, clear any floating emojis so they don't replay on re-enable
  React.useEffect(() => {
    if (!emojisEnabled) {
      setFloatingEmojis([]);
    }
  }, [emojisEnabled]);

  // When emojis are disabled, keep lastProcessedEmojiId up to date so we don't replay on toggle
  React.useEffect(() => {
    if (!emojisEnabled && emojiReactions.length > 0) {
      lastProcessedEmojiId.current = emojiReactions[emojiReactions.length - 1].id;
    }
  }, [emojiReactions, emojisEnabled]);

  function handleSendEmoji(emoji: string) {
    const now = Date.now();
    if (now - lastEmojiSentAt < EMOJI_COOLDOWN_MS) return;
    sendEmojiReaction(emoji);
    setLastEmojiSentAt(now);
  }

  function handleEmojiAnimationEnd(id: number) {
    setFloatingEmojis((prev) => prev.filter(e => e.id !== id));
  }

  React.useEffect(() => {
    if (emojiBarVisible) {
      setEmojiBarRender(true);
      setShowBarButton(false);
      setShowBarButtonVisible(false);
      setEmojiBarEntering(true);
      // End entrance animation after 400ms
      const timeout = setTimeout(() => setEmojiBarEntering(false), 400);
      return () => clearTimeout(timeout);
    } else {
      // Wait for animation to finish before unmounting and showing the button
      const timeout = setTimeout(() => {
        setEmojiBarRender(false);
        setShowBarButton(true);
        setTimeout(() => setShowBarButtonVisible(true), 10); // allow mount before animating in
      }, 400);
      return () => clearTimeout(timeout);
    }
  }, [emojiBarVisible]);

  // Handle show bar button fade out and emoji bar fade in
  const handleShowBar = () => {
    setShowBarButtonVisible(false); // start fade out
    setTimeout(() => {
      setShowBarButton(false);
      setEmojiBarVisible(true);
    }, 400); // match animation duration
  };

  return (
    <div>
      <Confetti trigger={confettiActive} onDone={() => setConfettiActive(false)} />
      <EmojiReactions emojis={emojisEnabled ? floatingEmojis : []} onAnimationEnd={handleEmojiAnimationEnd} />
      {emojiBarRender && (
        <div
          className={`fixed right-4 bottom-4 z-40 transition-all duration-400 ${emojiBarVisible ? (emojiBarEntering ? 'opacity-0 translate-y-8' : 'opacity-100 translate-y-0') : 'opacity-0 translate-y-8 pointer-events-none'}`}
          style={{
            willChange: 'opacity, transform',
            transition: 'opacity 0.4s, transform 0.4s',
          }}
        >
          <div className="flex gap-2 bg-white/80 rounded-full shadow-lg px-3 py-2 border border-gray-200 items-center">
            {emojiOptions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="text-2xl hover:scale-125 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-label={`Send ${emoji} reaction`}
                onClick={() => handleSendEmoji(emoji)}
                disabled={!emojisEnabled}
              >
                {emoji}
              </button>
            ))}
            {/* Toggle slider for floating emojis */}
            <label className="flex items-center ml-3 cursor-pointer select-none group">
              <span className="mr-1 text-xs text-gray-600">Emojis</span>
              <span className="relative inline-block w-10 h-6 align-middle select-none">
                <input
                  type="checkbox"
                  checked={emojisEnabled}
                  onChange={e => setEmojisEnabled(e.target.checked)}
                  className="sr-only peer"
                  aria-label="Toggle floating emojis"
                />
                <span
                  className="block w-10 h-6 rounded-full transition-colors duration-300 bg-gray-300 peer-checked:bg-emerald-500"
                ></span>
                <span
                  className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 peer-checked:translate-x-4"
                ></span>
              </span>
            </label>
            {/* Hide bar button */}
            <button
              type="button"
              className="ml-2 p-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 border border-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label="Hide emoji bar"
              onClick={() => setEmojiBarVisible(false)}
              title="Hide emoji bar"
            >
              <ChevronsDown size={18} />
            </button>
          </div>
        </div>
      )}
      {/* Show bar button when hidden, with fade/slide in and fade out on click */}
      {showBarButton && (
        <button
          type="button"
          className={`fixed right-4 bottom-4 z-40 p-2 rounded-full bg-white/80 shadow-lg border border-gray-200 text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all duration-400 ${showBarButtonVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}
          aria-label="Show emoji bar"
          onClick={handleShowBar}
          title="Show emoji bar"
          style={{
            animation: showBarButtonVisible ? 'fadeinup 0.4s' : 'fadeoutdown 0.4s',
          }}
        >
          <ChevronsUp size={20} />
          <style>{`
            @keyframes fadeinup {
              0% { opacity: 0; transform: translateY(16px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes fadeoutdown {
              0% { opacity: 1; transform: translateY(0); }
              100% { opacity: 0; transform: translateY(16px); }
            }
          `}</style>
        </button>
      )}
      {!showPrevious && (
        activePoll
          ? <MemoizedPollCard poll={activePoll} disableVoting={false} />
          : <PollSkeleton />
      )}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg w-full h-[32rem] flex flex-col" ref={previousPollsModalRef} role="dialog" aria-modal="true" aria-label="Previous Polls">
          <DialogHeader>
            <DialogTitle>Previous Polls</DialogTitle>
            <DialogDescription>
              View the results and details of previous polls. Voting is disabled in this view.
            </DialogDescription>
            <DialogClose asChild>
              <Button variant="ghost" className="absolute right-2 top-2 focus-visible:ring-2 focus-visible:ring-emerald-500" onClick={() => setModalOpen(false)} aria-label="Close previous polls modal">
                Close
              </Button>
            </DialogClose>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2" tabIndex={0}>
            {previousPolls.length > 0 ? (
              previousPolls.map((poll) => renderPoll(poll, true))
            ) : (
              <p className="text-gray-600">No previous polls.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={votersModalOpen} onOpenChange={setVotersModalOpen}>
        <DialogContent className="max-w-xs w-full" ref={votersModalRef} role="dialog" aria-modal="true" aria-label="Voters List">
          <DialogHeader>
            <DialogTitle>Voters</DialogTitle>
            <DialogDescription>
              List of users who have voted in this poll. Hosts can remove votes from this list.
            </DialogDescription>
            <DialogClose asChild>
              <Button variant="ghost" className="absolute right-2 top-2 focus-visible:ring-2 focus-visible:ring-emerald-500" onClick={() => setVotersModalOpen(false)} aria-label="Close voters modal">
                Close
              </Button>
            </DialogClose>
          </DialogHeader>
          <div className="mb-2 text-gray-700 text-sm font-medium">{votersPollQuestion}</div>
          {votersLoading ? (
            <div className="text-gray-500 text-center py-4">Loading...</div>
          ) : voters.length === 0 ? (
            <div className="text-gray-500 text-center py-4">No votes yet.</div>
          ) : (
            <ul className="divide-y divide-gray-200 max-h-64 overflow-y-auto" tabIndex={0} aria-label="List of voters">
              {voters.map((name, i) => (
                <li key={i} className="py-2 px-1 text-gray-800 text-sm flex items-center justify-between">
                  <span>{name}</span>
                  {user?.isHost && (
                    <Button size="sm" variant="destructive" onClick={() => activePoll && removeUserVote(activePoll.id, name)}
                      className="focus-visible:ring-2 focus-visible:ring-red-500" aria-label={`Remove vote for ${name}`}
                    >
                      Remove Vote
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
      <Button
        ref={previousPollsButtonRef}
        variant="outline"
        className="mt-4 focus-visible:ring-2 focus-visible:ring-emerald-500"
        onClick={() => setModalOpen(true)}
        disabled={previousPolls.length === 0}
        aria-label="View previous polls"
      >
        View Previous Polls (Ctrl+Shift+P)
      </Button>
    </div>
  );
};

// AnimatedNumber component for smooth vote count transitions
const AnimatedNumber: React.FC<{ value: number }> = ({ value }) => {
  const spring = useSpring({
    val: value,
    config: { tension: 210, friction: 24, clamp: true },
  });
  return <animated.span>{spring.val.to(val => Math.round(val))}</animated.span>;
};

// Memoized poll option button to prevent unnecessary re-renders
const PollOptionButton = React.memo(
  ({ pollId, option, canVote, loadingVoteStatus, isUserVoted, handleVote }: {
    pollId: string;
    option: VoteOption;
    canVote: boolean;
    loadingVoteStatus: boolean;
    isUserVoted: boolean;
    handleVote: (pollId: string, optionId: string) => void;
  }) => (
    <Button
      className={
        `w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-3 text-lg block text-left break-words whitespace-pre-line overflow-visible focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 border-0 transition-none !bg-green-500 !bg-gradient-to-r !from-green-500 !to-emerald-500` +
        (loadingVoteStatus ? ' opacity-100 cursor-not-allowed' : '') +
        (isUserVoted ? ' ring-2 ring-emerald-400' : '')
      }
      disabled={loadingVoteStatus}
      tabIndex={0}
      aria-label={`Vote for option: ${option.text}`}
      onMouseDown={e => e.preventDefault()}
      onPointerDown={e => e.preventDefault()}
      onClick={e => {
        e.preventDefault();
        if (canVote && !loadingVoteStatus) handleVote(pollId, option.id);
      }}
      style={{ background: 'linear-gradient(to right, #22c55e, #059669)' }}
    >
      <span className="block w-full break-words whitespace-pre-line text-left">{option.text}</span>
    </Button>
  ),
  (prev, next) =>
    prev.option.id === next.option.id &&
    prev.option.votes === next.option.votes &&
    prev.canVote === next.canVote &&
    prev.loadingVoteStatus === next.loadingVoteStatus &&
    prev.isUserVoted === next.isUserVoted
);

// Add a memoized UndoVoteButton component at the bottom of the file
const UndoVoteButton = React.memo(
  ({ loading, onClick }: { loading: boolean; onClick: () => void }) => (
    <Button
      variant="outline"
      size="sm"
      className={
        `mt-2 focus-visible:ring-2 focus-visible:ring-emerald-500 border-0 !bg-green-500 !bg-gradient-to-r !from-green-500 !to-emerald-500 text-white transition-none` +
        (loading ? ' opacity-100 cursor-not-allowed' : '')
      }
      disabled={loading}
      aria-label="Undo your vote"
      onMouseDown={e => e.preventDefault()}
      onPointerDown={e => e.preventDefault()}
      onClick={e => {
        e.preventDefault();
        if (!loading) onClick();
      }}
      style={{ background: 'linear-gradient(to right, #22c55e, #059669)' }}
    >
      Undo Vote
    </Button>
  ),
  (prev, next) => prev.loading === next.loading && prev.onClick === next.onClick
);

export default VotingPanel;