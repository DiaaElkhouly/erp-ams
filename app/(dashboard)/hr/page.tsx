"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Users, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect } from "@/components/ui/select-native";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate, formatPercent, formatTime } from "@/lib/utils";

const EMPLOYEE_STATUS_VARIANT: Record<string, "secondary" | "default" | "destructive"> = {
  ACTIVE: "default", ON_LEAVE: "secondary", TERMINATED: "destructive",
};
const EMPLOYEE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "على رأس العمل", ON_LEAVE: "في إجازة", TERMINATED: "منتهي الخدمة",
};

const ATTENDANCE_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  PRESENT: "default", LATE: "secondary", ABSENT: "destructive", LEAVE: "secondary",
};
const ATTENDANCE_LABELS: Record<string, string> = {
  PRESENT: "حاضر", LATE: "متأخر", ABSENT: "غائب", LEAVE: "إجازة",
};

/** YYYY-MM-DD in local time, which is what an `<input type="date">` hands back. */
function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function useEmployees() {
  return useQuery({ queryKey: ["employees"], queryFn: () => fetch("/api/employees").then((r) => r.json()) });
}
function useAttendance(date: string, employeeId: string) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (employeeId) params.set("employeeId", employeeId);
  return useQuery({
    queryKey: ["attendance", date, employeeId],
    queryFn: () => fetch(`/api/attendance?${params}`).then((r) => r.json()),
  });
}

function NewEmployeeDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employeeCode: "", firstName: "", lastName: "", email: "", phone: "",
    department: "", position: "", hireDate: "",
  });
  const qc = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, hireDate: form.hireDate || undefined }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "تعذّر إضافة الموظف");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("تمت إضافة الموظف");
      setOpen(false);
      setForm({ employeeCode: "", firstName: "", lastName: "", email: "", phone: "", department: "", position: "", hireDate: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSave = Boolean(form.employeeCode && form.firstName && form.lastName && form.department && form.position);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> موظف جديد</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة موظف</DialogTitle>
          <DialogDescription>الرقم الوظيفي فريد ويُستخدم في سجل الحضور.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="emp-code">الرقم الوظيفي</Label>
            <Input id="emp-code" value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-hire">تاريخ التعيين</Label>
            <Input id="emp-hire" type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-first">الاسم الأول</Label>
            <Input id="emp-first" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-last">اسم العائلة</Label>
            <Input id="emp-last" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-email">البريد الإلكتروني</Label>
            <Input id="emp-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-phone">الهاتف</Label>
            <Input id="emp-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-dept">القسم</Label>
            <Input id="emp-dept" placeholder="مثال: الإنتاج" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-position">المسمى الوظيفي</Label>
            <Input id="emp-position" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={isPending || !canSave} onClick={() => mutate()}>{isPending ? "جارٍ الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmployeesTab() {
  const { data, isLoading } = useEmployees();
  const qc = useQueryClient();
  const employees = data?.employees ?? [];

  const { mutate: update, isPending: updating } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "تعذّر تحديث الموظف");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("تم تحديث حالة الموظف");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => fetch(`/api/employees/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("تم حذف سجل الموظف");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><NewEmployeeDialog /></div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الرقم</TableHead>
              <TableHead>الاسم</TableHead>
              <TableHead>القسم</TableHead>
              <TableHead>المسمى</TableHead>
              <TableHead>تاريخ التعيين</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 7 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
            ))}
            {!isLoading && employees.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  <Users className="mx-auto mb-2 h-6 w-6" /> لا يوجد موظفون بعد.
                </TableCell>
              </TableRow>
            )}
            {employees.map((employee: any) => (
              <TableRow key={employee.id}>
                <TableCell className="font-mono text-xs">{employee.employeeCode}</TableCell>
                <TableCell className="font-medium">
                  {employee.firstName} {employee.lastName}
                  {employee.email && <span className="block text-xs font-normal text-muted-foreground">{employee.email}</span>}
                </TableCell>
                <TableCell>{employee.department}</TableCell>
                <TableCell>{employee.position}</TableCell>
                <TableCell>{employee.hireDate ? formatDate(employee.hireDate) : "—"}</TableCell>
                <TableCell>
                  <Badge variant={EMPLOYEE_STATUS_VARIANT[employee.status]}>{EMPLOYEE_STATUS_LABELS[employee.status]}</Badge>
                </TableCell>
                <TableCell className="flex gap-1">
                  {/* Leave and reactivation, not an edit form: the fields that make
                      someone an employee are set on the record, not toggled daily. */}
                  {employee.status === "ACTIVE" && (
                    <Button size="sm" variant="outline" disabled={updating} onClick={() => update({ id: employee.id, status: "ON_LEAVE" })}>
                      إجازة
                    </Button>
                  )}
                  {employee.status === "ON_LEAVE" && (
                    <Button size="sm" variant="outline" disabled={updating} onClick={() => update({ id: employee.id, status: "ACTIVE" })}>
                      العودة
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => remove(employee.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * Punch card for one employee-day.
 *
 * Sending both punches at once, rather than one per click, is deliberate: a record
 * with only a check-in reports `unreliable` worked hours, and half a day is not a
 * number anyone wants in payroll.
 */
function AttendanceDialog() {
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(today());
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [status, setStatus] = useState("");
  const qc = useQueryClient();
  const { data: employeeData } = useEmployees();

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          date,
          checkIn: checkIn ? `${date}T${checkIn}:00` : undefined,
          checkOut: checkOut ? `${date}T${checkOut}:00` : undefined,
          status: status || undefined,
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "تعذّر تسجيل الحضور");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("تم تسجيل الحضور");
      setOpen(false);
      setEmployeeId("");
      setCheckIn("");
      setCheckOut("");
      setStatus("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> تسجيل حضور</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تسجيل حضور</DialogTitle>
          <DialogDescription>
            تُشتق الحالة من أوقات الدخول والخروج؛ الإجازة والغياب يُسجّلان بناءً على قرار مشرف.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="att-employee">الموظف</Label>
            <NativeSelect id="att-employee" className="w-full" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">اختر الموظف...</option>
              {employeeData?.employees?.map((e: any) => (
                <option key={e.id} value={e.id}>{e.employeeCode} — {e.firstName} {e.lastName}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="att-date">التاريخ</Label>
            <Input id="att-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="att-in">وقت الدخول</Label>
              <Input id="att-in" type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="att-out">وقت الخروج</Label>
              <Input id="att-out" type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="att-status">تعديل الحالة</Label>
            <NativeSelect id="att-status" className="w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">مشتق تلقائياً</option>
              <option value="LEAVE">إجازة</option>
              <option value="ABSENT">غياب</option>
            </NativeSelect>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={isPending || !employeeId} onClick={() => mutate()}>{isPending ? "جارٍ الحفظ..." : "تسجيل"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttendanceTab() {
  const [date, setDate] = useState(today());
  const { data, isLoading } = useAttendance(date, "");
  const records = data?.attendance ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="attendance-date">التاريخ</Label>
            <Input id="attendance-date" type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <AttendanceDialog />
      </div>

      {summary && (
        <div className="flex flex-wrap gap-4 text-sm">
          <span>حاضر: <span className="font-medium">{summary.present}</span></span>
          <span>متأخر: <span className="font-medium">{summary.late}</span></span>
          <span>غياب: <span className="font-medium text-destructive">{summary.absent}</span></span>
          <span>إجازة: <span className="font-medium">{summary.leave}</span></span>
          <span>
            نسبة الحضور:{" "}
            <span className={summary.attendanceRatePercent < 90 ? "font-medium text-destructive" : "font-medium"}>
              {formatPercent(summary.attendanceRatePercent)}
            </span>
          </span>
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الموظف</TableHead>
              <TableHead>الدخول</TableHead>
              <TableHead>الخروج</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>ملاحظات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 5 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
            ))}
            {!isLoading && records.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  <CalendarCheck className="mx-auto mb-2 h-6 w-6" /> لا يوجد سجل حضور لهذا اليوم.
                </TableCell>
              </TableRow>
            )}
            {records.map((record: any) => (
              <TableRow key={record.id}>
                <TableCell>
                  <span className="font-mono text-xs text-muted-foreground">{record.employee?.employeeCode}</span>
                  <span className="block font-medium">{record.employee?.firstName} {record.employee?.lastName}</span>
                </TableCell>
                <TableCell>{record.checkIn ? formatTime(record.checkIn) : "—"}</TableCell>
                <TableCell>{record.checkOut ? formatTime(record.checkOut) : "—"}</TableCell>
                <TableCell>
                  <Badge variant={ATTENDANCE_VARIANT[record.status]}>{ATTENDANCE_LABELS[record.status]}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{record.notes ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function HrPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">الموارد البشرية</h1>
        <p className="text-sm text-muted-foreground">سجل الموظفين وتتبّع الحضور اليومي.</p>
      </div>

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">الموظفون</TabsTrigger>
          <TabsTrigger value="attendance">الحضور</TabsTrigger>
        </TabsList>
        <TabsContent value="employees"><EmployeesTab /></TabsContent>
        <TabsContent value="attendance"><AttendanceTab /></TabsContent>
      </Tabs>
    </div>
  );
}