import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/auth-forms";

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
