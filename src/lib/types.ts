export type WordStatus = 'perfect' | 'good' | 'shaky' | 'missed' | 'extra';

export interface WordResult {
  expected: string | null;
  heard: string | null;
  status: WordStatus;
  score: number;
  issue: string | null;
}

export interface WordTiming {
  word: string;
  start_ms: number;
  end_ms: number;
}

export interface AnalysisResult {
  overall: number;
  accuracy: number;
  clarity: number;
  fluency: number;
  wpm: number;
  word_count: number;
  duration_ms: number;
  pause_count: number;
  longest_pause_ms: number;
  thought_boundary_pauses: number;
  strong_words: number;
  weak_words: string[];
  substitutions: number;
  deletions: number;
  word_results: WordResult[];
  timings: WordTiming[];
  tips: string[];
  engine: string;
}

export interface Attempt {
  id: number;
  exercise_id: string;
  sentence: string;
  heard: string;
  overall: number;
  accuracy: number;
  clarity: number;
  fluency: number;
  wpm: number;
  duration_ms: number;
  pause_count: number;
  longest_pause_ms: number;
  strong_words: number;
  substitutions: number;
  deletions: number;
  weak_words: string[];
  word_results: WordResult[];
  timings: WordTiming[];
  tips: string[];
  source: string;
  created_at: string;
}

export interface AnalyzeResponse {
  attempt: Attempt;
  analysis: AnalysisResult;
  engine_ms: number;
}

export interface SummaryStats {
  total_attempts: number;
  current_streak: number;
  daily_target: number;
  today_completed: number;
  xp: number;
  level: string;
  best_score: number;
  avg_overall: number;
  avg_accuracy: number;
  avg_clarity: number;
  avg_fluency: number;
  avg_wpm: number;
  avg_pauses: number;
  last_attempt: Attempt;
  improvement: number;
  total_practice_minutes: number;
  words_spoken: number;
  words_mastered: number;
  weakest_word: { word: string; accuracy: number } | null;
  goal: string;
}

export interface TimelineDay {
  day: string;
  overall: number; accuracy: number; clarity: number; fluency: number;
  wpm: number; attempts: number; pauses: number;
}

export interface WordMastery {
  id: number; user_id: string; word: string; attempts: number; successes: number;
  best_score: number; last_issue: string | null; accuracy: number; updated_at: string;
}

export interface Exercise {
  id: string; category: string; title: string; description: string;
  difficulty: string; xp: number; sounds: string[];
  pairs: { left: string; right: string }[];
  tip: string; color: 'gold' | 'violet';
  completions: number; best_score: number; completed: boolean;
}

export interface Sentence {
  id: string; text: string; focus: string; difficulty: number;
}

export interface Profile {
  user_id: string; display_name: string; level: string; goal: string;
  daily_target: number; streak: number; xp: number; updated_at: string;
}
