import LoginForm from "./login-form";

// This route talks to Supabase at request time — never prerender it.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm />;
}
