import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import useAppContext from '@/contexts/useAppContext';
import { Plus, Crown, Trash2 } from 'lucide-react';

const HostControls: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const { addPoll, polls, user } = useAppContext();

  const handleAddOption = () => {
    setOptions([...options, '']);
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleCreatePoll = () => {
    if (question.trim() && options.every(opt => opt.trim())) {
      addPoll({
        question: question.trim(),
        options: options.map((opt, index) => ({
          id: (index + 1).toString(),
          text: opt.trim(),
          votes: 0
        })),
        active: true
      });
      setQuestion('');
      setOptions(['', '']);
    }
  };

  if (!user?.isHost) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-yellow-50 to-orange-100 border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Crown className="text-yellow-600" size={24} />
          Host Controls
          <Badge className="bg-yellow-500 text-white">HOST</Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Poll Question
          </label>
          <Input
            placeholder="Enter your poll question..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Options
          </label>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder={`Option ${index + 1}`}
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  className="flex-1"
                />
                {options.length > 2 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveOption(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>
            ))}
          </div>
          
          <Button
            variant="outline"
            onClick={handleAddOption}
            className="mt-2 w-full border-dashed"
          >
            <Plus size={16} className="mr-2" />
            Add Option
          </Button>
        </div>
        
        <Button
          onClick={handleCreatePoll}
          disabled={!question.trim() || !options.every(opt => opt.trim())}
          className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold py-3"
        >
          Create Poll
        </Button>
        
        {polls.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium text-gray-700 mb-2">Previous Polls: {polls.length}</h4>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HostControls;