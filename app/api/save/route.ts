import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json();

  const { nameA, nameB, textA, textB, fpA, fpB, coachedText, finalDistance, judgeVerdict, userId } = body;

  if (!nameA || !nameB || !coachedText) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("grimoire_sessions")
    .insert({
      user_id: userId || "anonymous",
      name_a: nameA,
      name_b: nameB,
      text_a: textA?.slice(0, 10000) || "",
      text_b: textB?.slice(0, 10000) || "",
      fingerprint_a: fpA || {},
      fingerprint_b: fpB || {},
      coached_text: coachedText.slice(0, 10000),
      final_distance: finalDistance || 0,
      judge_verdict: judgeVerdict || null,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ saved: true, id: data.id });
}

export async function GET() {
  const { data, error } = await supabase
    .from("grimoire_sessions")
    .select("id, name_a, name_b, final_distance, judge_verdict, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ sessions: data });
}
