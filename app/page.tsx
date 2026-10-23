import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <Dashboard user={{ displayName: user.displayName, role: user.role }} />;
}
