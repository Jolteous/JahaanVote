import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import useAppContext from '@/contexts/useAppContext';
import { Send, MessageSquare, Lightbulb, Check, Trash2 } from 'lucide-react';

const ChatPanel: React.FC = () => {
  const [message, setMessage] = useState('');
  const [isProposal, setIsProposal] = useState(false);
  const { chatMessages, addChatMessage, user, acceptProposal, deleteMessage } = useAppContext();
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [showNewMsgNotice, setShowNewMsgNotice] = React.useState(false);
  const [userScrolledUp, setUserScrolledUp] = React.useState(false);

  // Auto-scroll logic
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 40;
    if (isAtBottom) {
      container.scrollTop = container.scrollHeight;
      setShowNewMsgNotice(false);
    } else {
      setShowNewMsgNotice(true);
    }
  }, [chatMessages.length]);

  // Detect user scroll
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 40;
    setUserScrolledUp(!isAtBottom);
    if (isAtBottom) setShowNewMsgNotice(false);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && user) {
      addChatMessage({
        user: user.name,
        message: message.trim(),
        isProposal
      });
      setMessage('');
      setIsProposal(false);
    }
  };

  const handleAcceptProposal = (messageId: string, proposalText: string) => {
    acceptProposal(messageId, proposalText);
  };

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-pink-100 border-0 shadow-lg h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <MessageSquare className="text-purple-600" size={24} />
          Live Chat
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col">
        <div className="flex flex-col w-full h-72 max-h-72 min-h-0 bg-white rounded-lg shadow-md">
          <div className="flex-1 min-h-0 flex flex-col">
            <div
              className="flex-1 min-h-0 overflow-y-auto relative"
              ref={scrollContainerRef}
              onScroll={handleScroll}
            >
              {chatMessages.map((msg) => (
                <div key={msg.id} className="bg-white/70 rounded-lg p-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={msg.user.includes('HOST') ? 'destructive' : 'secondary'}>
                      {msg.user.includes('HOST') ? '👑 ' + msg.user : msg.user}
                    </Badge>
                    {msg.isProposal && (
                      <Badge variant="outline" className="text-purple-600 border-purple-600">
                        <Lightbulb size={12} className="mr-1" />
                        Proposal
                      </Badge>
                    )}
                    {msg.proposalAccepted && (
                      <Badge className="bg-green-500">
                        <Check size={12} className="mr-1" />
                        Accepted
                      </Badge>
                    )}
                    {user?.isHost && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          // Only allow delete if user has HOST in their name
                          if (user?.name && user.name.toLowerCase().includes('host')) {
                            deleteMessage(msg.id);
                          } else {
                            alert('Only hosts can delete messages.');
                          }
                        }}
                        className="ml-2 text-red-500 hover:text-red-700"
                        title="Delete Message"
                      >
                        <Trash2 size={18} />
                      </Button>
                    )}
                  </div>
                  
                  <p className="text-gray-700 text-sm">{msg.message}</p>
                  
                  {msg.isProposal && !msg.proposalAccepted && user?.isHost && (
                    <Button
                      size="sm"
                      onClick={() => handleAcceptProposal(msg.id, msg.message)}
                      className="mt-2 bg-green-500 hover:bg-green-600 text-white"
                    >
                      Accept Proposal
                    </Button>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
              {showNewMsgNotice && userScrolledUp && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-10 bg-blue-500 text-white px-3 py-1 rounded shadow cursor-pointer text-sm"
                  onClick={() => {
                    scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
                    setShowNewMsgNotice(false);
                  }}
                >
                  New message ↓
                </div>
              )}
            </div>
            <form className="flex items-center gap-2 p-2 border-t bg-gray-50" onSubmit={handleSendMessage}>
              <input
                type="text"
                className="flex-1 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="Type a message or proposal..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { handleSendMessage(e); } }}
              />
              <label className="flex items-center gap-1 cursor-pointer px-2 py-1 rounded bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 text-emerald-700 text-xs font-medium transition">
                <input
                  type="checkbox"
                  className="accent-emerald-500 h-4 w-4 rounded border border-emerald-400 focus:ring-emerald-400"
                  checked={isProposal}
                  onChange={e => setIsProposal(e.target.checked)}
                />
                <span>Proposal</span>
              </label>
              <button
                type="submit"
                className="ml-2 p-2 rounded-full bg-purple-500 hover:bg-purple-600 text-white flex items-center justify-center shadow"
                title="Send"
              >
                <Send size={20} />
              </button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChatPanel;