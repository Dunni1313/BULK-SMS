// Phase 1, Sprint 6 — sign-in / sign-up page. Uses Better-Auth's own React
// client (src/lib/auth-client.ts) directly, not the Orval-generated API
// client used for the rest of this app.
//
// Deliberately does NOT redirect away from any other page when unauthenticated
// (see App.tsx) — none of the existing routes are gated behind a session yet
// (Sprint 7's job, per the approved Phase 1 plan's rollback note for this
// sprint), so forcing a login wall here would be a partial, confusing
// rollout ahead of the backend routes that would actually enforce it.
import { useState } from "react";
import { useLocation } from "wouter";
import { signIn, signUp, useSession } from "@/lib/auth-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: session } = useSession();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result =
        mode === "sign-in"
          ? await signIn.email({ email, password })
          : await signUp.email({ email, password, name });
      if (result.error) {
        toast({ variant: "destructive", title: "Authentication failed", description: result.error.message });
        return;
      }
      navigate("/");
    } finally {
      setSubmitting(false);
    }
  }

  if (session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Already signed in</CardTitle>
            <CardDescription>
              Signed in as {session.user.email}.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{mode === "sign-in" ? "Sign in" : "Create an account"}</CardTitle>
          <CardDescription>
            {mode === "sign-in"
              ? "Sign in to your account."
              : "New accounts are not yet linked to your existing data — that lands in a later sprint."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === "sign-up" && (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {mode === "sign-in" ? "Sign in" : "Sign up"}
            </Button>
          </form>
          <Button
            type="button"
            variant="link"
            className="mt-2 w-full"
            onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
          >
            {mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
