import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface GrimoireSession {
  id?: string;
  user_id?: string;
  name_a: string;
  name_b: string;
  text_a: string;
  text_b: string;
  fingerprint_a: Record<string, number>;
  fingerprint_b: Record<string, number>;
  coached_text: string;
  final_distance: number;
  judge_verdict: { sameAuthor: boolean; confidence: number; reasoning: string } | null;
  created_at?: string;
}

export async function saveSession(session: Omit<GrimoireSession, "id" | "created_at">) {
  const { data, error } = await supabase
    .from("grimoire_sessions")
    .insert(session)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function loadSessions(limit = 20) {
  const { data, error } = await supabase
    .from("grimoire_sessions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as GrimoireSession[];
}
