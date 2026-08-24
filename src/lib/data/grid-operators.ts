import { createSupabaseServerClient } from "@/lib/supabase/server";

export type GridOperatorOption = {
  id: string;
  name: string;
};

export async function listGridOperators(): Promise<GridOperatorOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("grid_operators")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("listGridOperators failed", error.message);
    return [];
  }

  return ((data ?? []) as GridOperatorOption[]).filter((row) => row.id && row.name);
}
