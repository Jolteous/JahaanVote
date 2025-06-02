// Shared types for AppContext

export interface VoteOption {
  id: string;
  text: string;
  votes: number;
}

export interface Poll {
  id: string;
  question: string;
  options: VoteOption[];
  active: boolean;
  created_at?: string;
}
