import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Poll, VoteOption } from './types';

interface User {
  id: string;
  name: string;
  isHost: boolean;
}

interface ChatMessage {
  id: string;
  user: string;
  message: string;
  timestamp: Date;
  isProposal?: boolean;
  proposalAccepted?: boolean;
}

interface AppContextType {
  user: User | null;
  setUser: (user: User) => void;
  polls: Poll[];
  activePoll: Poll | null;
  previousPolls: Poll[];
  addPoll: (poll: Omit<Poll, 'id'>) => void;
  vote: (pollId: string, optionId: string) => void;
  deletePoll: (pollId: string) => void;
  chatMessages: ChatMessage[];
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  deleteMessage: (messageId: string) => void;
  acceptProposal: (messageId: string, question: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Derived state for active/previous polls
  const activePoll = polls.length > 0 ? polls[0] : null;
  const previousPolls = polls.slice(1); // already correct, as polls are ordered DESC

  // Fetch polls and subscribe to real-time updates
  useEffect(() => {
    const fetchPolls = async () => {
      const { data, error } = await supabase
        .from('polls')
        .select('*, poll_options:poll_options_poll_id_fkey(*)')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching polls:', error);
      }
      if (!error && data) {
        console.log('Fetched polls:', data);
        setPolls(
          data.map((poll: unknown) => {
            const p = poll as { id: string; question: string; poll_options: unknown[]; active: boolean; created_at?: string };
            return {
              id: p.id,
              question: p.question,
              options: (p.poll_options || []).map((opt: unknown) => {
                const o = opt as { id: string; text: string; votes: number };
                return {
                  id: o.id,
                  text: o.text,
                  votes: o.votes,
                };
              }),
              active: p.active,
              created_at: p.created_at,
            };
          })
        );
      }
    };
    fetchPolls();

    // Real-time subscription for polls and poll_options
    const pollChannel = supabase
      .channel('polls_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'polls' },
        () => {
          fetchPolls();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_options' },
        () => {
          fetchPolls();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(pollChannel);
    };
  }, []);

  // Fetch chat messages and subscribe to real-time updates
  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('timestamp', { ascending: true });
      if (!error && data) {
        setChatMessages(
          data.map((msg: unknown) => {
            const m = msg as { id: string; user: string; message: string; timestamp: string; is_proposal?: boolean; proposal_accepted?: boolean };
            return {
              id: m.id,
              user: m.user,
              message: m.message,
              timestamp: new Date(m.timestamp),
              isProposal: m.is_proposal,
              proposalAccepted: m.proposal_accepted,
            };
          })
        );
      }
    };
    fetchMessages();

    // Real-time subscription for chat_messages
    const channel = supabase
      .channel('chat_messages_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages' },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Insert new poll into Supabase
  const addPoll = async (poll: Omit<Poll, 'id'>) => {
    const { data, error } = await supabase
      .from('polls')
      .insert([{ question: poll.question, active: poll.active, user: user?.name }])
      .select()
      .single();
    if (!error && data) {
      await Promise.all(
        poll.options.map((opt) =>
          supabase.from('poll_options').insert([
            { poll_id: data.id, text: opt.text, votes: opt.votes },
          ])
        )
      );
      // No manual refetch; real-time will update UI
    }
  };

  // Delete poll from Supabase
  const deletePoll = async (pollId: string) => {
    const { error } = await supabase.from('polls').delete().eq('id', pollId);
    if (error) {
      console.error('Error deleting poll:', error);
    }
  };

  // Vote: enforce one vote per user per poll, log in poll_votes, increment option's votes
  const vote = async (pollId: string, optionId: string) => {
    if (!user?.name) return;
    // Check if user already voted in this poll
    const { data: existingVote, error: checkError } = await supabase
      .from('poll_votes')
      .select('id')
      .eq('poll_id', pollId)
      .eq('user_name', user.name)
      .maybeSingle();
    if (existingVote) {
      // Already voted, do nothing
      return;
    }
    // Insert vote log
    const { error: insertError } = await supabase
      .from('poll_votes')
      .insert({ poll_id: pollId, option_id: optionId, user_name: user.name });
    if (insertError) {
      // Could be unique violation (race), ignore
      return;
    }
    // Atomically increment vote count in poll_options using RPC
    await supabase.rpc('increment_poll_option_vote', { opt_id: optionId });
    // No manual refetch; real-time will update UI
  };

  // Insert new chat message into Supabase
  const addChatMessage = async (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    await supabase.from('chat_messages').insert([
      {
        user: message.user,
        message: message.message,
        is_proposal: message.isProposal || false,
        proposal_accepted: message.proposalAccepted || false,
      },
    ]);
    // No manual refetch; real-time will update UI
  };

  // Delete chat message from Supabase
  const deleteMessage = async (messageId: string) => {
    const { error } = await supabase.from('chat_messages').delete().eq('id', messageId);
    if (error) {
      console.error('Error deleting chat message:', error);
    }
  };

  // Accept proposal: update proposalAccepted in Supabase and add proposal as option to current poll
  const acceptProposal = async (messageId: string, proposalText: string) => {
    // Update proposalAccepted in Supabase
    await supabase
      .from('chat_messages')
      .update({ proposal_accepted: true })
      .eq('id', messageId);
    // No manual refetch; real-time will update UI

    // Add proposal as an option to the current (active) poll
    if (polls.length > 0) {
      const activePollId = polls[0].id;
      await supabase.from('poll_options').insert([
        { poll_id: activePollId, text: proposalText, votes: 0 },
      ]);
    }
  };

  return (
    <AppContext.Provider value={{
      user, setUser,
      polls,
      activePoll,
      previousPolls,
      addPoll,
      vote,
      deletePoll,
      chatMessages,
      addChatMessage,
      deleteMessage,
      acceptProposal
    }}>
      {children}
    </AppContext.Provider>
  );
};

export { AppContext };