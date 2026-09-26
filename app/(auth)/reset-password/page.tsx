"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { resetPassword } from "@/lib/actions/auth";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await resetPassword({ token, password });
    setLoading(false);
    if (res.success) {
      toast.success(res.message);
      router.push("/login");
    } else {
      toast.error(res.message);
    }
  }

  return (
    <Card className="border-white/10 bg-white/95 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-xl">تعيين كلمة مرور جديدة</CardTitle>
        <CardDescription>اختر كلمة مرور قوية من 8 أحرف على الأقل.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">كلمة المرور الجديدة</Label>
            <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !token}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            تحديث كلمة المرور
          </Button>
          {!token && <p className="text-xs text-destructive">رمز إعادة التعيين مفقود أو غير صالح.</p>}
        </form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
