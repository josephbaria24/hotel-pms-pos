"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  ACCOUNT_INACTIVE_MESSAGE,
  consumeLoginError,
  stashLoginError,
} from "@/lib/auth-messages";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    const stashed = consumeLoginError();
    if (!stashed) return;
    setError(stashed);
    toast({
      title: "Sign in blocked",
      description: stashed,
      variant: "destructive",
    });
  }, [toast]);

  function showInactiveError() {
    stashLoginError(ACCOUNT_INACTIVE_MESSAGE);
    setError(ACCOUNT_INACTIVE_MESSAGE);
    toast({
      title: "Sign in blocked",
      description: ACCOUNT_INACTIVE_MESSAGE,
      variant: "destructive",
    });
  }

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      toast({
        title: "Sign in failed",
        description: signInError.message,
        variant: "destructive",
      });
      return;
    }

    const userId = signInData.user?.id;
    if (!userId) {
      setLoading(false);
      setError("Sign in failed. Please try again.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      await supabase.auth.signOut();
      setLoading(false);
      setError(profileError.message);
      toast({
        title: "Sign in failed",
        description: profileError.message,
        variant: "destructive",
      });
      return;
    }

    if (!profile || profile.is_active === false) {
      await supabase.auth.signOut();
      setLoading(false);
      showInactiveError();
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-slate-900 p-4 sm:p-6">
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center bg-no-repeat blur-[3px]"
        style={{ backgroundImage: "url('/loginbg.png')" }}
      />
      <div
        className={cn(
          "absolute inset-0 bg-black/25 transition-colors",
          loading && "z-20 bg-black/55",
        )}
        aria-hidden={!loading}
      />
      {loading ? (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center"
          role="status"
          aria-live="polite"
          aria-label="Signing in"
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/80 px-8 py-6 text-white shadow-2xl backdrop-blur-md">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-semibold tracking-wide">Signing in…</p>
            <p className="text-xs text-white/70">Please wait</p>
          </div>
        </div>
      ) : null}
      <Card className="z-10 w-full max-w-md border-none bg-card/95 shadow-2xl backdrop-blur-sm">
        <CardHeader className="space-y-3 px-6 pb-6 pt-8 text-center sm:px-10 sm:pb-8 sm:pt-10">
          <div className="mb-2 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-white p-2 shadow-lg">
              <img
                src="/logo.png"
                alt="PalawanSU Hotel Logo"
                className="h-full w-full object-contain"
              />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
            PalawanSU Hotel
          </CardTitle>
          <CardDescription className="text-base font-medium text-muted-foreground">
            Hotel Management System
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-8 sm:px-10 sm:pb-10">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Email
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="admin@palawansu.hotel"
                        className="h-12 border-none bg-muted/50 text-base focus-visible:ring-primary"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Password
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="h-12 border-none bg-muted/50 pr-12 text-base focus-visible:ring-primary"
                          {...field}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                          onClick={() => setShowPassword((v) => !v)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {error ? (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
                >
                  {error}
                </div>
              ) : null}
              <Button
                type="submit"
                className="h-12 w-full text-base font-semibold"
                disabled={loading}
              >
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
