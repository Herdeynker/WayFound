import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/features/auth/auth-forms";

export default function RegisterPage() {
  return (
    <AuthShell eyebrow="A brighter tomorrow. A wider you.">
      <AuthForm mode="register" />
    </AuthShell>
  );
}
