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

interface EmojiReaction {
  id: string;
  emoji: string;
  user_name: string;
  created_at: string;
}

interface AppContextType {
  user: User | null;
  setUser: (user: User) => void;
  polls: Poll[];
  activePoll: Poll | null;
  previousPolls: Poll[];
  addPoll: (poll: Omit<Poll, 'id'>) => void;
  vote: (pollId: string, optionId: string) => Promise<void>;
  undoVote: (pollId: string) => Promise<void>;
  deletePoll: (pollId: string) => void;
  chatMessages: ChatMessage[];
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  deleteMessage: (messageId: string) => void;
  acceptProposal: (messageId: string, question: string) => void;
  getParticipants: () => Promise<string[]>;
  kickUser: (userName: string) => Promise<void>;
  banUser: (userName: string) => Promise<void>;
  removeUserVote: (pollId: string, userName: string) => Promise<void>;
  sendEmojiReaction: (emoji: string) => void;
  emojiReactions: EmojiReaction[];
  isKicked: boolean;
  setIsKicked: (kicked: boolean) => void;
  isBanned: boolean;
  setIsBanned: (banned: boolean) => void;
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
  const [emojiReactions, setEmojiReactions] = useState<EmojiReaction[]>([]);
  const [isKicked, setIsKicked] = React.useState(false);
  const [isBanned, setIsBanned] = React.useState(false);

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

