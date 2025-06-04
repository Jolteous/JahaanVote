import React, { useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import useAppContext from '@/contexts/useAppContext';
import { CheckCircle, Trash2, User2 } from 'lucide-react';
import type { Poll, VoteOption } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription } from '@/components/ui/dialog';

const VotingPanel: React.FC = () => {
  const { activePoll, previousPolls, vote, user, deletePoll, undoVote, removeUserVote } = useAppContext();
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

  // Check if the user has voted on the active poll
  React.useEffect(() => {
    const checkVoted = async () => {
      setLoadingVoteStatus(true);
      setHasVoted(false);
      if (!activePoll || !user?.name) {
        setLoadingVoteStatus(false);
        return;
      }
      const { data, error } = await supabase
        .from('poll_votes')
        .select('id')
        .eq('poll_id', activePoll.id)
        .eq('user_name', user.name)
        .maybeSingle();
      setHasVoted(!!data);
      setLoadingVoteStatus(false);
    };
    checkVoted();
  }, [activePoll, user?.name]);

  const handleVote = (pollId: string, optionId: string) => {
    if (!hasVoted && !loadingVoteStatus) {
      vote(pollId, optionId);
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
          {poll.options.map((option: VoteOption) => {
            const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
            return (
              <div key={option.id} className="space-y-2">
                {canVote ? (
                  <Button
                    onClick={() => handleVote(poll.id, option.id)}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-3 text-lg block text-left break-words whitespace-pre-line overflow-visible focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    disabled={loadingVoteStatus}
                    tabIndex={0}
                    aria-label={`Vote for option: ${option.text}`}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleVote(poll.id, option.id);
                      }
                    }}
                  >
                    <span className="block w-full break-words whitespace-pre-line text-left">{option.text}</span>
                  </Button>
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{option.text}</span>
                      <span className="text-sm text-gray-600">{option.votes} votes</span>
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
              <Button
                variant="outline"
                size="sm"
                className="mt-2 focus-visible:ring-2 focus-visible:ring-emerald-500"
                onClick={() => activePoll && undoVote(activePoll.id)}
                disabled={loadingVoteStatus}
                aria-label="Undo your vote"
              >
                Undo Vote
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div>
      <div ref={liveRegionRef} aria-live="polite" aria-atomic="true" className="sr-only" />
      {!showPrevious && activePoll && renderPoll(activePoll)}
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

export default VotingPanel;