import "server-only";
import { withUser } from "./db";

export type HomeStatus = {
  status: "zweryfikowany" | "wstrzymany" | "do_weryfikacji";
  ground: string | null;
  reason: string | null;
  since: Date | null;
  appeal_id: string | null;
  appeal_body: string | null;
  appeal_created_at: Date | null;
  appeal_answer: string | null;
  appeal_outcome: "przywrocony" | "utrzymane" | null;
  appeal_answered_at: Date | null;
};

/** Status zakładu dla jego pracowników (my_home_status sprawdza członkostwo). */
export async function homeStatus(userId: string, homeId: string): Promise<HomeStatus> {
  const [row] = await withUser(userId, (tx) => tx<HomeStatus[]>`select * from my_home_status(${homeId})`);
  return row;
}
