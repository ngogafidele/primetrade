import { ResetPasswordForm } from "@/app/reset-password/reset-password-form"

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token = "" } = await searchParams

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_14%_20%,_#dbeafe_0,_transparent_44%),radial-gradient(circle_at_86%_12%,_#fee2e2_0,_transparent_38%),radial-gradient(circle_at_55%_92%,_#fef3c7_0,_transparent_34%),linear-gradient(to_bottom,_#f8fbff,_#eef4ff)]">
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-8 sm:px-6">
        <ResetPasswordForm token={token} />
      </main>
    </div>
  )
}
