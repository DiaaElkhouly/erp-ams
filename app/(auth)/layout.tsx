export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
