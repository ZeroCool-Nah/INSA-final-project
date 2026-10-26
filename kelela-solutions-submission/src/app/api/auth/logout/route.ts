import { clearSession } from "@/lib/auth";

export async function POST() {
  clearSession();
  return Response.json({ data: { message: "Signed out." } });
}
