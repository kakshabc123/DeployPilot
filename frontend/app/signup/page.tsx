import { AuthForm } from "@/components/auth-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type SignupPageProps = {
  searchParams: { next?: string; setup?: string; error?: string };
};

function safeNextPath(value: string | undefined): string {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/dashboard";
}

export default function SignupPage({ searchParams }: SignupPageProps) {
  return (
    <AuthForm
      mode="signup"
      configured={isSupabaseConfigured()}
      nextPath={safeNextPath(searchParams.next)}
      setupRequired={searchParams.setup === "required"}
      callbackError={searchParams.error === "confirmation"}
    />
  );
}
