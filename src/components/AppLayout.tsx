import React from 'react';
import useAppContext from '@/contexts/useAppContext';
import UserLogin from './UserLogin';
import VotingPanel from './VotingPanel';
import ChatPanel from './ChatPanel';
import HostControls from './HostControls';
import { Badge } from '@/components/ui/badge';
import { Users, Crown } from 'lucide-react';

const AppLayout: React.FC = () => {
  const { user } = useAppContext();

  if (!user) {
    return <UserLogin />;
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
    </div>
  );
};

export default AppLayout;