import { AuthShell } from "@/components/auth-shell";
import { ResetPasswordForm } from "@/features/auth/auth-forms";

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <ResetPasswordForm />
    </AuthShell>
  );
}
