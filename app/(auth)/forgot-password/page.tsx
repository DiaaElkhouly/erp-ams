"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requestPasswordReset } from "@/lib/actions/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await requestPasswordReset(email);
    setLoading(false);
    if (res.success) {
      toast.success(res.message);
      // Only present in development. Everywhere else the link went to the inbox,
      // and there is deliberately nothing to show here.
      if (res.devResetUrl) setDevUrl(res.devResetUrl);
    } else {
      toast.error(res.message);
    }
  }

  return (
    <Card className="w-full max-w-md border-border/60 bg-card/85 shadow-2xl shadow-slate-900/10 backdrop-blur-xl dark:shadow-black/40">
      <CardHeader>
        <CardTitle className="text-xl">إعادة تعيين كلمة المرور</CardTitle>
        <CardDescription>سننشئ رابطًا آمنًا لإعادة تعيين كلمة المرور.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            إرسال رابط إعادة التعيين
          </Button>
        </form>

        {devUrl && (
          <div className="rounded-md border border-dashed p-3 text-xs">
            <p className="mb-1 font-medium">رابط وضع التطوير (لم يتم إعداد RESEND_API_KEY):</p>
            <Link href={devUrl} className="break-all text-primary hover:underline">{devUrl}</Link>
          </div>
        )}

        <Link href="/login" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> العودة إلى تسجيل الدخول
        </Link>
      </CardContent>
    </Card>
  );
}