  // Fetch emoji reactions and subscribe to real-time updates
  useEffect(() => {
    const fetchEmojis = async () => {
      const { data, error } = await supabase
        .from('emoji_reactions')
        .select('*')
        .order('created_at', { ascending: true });
      if (!error && data) setEmojiReactions(data);
    };
    fetchEmojis();
    const channel = supabase
      .channel('emoji_reactions_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'emoji_reactions' },
        fetchEmojis
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // On mount, check if user is in blocklist (banned)
  React.useEffect(() => {
    if (!user?.name) return;
    const checkBlock = async () => {
      const { data } = await supabase.from('blocklist').select('user_name').eq('user_name', user.name).maybeSingle();
      setIsBanned(!!data);
    };
    checkBlock();
  }, [user?.name]);

  // Real-time banned detection
  React.useEffect(() => {
    if (!user?.name) return;
    let isMounted = true;
    const checkBlock = async () => {
      const { data } = await supabase.from('blocklist').select('user_name').eq('user_name', user.name).maybeSingle();
      if (isMounted) setIsBanned(!!data);
    };
    checkBlock();
    const blocklistChannel = supabase
      .channel('blocklist_changes_' + user.name)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blocklist', filter: `user_name=eq.${user.name}` },
        checkBlock
      )
      .subscribe();
    return () => {
      isMounted = false;
      supabase.removeChannel(blocklistChannel);
    };
  }, [user?.name]);

  // On mount, check for kicked flag in presence
  React.useEffect(() => {
    if (!user?.name) return;
    let isMounted = true;
    const checkKicked = async () => {
      // Only set kicked if not banned
      if (isBanned) {
        setIsKicked(false);
        return;
      }
      const { data: presence } = await supabase.from('presence').select('kicked').eq('user_name', user.name).maybeSingle();
      if (presence && presence.kicked && isMounted) {
        setIsKicked(true);
        // Remove the presence row so they can rejoin if not banned
        await supabase.from('presence').delete().eq('user_name', user.name);
        // Clear the kicked flag for this user so it's a one-time event
        await supabase.from('presence').upsert({ user_name: user.name, kicked: false, last_seen: new Date(0).toISOString() });
      } else if (isMounted) {
        setIsKicked(false);
      }
    };
    checkKicked();
    const presenceChannel = supabase
      .channel('presence_kick_' + user.name)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'presence', filter: `user_name=eq.${user.name}` },
        checkKicked
      )
      .subscribe();
    return () => {
      isMounted = false;
      supabase.removeChannel(presenceChannel);
    };
  }, [user?.name, isBanned]);

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
  const vote = async (pollId: string, optionId: string): Promise<void> => {
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

  // Undo vote: remove user's vote from poll_votes and decrement the option's vote count
  const undoVote = async (pollId: string): Promise<void> => {
    if (!user?.name) return;
    // Find the user's vote for this poll
    const { data: existingVote, error: checkError } = await supabase
      .from('poll_votes')
      .select('id, option_id')
      .eq('poll_id', pollId)
      .eq('user_name', user.name)
      .maybeSingle();
    if (!existingVote) {
      // No vote to undo
      return;
    }
    // Delete the vote log
    await supabase
      .from('poll_votes')
      .delete()
      .eq('id', existingVote.id);
    // Atomically decrement vote count in poll_options using RPC (assumes you have a decrement function)
    await supabase.rpc('decrement_poll_option_vote', { opt_id: existingVote.option_id });
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

  // Presence heartbeat: update presence table every 15 seconds
  React.useEffect(() => {
    if (!user?.name) return;
    let isUnmounted = false;
    const upsertPresence = async (active: boolean) => {
      const { error } = await supabase
        .from('presence')
        .upsert({ user_name: user.name, last_seen: active ? new Date().toISOString() : new Date(0).toISOString() });
      if (error) console.error('Presence upsert error:', error);
    };
    // Initial heartbeat
    upsertPresence(true);
    // Heartbeat interval
    const interval = setInterval(() => {
      if (!isUnmounted) upsertPresence(true);
    }, 15000);
    // On tab close, set last_seen to epoch (removes user quickly)
    const handleUnload = () => upsertPresence(false);
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      isUnmounted = true;
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
      upsertPresence(false); // Mark as offline on unmount
    };
  }, [user?.name]);

  // Real-time participants subscription
  const [participants, setParticipants] = React.useState<string[]>([]);
  React.useEffect(() => {
    let isMounted = true;
    const fetchAndSet = async () => {
      const since = new Date(Date.now() - 30 * 1000).toISOString();
      const { data, error } = await supabase
        .from('presence')
        .select('user_name')
        .gte('last_seen', since);
      if (!error && isMounted) {
        setParticipants((data || []).map((row: { user_name: string }) => row.user_name));
      }
    };
    fetchAndSet();
    const presenceChannel = supabase
      .channel('presence_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'presence' },
        fetchAndSet
      )
      .subscribe();
    return () => {
      isMounted = false;
      supabase.removeChannel(presenceChannel);
    };
  }, []);

  // getParticipants now returns the current state
  const getParticipants = async () => participants;

  // Kick a user (remove from presence and votes, and force refresh for the kicked user)
  const kickUser = async (userName: string) => {
    await supabase.from('poll_votes').delete().eq('user_name', userName);
    await supabase.from('presence').delete().eq('user_name', userName);
    // Send a signal to the kicked user (set a flag in their localStorage via a presence update)
    await supabase.from('presence').upsert({ user_name: userName, last_seen: new Date(0).toISOString(), kicked: true });
  };

  // Ban a user (kick + add to blocklist, and remove from presence)
  const banUser = async (userName: string) => {
    await supabase.from('poll_votes').delete().eq('user_name', userName);
    await supabase.from('presence').delete().eq('user_name', userName);
    await supabase.from('blocklist').upsert({ user_name: userName });
  };

  // On mount, check for kicked flag in presence and localStorage
  React.useEffect(() => {
    if (!user?.name) return;
    let isMounted = true;
    const checkKicked = async () => {
      // Only set kicked if not banned
      if (isBanned) {
        setIsKicked(false);
        return;
      }
      const { data: presence } = await supabase.from('presence').select('kicked').eq('user_name', user.name).maybeSingle();
      if (presence && presence.kicked && isMounted) {
        setIsKicked(true);
        // Remove the presence row so they can rejoin if not banned
        await supabase.from('presence').delete().eq('user_name', user.name);
        // Clear the kicked flag for this user so it's a one-time event
        await supabase.from('presence').upsert({ user_name: user.name, kicked: false, last_seen: new Date(0).toISOString() });
      } else if (isMounted) {
        setIsKicked(false);
      }
    };
    checkKicked();
    const presenceChannel = supabase
      .channel('presence_kick_' + user.name)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'presence', filter: `user_name=eq.${user.name}` },
        checkKicked
      )
      .subscribe();
    return () => {
      isMounted = false;
      supabase.removeChannel(presenceChannel);
    };
  }, [user?.name, isBanned]);

  // Host: remove a user's vote from a poll
  const removeUserVote = async (pollId: string, userName: string) => {
    // Find the user's vote for this poll
    const { data: existingVote } = await supabase
      .from('poll_votes')
      .select('id, option_id')
      .eq('poll_id', pollId)
      .eq('user_name', userName)
      .maybeSingle();
    if (!existingVote) return;
    // Delete the vote log
    await supabase.from('poll_votes').delete().eq('id', existingVote.id);
    // Decrement vote count in poll_options
    await supabase.rpc('decrement_poll_option_vote', { opt_id: existingVote.option_id });
  };

  // Send emoji reaction
  const sendEmojiReaction = async (emoji: string) => {
    if (!user?.name) return;
    await supabase.from('emoji_reactions').insert({ emoji, user_name: user.name });
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
      acceptProposal,
      undoVote,
      getParticipants,
      kickUser,
      banUser,
      removeUserVote,
      sendEmojiReaction,
      emojiReactions,
      isKicked,
      setIsKicked,
      isBanned,
      setIsBanned,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export { AppContext };
export type { Poll, VoteOption };