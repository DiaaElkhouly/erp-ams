"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { toast } from "sonner";
import { Boxes, Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

type FormValues = { email: string; password: string };

export default function LoginPage() {
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const schema = z.object({
    email: z.string().email(t.validEmail),
    password: z.string().min(1, t.passwordRequired),
  });
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
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
    <div className="relative pt-12">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="absolute top-0 end-0 gap-2 bg-white/90"
        onClick={() => setLocale(locale === "en" ? "ar" : "en")}
        aria-label={t.language}
      >
        <Languages className="h-3.5 w-3.5" />
        {locale === "en" ? "عربي" : "EN"}
      </Button>
      <Card className="border-white/10 bg-white/95 backdrop-blur">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Boxes className="h-5 w-5" />
        </div>
        <CardTitle className="text-xl">{t.signInTo}</CardTitle>
        <CardDescription>{t.systemName}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t.email}</Label>
            <Input id="email" type="email" placeholder="you@company.com" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t.password}</Label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                {t.forgotPassword}
              </Link>
            </div>
            <Input id="password" type="password" placeholder="••••••••" {...register("password")} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t.signIn}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t.demo}
        </p>
      </CardContent>
      </Card>
    </div>
  );
}
