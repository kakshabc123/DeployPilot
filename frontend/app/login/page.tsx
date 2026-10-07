import { AuthForm } from "@/components/auth-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type LoginPageProps = {
  searchParams: { next?: string; setup?: string; error?: string };
};

function safeNextPath(value: string | undefined): string {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/dashboard";
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <AuthForm
      mode="login"
      configured={isSupabaseConfigured()}
      nextPath={safeNextPath(searchParams.next)}
      setupRequired={searchParams.setup === "required"}
      callbackError={searchParams.error === "confirmation"}
    />
  );
}
