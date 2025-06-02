import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import useAppContext from '@/contexts/useAppContext';
import { supabase } from '@/lib/supabaseClient';

const UserLogin: React.FC = () => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setUser } = useAppContext();

  const handleLogin = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    const isHost = name.toUpperCase().includes('HOST');
    try {
      // Try to find existing user
      const { data: existing, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('name', name.trim())
        .eq('is_host', isHost)
        .single();
      let userRecord = existing;
      if (!userRecord) {
        // Insert new user
        const { data, error: insertError } = await supabase
          .from('users')
          .insert([{ name: name.trim(), is_host: isHost }])
          .select()
          .single();
        if (insertError) throw insertError;
        userRecord = data;
      }
      setUser({
        id: userRecord.id,
        name: userRecord.name,
        isHost: userRecord.is_host,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-white/90 backdrop-blur-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            JahaanVote
          </CardTitle>
          <p className="text-gray-600 mt-2">Enter your name to join the voting</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            className="text-lg py-3"
            disabled={loading}
          />
          <Button 
            onClick={handleLogin}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 text-lg"
            disabled={!name.trim() || loading}
          >
            {loading ? 'Joining...' : 'Join JahaanVote'}
          </Button>
          {error && <div className="text-red-500 text-center text-sm">{error}</div>}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserLogin;