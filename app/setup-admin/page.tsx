"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { KeyRound, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function SetupAdminPage() {
  const router = useRouter()
  const [setupName, setSetupName] = useState("")
  const [setupEmail, setSetupEmail] = useState("")
  const [setupPassword, setSetupPassword] = useState("")
  const [setupConfirmPassword, setSetupConfirmPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSetup = () => {
    setMessage(null)
    if (setupPassword !== setupConfirmPassword) {
      setMessage("Admin setup passwords do not match")
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: setupName,
            email: setupEmail,
            password: setupPassword,
          }),
        })

        const data = await response.json()
        if (!response.ok) {
          setMessage(data?.error ?? "Setup failed")
          return
        }

        router.push("/dashboard")
        router.refresh()
      } catch (error) {
        setMessage("Network error. Check your connection and try again.")
      }
    })
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_16%_18%,_#dbeafe_0,_transparent_45%),radial-gradient(circle_at_85%_12%,_#fee2e2_0,_transparent_40%),radial-gradient(circle_at_52%_88%,_#fef3c7_0,_transparent_40%),linear-gradient(to_bottom,_#f8fbff,_#eef4ff)]">
      <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 size-80 rounded-full bg-red-500/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 size-72 rounded-full bg-amber-400/20 blur-3xl" />

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" />
            One-time admin setup
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/">Back to login</Link>
          </Button>
        </div>

        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="space-y-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-white/90 p-2 shadow-[0_18px_45px_-30px_rgba(30,64,175,0.75)]">
                <Image
                  src="/images/logo.png"
                  alt="Prime Trade logo"
                  width={72}
                  height={72}
                  className="h-full w-full object-contain"
                  priority
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                  Prime Trade Company Ltd Inventory
                </p>
                <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">Admin setup</h1>
              </div>
            </div>
            <p className="max-w-xl text-sm text-muted-foreground">
              Create the initial admin account for the operations hub. You only need to do this once per business.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-white/70 p-4 shadow-sm">
                <p className="text-sm font-medium">What you will need</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>Admin name and email</li>
                  <li>Secure password</li>
                </ul>
              </div>
              <div className="rounded-xl border border-border/60 bg-white/70 p-4 shadow-sm">
                <p className="text-sm font-medium">What happens next</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>Admin account created</li>
                  <li>Redirect to dashboard</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-white/80 p-6 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.6)] backdrop-blur">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <h2 className="text-lg font-semibold">Create admin</h2>
            </div>
            <p className="text-sm text-muted-foreground">Create the initial admin account (run once).</p>
            <div className="mt-4 space-y-3">
              <Input
                placeholder="Full name"
                value={setupName}
                onChange={(event) => setSetupName(event.target.value)}
              />
              <Input
                placeholder="Admin email"
                value={setupEmail}
                onChange={(event) => setSetupEmail(event.target.value)}
                type="email"
              />
              <Input
                placeholder="Admin password"
                value={setupPassword}
                onChange={(event) => setSetupPassword(event.target.value)}
                type="password"
              />
              <Input
                placeholder="Confirm admin password"
                value={setupConfirmPassword}
                onChange={(event) => setSetupConfirmPassword(event.target.value)}
                type="password"
              />
              <Button variant="secondary" onClick={handleSetup} disabled={isPending} className="w-full">
                Create admin
              </Button>
            </div>

            {message ? (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {message}
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Already set up?</span>
              <Button asChild size="sm">
                <Link href="/">Back to login</Link>
              </Button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
