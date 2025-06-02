import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import useAppContext from '@/contexts/useAppContext';
import { CheckCircle, Trash2, User2 } from 'lucide-react';
import type { Poll, VoteOption } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';

const VotingPanel: React.FC = () => {
  const { activePoll, previousPolls, vote, user, deletePoll } = useAppContext();
  const [hasVoted, setHasVoted] = React.useState(false);
  const [showPrevious, setShowPrevious] = React.useState(false);
  const [loadingVoteStatus, setLoadingVoteStatus] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [votersModalOpen, setVotersModalOpen] = React.useState(false);
  const [voters, setVoters] = React.useState<string[]>([]);
  const [votersLoading, setVotersLoading] = React.useState(false);
  const [votersPollQuestion, setVotersPollQuestion] = React.useState<string>('');

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
              className="ml-1 p-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 border border-gray-200"
              title="Show voters"
              onClick={() => handleShowVoters(poll.id, poll.question)}
              style={{ lineHeight: 0 }}
            >
              <User2 size={18} />
            </button>
            {user?.isHost && !disableVoting && (
              <Button size="icon" variant="ghost" onClick={() => deletePoll(poll.id)} className="ml-2 text-red-500 hover:text-red-700" title="Delete Poll">
                <Trash2 size={20} />
              </Button>
            )}
          </CardTitle>
          {totalVotes > 0 && (
            <p className="text-gray-600">{totalVotes} total votes</p>
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
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-3 text-lg"
                    disabled={loadingVoteStatus}
                  >
                    {option.text}
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
            <div className="flex items-center justify-center gap-2 mt-4 text-green-600">
              <CheckCircle size={20} />
              <span className="font-medium">You have voted!</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div>
      {!showPrevious && activePoll && renderPoll(activePoll)}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg w-full h-[32rem] flex flex-col">
          <DialogHeader>
            <DialogTitle>Previous Polls</DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" className="absolute right-2 top-2" onClick={() => setModalOpen(false)}>
                Close
              </Button>
            </DialogClose>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            {previousPolls.length > 0 ? (
              previousPolls.map((poll) => renderPoll(poll, true))
            ) : (
              <p className="text-gray-600">No previous polls.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={votersModalOpen} onOpenChange={setVotersModalOpen}>
        <DialogContent className="max-w-xs w-full">
          <DialogHeader>
            <DialogTitle>Voters</DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" className="absolute right-2 top-2" onClick={() => setVotersModalOpen(false)}>
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
            <ul className="divide-y divide-gray-200">
              {voters.map((name, i) => (
                <li key={i} className="py-2 px-1 text-gray-800 text-sm">{name}</li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
      <Button
        variant="outline"
        className="mt-4"
        onClick={() => setModalOpen(true)}
        disabled={previousPolls.length === 0}
      >
        View Previous Polls
      </Button>
    </div>
  );
};

export default VotingPanel;