import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { Dashboard } from "@/components/dashboard/dashboard";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <Dashboard
      user={{
        name: session.user?.name ?? null,
        image: session.user?.image ?? null,
        email: session.user?.email ?? null,
      }}
    />
  );
}
