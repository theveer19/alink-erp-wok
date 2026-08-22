"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();
  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };
  return (
    <button onClick={logout} className="inline-flex items-center gap-1 text-slate-300 hover:text-white">
      <LogOut size={15} /> Sign out
    </button>
  );
}
