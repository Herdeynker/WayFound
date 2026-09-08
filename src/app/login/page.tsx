import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/features/auth/auth-forms";

export default function LoginPage() {
  return (
    <AuthShell>
      <AuthForm mode="login" />
    </AuthShell>
  );
}
