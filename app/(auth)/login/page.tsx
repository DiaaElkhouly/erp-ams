"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  Boxes,
  Eye,
  EyeOff,
  Languages,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

type FormValues = { email: string; password: string };

export default function LoginPage() {
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const schema = z.object({
    email: z.string().email(t.validEmail),
    password: z.string().min(1, t.passwordRequired),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    const res = await signIn("credentials", { ...values, redirect: false });
    setLoading(false);
    if (res?.error) {
      toast.error(t.invalidCredentials);
      return;
    }
    toast.success(t.welcomeBack);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-sm font-medium text-foreground">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <Boxes className="h-5 w-5" />
          </span>
          <span className="hidden sm:block">{t.systemName}</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 bg-card/80 backdrop-blur"
            onClick={() => setLocale(locale === "en" ? "ar" : "en")}
            aria-label={t.language}
          >
            <Languages className="h-3.5 w-3.5" />
            {locale === "en" ? t.arabic : t.englishShort}
          </Button>
          <ThemeToggle variant="outline" className="bg-card/80 backdrop-blur" />
        </div>
      </div>

      <Card className="gap-0 border-border/60 bg-card/85 shadow-2xl shadow-black/10 backdrop-blur-xl dark:shadow-black/40">
        <CardHeader className="space-y-2 p-6 text-center sm:p-8 sm:text-start">
          <CardTitle className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t.signInTo}
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed text-muted-foreground">
            {t.signInSubtitle}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">
                {t.email}
              </Label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="email"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  placeholder="you@company.com"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  className={cn(
                    "h-11 bg-background/60 ps-10 text-foreground placeholder:text-muted-foreground/70 dark:bg-background/40",
                    errors.email && "border-destructive focus-visible:ring-destructive"
                  )}
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p id="email-error" role="alert" className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password" className="text-foreground">
                  {t.password}
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t.forgotPassword}
                </Link>
              </div>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  dir="ltr"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  className={cn(
                    "h-11 bg-background/60 px-10 text-foreground placeholder:text-muted-foreground/70 dark:bg-background/40",
                    errors.password && "border-destructive focus-visible:ring-destructive"
                  )}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute end-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={showPassword ? t.hidePassword : t.showPassword}
                  title={showPassword ? t.hidePassword : t.showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" role="alert" className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" size="lg" className="h-11 w-full text-sm font-semibold shadow-lg shadow-primary/20" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {t.signIn}
            </Button>
          </form>

          <div className="mt-6 rounded-lg border border-border/60 bg-muted/50 p-3 text-center text-xs leading-relaxed text-muted-foreground">
            {t.demo}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
