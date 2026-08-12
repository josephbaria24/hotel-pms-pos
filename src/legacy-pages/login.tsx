import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Hotel, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const { toast } = useToast();
  const { setUser } = useAuth();
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "admin",
      password: "admin123",
    },
  });

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    try {
      const result = await loginMutation.mutateAsync({ data: values });
      if (result?.user) {
        setUser(result.user);
      }
    } catch (err: any) {
      toast({
        title: "Login failed",
        description: err.message || "Please check your credentials and try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-secondary relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=2070')] opacity-10 bg-cover bg-center mix-blend-luminosity"></div>
      <Card className="w-full max-w-md z-10 border-none shadow-2xl bg-card">
        <CardHeader className="space-y-3 pb-8 pt-10 text-center">
          <div className="flex justify-center mb-2">
            <div className="h-16 w-16 bg-white rounded-xl flex items-center justify-center shadow-lg p-2 overflow-hidden">
              <img src="logo.png" alt="PalawanSU Hotel Logo" className="w-full h-full object-contain" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">PalawanSU Hotel</CardTitle>
          <CardDescription className="text-base font-medium text-muted-foreground">Hotel Management System</CardDescription>
        </CardHeader>
        <CardContent className="px-10 pb-10">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Username</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="admin"
                        data-testid="input-username"
                        {...field}
                        className="h-12 bg-muted/50 border-none focus-visible:ring-primary text-base"
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
                    <FormLabel className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="admin123"
                          data-testid="input-password"
                          {...field}
                          className="h-12 bg-muted/50 border-none focus-visible:ring-primary text-base pr-12 w-full"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none p-1.5 rounded-md hover:bg-muted/80 cursor-pointer transition-colors"
                          title={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                data-testid="button-sign-in"
                className="w-full h-12 text-base font-bold shadow-md hover:shadow-lg transition-all"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Authenticating..." : "Sign In"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
