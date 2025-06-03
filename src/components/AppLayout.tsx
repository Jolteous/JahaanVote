import React from 'react';
import useAppContext from '@/contexts/useAppContext';
import UserLogin from './UserLogin';
import VotingPanel from './VotingPanel';
import ChatPanel from './ChatPanel';
import HostControls from './HostControls';
import { Badge } from '@/components/ui/badge';
import { Users, Crown, Users2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const AppLayout: React.FC = () => {
  const { user, chatMessages, addChatMessage, acceptProposal, deleteMessage, kickUser, banUser, getParticipants, isKicked, isBanned, setIsKicked, setUser } = useAppContext();
  const [participantsOpen, setParticipantsOpen] = React.useState(false);
  const [participants, setParticipants] = React.useState<string[]>([]);
  // Local state to persist the kicked screen until user acts
  const [showKickedScreen, setShowKickedScreen] = React.useState(false);

  React.useEffect(() => {
    if (isKicked) setShowKickedScreen(true);
  }, [isKicked]);

  // Always subscribe to real-time participants
  React.useEffect(() => {
    let isMounted = true;
    const update = async () => {
      const list = await getParticipants();
      if (isMounted) setParticipants(list);
    };
    update();
    const interval = setInterval(update, 2000); // update every 2s for UI sync
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [getParticipants]);

  if (!user) {
    return <UserLogin />;
  }
  if (isBanned) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-600 via-pink-500 to-orange-400">
        <div className="bg-white/90 rounded-lg shadow-xl p-8 max-w-md w-full text-center border-2 border-red-400">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Banned by host</h2>
          <p className="text-gray-700 text-lg">You have been permanently banned from this session by the host and cannot rejoin with this name.</p>
        </div>
      </div>
    );
  }
  if (showKickedScreen) {
    // Show kicked message and allow entering a new name (log out)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-600 via-pink-500 to-orange-400">
        <div className="bg-white/90 rounded-lg shadow-xl p-8 max-w-md w-full text-center border-2 border-red-400">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Kicked by host</h2>
          <p className="text-gray-700 text-lg">You have been removed from this session by the host. You may enter a new name to rejoin.</p>
          <button
            className="mt-6 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded font-semibold shadow hover:from-purple-700 hover:to-pink-700"
            onClick={() => {
              setIsKicked(false);
              setUser(null);
              setShowKickedScreen(false);
            }}
          >
            Enter a new name
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-white">
                JahaanVote
              </h1>
              <Badge className="bg-white/20 text-white border-white/30">
                <Users size={14} className="mr-1" />
                Live
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge 
                variant={user.isHost ? 'destructive' : 'secondary'}
                className={user.isHost ? 'bg-yellow-500 text-white' : ''}
              >
                {user.isHost && <Crown size={14} className="mr-1" />}
                {user.name}
              </Badge>

              <button
                className="relative p-2 rounded-full bg-white/20 hover:bg-white/30 text-white border border-white/30 flex items-center justify-center"
                title="Show Live Participants"
                onClick={() => setParticipantsOpen(true)}
              >
                <Users2 size={20} />
                <span className="sr-only">Show Participants</span>
                <span className="absolute -top-1 -right-1 bg-red-500 text-xs rounded-full px-1 text-white">{participants.length}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Voting Panel */}
          <div className="lg:col-span-2">
            <VotingPanel />
          </div>
          
          {/* Chat Panel */}
          <div className="h-96 lg:h-auto">
            <ChatPanel />
          </div>
        </div>
        
        {/* Host Controls */}
        {user.isHost && (
          <div className="mt-6">
            <HostControls />
          </div>
        )}
      </div>

      {/* Participants Dialog */}
      <Dialog open={participantsOpen} onOpenChange={setParticipantsOpen}>
        <DialogContent className="max-w-xs w-full">
          <DialogHeader>
            <DialogTitle>Live Participants</DialogTitle>
            <DialogDescription>
              List of users currently online in this session. Hosts can kick or ban users from this list.
            </DialogDescription>
            <DialogClose asChild>
              <Button variant="ghost" className="absolute right-2 top-2" onClick={() => setParticipantsOpen(false)}>
                Close
              </Button>
            </DialogClose>
          </DialogHeader>
          <ul className="divide-y divide-gray-200">
            {participants.map((name, i) => (
              <li key={i} className="py-2 px-1 text-gray-800 text-sm flex items-center justify-between">
                <span>{name}</span>
                {user?.isHost && name !== user.name && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => kickUser(name)}>
                      Kick
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => banUser(name)}>
                      Ban
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppLayout;