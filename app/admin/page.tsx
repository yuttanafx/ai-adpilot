import { redirect } from "next/navigation";
import AdminPanel from "@/components/AdminPanel";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  return <AdminPanel meId={user.id} />;
}
