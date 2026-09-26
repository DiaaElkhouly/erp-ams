"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed"];

export function WorkOrderStatusChart({ data }: { data: { status: string; count: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>أوامر الإنتاج حسب الحالة</CardTitle>
        <CardDescription>مسار الإنتاج الحالي</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="status" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function InventoryByTypeChart({ data }: { data: { type: string; qty: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>المخزون المتاح حسب نوع الصنف</CardTitle>
        <CardDescription>إجمالي الوحدات في جميع المستودعات</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
            <XAxis dataKey="type" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="qty" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function OrdersTrendChart({ data }: { data: { label: string; sales: number; purchase: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>نظرة عامة على الطلبات</CardTitle>
        <CardDescription>طلبات البيع مقابل طلبات الشراء</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="sales" stroke="#16a34a" strokeWidth={2} />
            <Line type="monotone" dataKey="purchase" stroke="#f59e0b" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
