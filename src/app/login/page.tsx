"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-secondary p-4 sm:p-6">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=2070')] bg-cover bg-center opacity-10 mix-blend-luminosity" />
      <Card className="z-10 w-full max-w-md border-none bg-card shadow-2xl">
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
                <p className="text-sm text-destructive">{error}</p>
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
