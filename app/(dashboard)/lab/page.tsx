"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUpRight, ClipboardCheck, FlaskConical, Plus, Ruler, Save, ShieldCheck, SlidersHorizontal, TestTube2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";

type TestDefinition = { group: string; groupAr: string; groupEn: string; nameAr: string; nameEn: string; unit: string; standard: string; materials: string[] };
type Material = { id: string; nameAr: string; nameEn: string; category: string };

const materials: Material[] = [
  { id: "sand", nameAr: "الرمل", nameEn: "Sand", category: "aggregate" },
  { id: "aggregate1", nameAr: "السن 1", nameEn: "Aggregate 1", category: "aggregate" },
  { id: "aggregateHalf", nameAr: "السن نص", nameEn: "Aggregate 1/2", category: "aggregate" },
  { id: "cement", nameAr: "الأسمنت", nameEn: "Cement", category: "cement" },
  { id: "water", nameAr: "المياه", nameEn: "Water", category: "water" },
  { id: "fresh", nameAr: "الخلطة الطازجة", nameEn: "Fresh mix", category: "fresh" },
  { id: "hardened", nameAr: "الخرسانة المتصلدة", nameEn: "Hardened concrete", category: "hardened" },
  { id: "block", nameAr: "البلوك الأسمنتي", nameEn: "Concrete block", category: "block" },
  { id: "brick", nameAr: "الطوب الأسمنتي", nameEn: "Concrete brick", category: "brick" },
  { id: "paver", nameAr: "الإنترلوك", nameEn: "Interlock paver", category: "paver" },
];

const definitions: TestDefinition[] = [
  ...[
    ["Sieve analysis", "التحليل المنخلي", "%", "ASTM C136/C117 · EN 933-1"],
    ["Grading", "التدرج الحبيبي (انحراف المنحنى)", "%", "ASTM C33 · EN 12620"],
    ["Loose bulk density", "الوزن الحجمي المفكوك", "kg/m³", "ASTM C29"],
    ["Compacted bulk density", "الوزن الحجمي المدكوك", "kg/m³", "ASTM C29"],
    ["Specific gravity", "الكثافة النوعية", "—", "ASTM C127/C128"],
    ["Water absorption", "الامتصاص", "%", "ASTM C127/C128"],
    ["Moisture content", "نسبة الرطوبة", "%", "ASTM C566"],
    ["Voids", "الفراغات", "%", "ASTM C29"],
    ["Material finer than 75 μm", "المواد الناعمة المارة من منخل 75 ميكرون", "%", "ASTM C117"],
    ["Clay and fine particles", "نسبة الطين والمواد العضوية", "%", "ASTM C142"],
    ["Organic impurities", "الشوائب العضوية", "—", "ASTM C40"],
  ].map(([nameEn, nameAr, unit, standard]) => ({ group: "aggregate-physical", groupAr: "الركام · اختبارات فيزيائية", groupEn: "Aggregates · Physical", nameAr, nameEn, unit, standard, materials: ["sand", "aggregate1", "aggregateHalf"] })),
  ...[
    ["Fineness modulus", "معامل النعومة للرمل", "—", "ASTM C136"],
    ["Sand equivalent", "المكافئ الرملي", "%", "ASTM D2419"],
  ].map(([nameEn, nameAr, unit, standard]) => ({ group: "aggregate-fine", groupAr: "الركام · اختبارات الرمل", groupEn: "Aggregates · Fine", nameAr, nameEn, unit, standard, materials: ["sand"] })),
  ...[
    ["Los Angeles abrasion", "اختبار التهشم (لوس أنجلوس)", "%", "ASTM C131/C535"],
    ["Aggregate crushing value", "قيمة التكسير", "%", "BS 812-110"],
    ["Aggregate impact value", "قيمة الصدم", "%", "BS 812-112"],
    ["Flakiness index", "شكل الحبيبات (معامل التفلطح)", "%", "EN 933-3"],
    ["Elongation index", "الاستطالة", "%", "BS 812-105.2"],
    ["Load-bearing capacity", "قوة التحمل", "MPa", "مواصفة المشروع"],
  ].map(([nameEn, nameAr, unit, standard]) => ({ group: "aggregate-coarse", groupAr: "الركام · اختبارات السن", groupEn: "Aggregates · Coarse only", nameAr, nameEn, unit, standard, materials: ["aggregate1", "aggregateHalf"] })),
  ...[
    ["Sulfates", "الكبريتات", "%", "مواصفة المشروع"],
    ["Chlorides", "الكلوريدات", "%", "ASTM C1218"],
    ["Soluble salts", "الأملاح الذائبة", "mg/L", "مواصفة المشروع"],
    ["Reactive silica", "السليكا النشطة (عند الحاجة)", "%", "ASTM C1260/C1293"],
    ["pH", "الرقم الهيدروجيني", "pH", "طريقة معتمدة للمختبر"],
  ].map(([nameEn, nameAr, unit, standard]) => ({ group: "aggregate-chemical", groupAr: "الركام · اختبارات كيميائية", groupEn: "Aggregates · Chemical", nameAr, nameEn, unit, standard, materials: ["sand", "aggregate1", "aggregateHalf"] })),
  ...[
    ["Blaine fineness", "النعومة (بلين)", "cm²/g", "ASTM C204"],
    ["Initial setting time", "زمن الشك الابتدائي", "min", "ASTM C191"],
    ["Final setting time", "زمن الشك النهائي", "min", "ASTM C191"],
    ["Standard consistency", "القوام القياسي", "%", "ASTM C187"],
    ["Soundness", "الثبات", "mm", "ASTM C151/C151M"],
    ["Compressive strength · 2 days", "مقاومة الضغط · يومان", "MPa", "ASTM C109"],
    ["Compressive strength · 7 days", "مقاومة الضغط · 7 أيام", "MPa", "ASTM C109"],
    ["Compressive strength · 28 days", "مقاومة الضغط · 28 يوماً", "MPa", "ASTM C109"],
    ["Specific gravity", "الكثافة النوعية", "—", "ASTM C188"],
    ["Bulk density", "الوزن الحجمي", "kg/m³", "طريقة المختبر المعتمدة"],
    ["Heat of hydration", "حرارة الإماهة", "J/g", "ASTM C1702"],
    ["Loss on ignition (LOI)", "الفقد بالحريق (LOI)", "%", "ASTM C114"],
    ...[["SiO₂", "ثاني أكسيد السيليكون"], ["Al₂O₃", "أكسيد الألومنيوم"], ["Fe₂O₃", "أكسيد الحديد"], ["CaO", "أكسيد الكالسيوم"], ["MgO", "أكسيد المغنيسيوم"], ["SO₃", "ثالث أكسيد الكبريت"], ["Na₂O", "أكسيد الصوديوم"], ["K₂O", "أكسيد البوتاسيوم"], ["Cl", "الكلوريد"], ["LOI", "الفقد بالحريق"]].map(([oxide, nameAr]) => [oxide, `${nameAr} (${oxide})`, "%", "ASTM C114"]),
  ].map(([nameEn, nameAr, unit, standard]) => ({ group: "cement", groupAr: "الأسمنت", groupEn: "Cement", nameAr, nameEn, unit, standard, materials: ["cement"] })),
  ...[
    ["pH", "الرقم الهيدروجيني", "pH", "ASTM D1293"],
    ["Chlorides", "الكلوريدات", "mg/L", "ASTM D512"],
    ["Sulfates", "الكبريتات", "mg/L", "ASTM D516"],
    ["Total dissolved solids", "الأملاح الذائبة الكلية", "mg/L", "ASTM D5907"],
    ["Organic matter", "المواد العضوية", "mg/L", "ASTM D1252"],
  ].map(([nameEn, nameAr, unit, standard]) => ({ group: "water", groupAr: "المياه", groupEn: "Water", nameAr, nameEn, unit, standard, materials: ["water"] })),
  ...[
    ["Slump", "الهبوط", "mm", "ASTM C143"],
    ["Fresh density", "الكثافة الطازجة", "kg/m³", "ASTM C138"],
    ["Temperature", "درجة الحرارة", "°C", "ASTM C1064"],
    ["Air content", "محتوى الهواء", "%", "ASTM C231/C173"],
    ["Workability time", "زمن التشغيل", "min", "مواصفة المشروع"],
    ["Water/cement ratio", "نسبة الماء إلى الأسمنت (W/C)", "—", "حساب الخلطة المعتمدة"],
  ].map(([nameEn, nameAr, unit, standard]) => ({ group: "fresh", groupAr: "الخلطة الخرسانية الطازجة", groupEn: "Fresh concrete", nameAr, nameEn, unit, standard, materials: ["fresh"] })),
  ...[
    ["Compressive strength", "مقاومة الضغط", "MPa", "ASTM C39"],
    ["Tensile strength", "مقاومة الشد", "MPa", "ASTM C496"],
    ["Flexural strength", "مقاومة الانحناء", "MPa", "ASTM C78"],
    ["Density", "الكثافة", "kg/m³", "ASTM C642"],
    ["Absorption", "الامتصاص", "%", "ASTM C642"],
    ["Permeability", "النفاذية", "mm / coulomb", "ASTM C1202 / method per project"],
    ["Shrinkage", "الانكماش", "με", "ASTM C157"],
    ["Creep", "الزحف", "με", "ASTM C512"],
    ["Carbonation", "اختبار الكربنة", "mm", "طريقة المشروع المعتمدة"],
  ].map(([nameEn, nameAr, unit, standard]) => ({ group: "hardened", groupAr: "الخرسانة المتصلدة", groupEn: "Hardened concrete", nameAr, nameEn, unit, standard, materials: ["hardened"] })),
  ...[
    ["Dimensions", "الأبعاد", "mm", "ASTM C140"], ["Weight", "الوزن", "kg", "ASTM C140"],
    ["Density", "الكثافة", "kg/m³", "ASTM C140"], ["Compressive strength", "مقاومة الضغط", "MPa", "ASTM C140"],
    ["Absorption", "الامتصاص", "%", "ASTM C140"], ["Moisture content", "نسبة الرطوبة", "%", "ASTM C140"],
    ["Efflorescence", "التزهير", "درجة", "ASTM C140 / project method"], ["Squareness and straightness", "الاستقامة والزوايا", "mm", "ASTM C140"],
  ].map(([nameEn, nameAr, unit, standard]) => ({ group: "block", groupAr: "البلوك الأسمنتي", groupEn: "Concrete block", nameAr, nameEn, unit, standard, materials: ["block"] })),
  ...[
    ["Dimensions", "الأبعاد", "mm", "ASTM C55/C140"], ["Compressive strength", "مقاومة الضغط", "MPa", "ASTM C55/C140"],
    ["Absorption", "الامتصاص", "%", "ASTM C55/C140"], ["Density", "الكثافة", "kg/m³", "ASTM C140"],
    ["Weight", "الوزن", "kg", "ASTM C140"], ["Efflorescence", "التزهير", "درجة", "مواصفة المشروع"],
    ["Abrasion resistance (if required)", "مقاومة التآكل (إذا لزم)", "cycle", "مواصفة المشروع"],
  ].map(([nameEn, nameAr, unit, standard]) => ({ group: "brick", groupAr: "الطوب الأسمنتي", groupEn: "Concrete brick", nameAr, nameEn, unit, standard, materials: ["brick"] })),
  ...[
    ["Dimensions", "الأبعاد", "mm", "EN 1338 / ASTM C936"], ["Thickness", "السمك", "mm", "EN 1338 / ASTM C936"],
    ["Compressive strength", "مقاومة الضغط", "MPa", "EN 1338 / ASTM C936"], ["Flexural strength", "مقاومة الانحناء", "MPa", "EN 1338"],
    ["Absorption", "الامتصاص", "%", "EN 1338 / ASTM C936"], ["Density", "الكثافة", "kg/m³", "طريقة المشروع المعتمدة"],
    ["Abrasion resistance", "مقاومة البري", "mm", "EN 1338 / ASTM C418"], ["Slip resistance", "مقاومة الانزلاق", "USRV", "EN 1338 / project method"],
    ["Efflorescence", "التزهير", "درجة", "EN 1338"], ["Colour stability", "ثبات اللون (للملون)", "ΔE", "طريقة المشروع المعتمدة"],
  ].map(([nameEn, nameAr, unit, standard]) => ({ group: "paver", groupAr: "الإنترلوك", groupEn: "Interlock paver", nameAr, nameEn, unit, standard, materials: ["paver"] })),
];

const standards = [
  { name: "ASTM International", detailAr: "طرق فحص المواد والخرسانة والمنتجات (مثل C33 وC136 وC140 وC143 وC150 وC39).", detailEn: "Test methods for aggregates, concrete and products (e.g. C33, C136, C140, C143, C150, C39)." },
  { name: "BSI · British Standards", detailAr: "مواصفات BS وطرق الفحص البريطانية، مع اعتماد إصدارات BS EN حيث تنطبق.", detailEn: "British Standards methods, including applicable BS EN adoptions." },
  { name: "CEN · European Standards", detailAr: "EN 12620 للركام، EN 197-1 للأسمنت، EN 12350/12390 للخرسانة، EN 1338 للإنترلوك.", detailEn: "EN 12620 aggregates, EN 197-1 cement, EN 12350/12390 concrete, EN 1338 pavers." },
  { name: "EOS · المواصفات المصرية", detailAr: "تُسجل أرقام وإصدارات المواصفات القياسية المصرية المعتمدة حسب نوع المنتج والعقد.", detailEn: "Enter the current Egyptian Standard number and edition applicable to the product and contract." },
  { name: "ECP 203", detailAr: "الكود المصري لتصميم وتنفيذ المنشآت الخرسانية؛ يعتمد الإصدار الساري ومتطلبات الاستشاري.", detailEn: "Egyptian Code for Design and Construction of Concrete Structures; follow the adopted edition and project requirements." },
];

type MixForm = {
  name: string; productType: string; requiredStrength: number; cementType: string;
  cement: number; sand: number; aggregate1: number; aggregateHalf: number; stonePowder: number; water: number;
  admixture: number; oxide: number; targetDensity: number; voidRatio: number;
  sandMoisture: number; sandAbsorption: number; sandGrading: number;
  aggregate1Moisture: number; aggregate1Absorption: number; aggregate1Grading: number;
  aggregateHalfMoisture: number; aggregateHalfAbsorption: number; aggregateHalfGrading: number;
  length: number; width: number; height: number;
  costCement: number; costSand: number; costAggregate1: number; costAggregateHalf: number; costStonePowder: number;
  costWater: number; costAdmixture: number; costOxide: number; standard: string;
};
type NumericMixField = Exclude<keyof MixForm, "name" | "productType" | "cementType" | "standard">;

const initialMix: MixForm = {
  name: "", productType: "BLOCK", requiredStrength: 15, cementType: "CEM I 42.5N",
  cement: 350, sand: 700, aggregate1: 650, aggregateHalf: 250, stonePowder: 0, water: 150,
  admixture: 0, oxide: 0, targetDensity: 2300, voidRatio: 0,
  sandMoisture: 0, sandAbsorption: 0, sandGrading: 0,
  aggregate1Moisture: 0, aggregate1Absorption: 0, aggregate1Grading: 0,
  aggregateHalfMoisture: 0, aggregateHalfAbsorption: 0, aggregateHalfGrading: 0,
  length: 400, width: 200, height: 200,
  costCement: 0, costSand: 0, costAggregate1: 0, costAggregateHalf: 0, costStonePowder: 0,
  costWater: 0, costAdmixture: 0, costOxide: 0, standard: "ASTM C140 / EOS",
};

const materialFields: { key: keyof MixForm; labelAr: string; labelEn: string }[] = [
  { key: "cement", labelAr: "الأسمنت · كجم", labelEn: "Cement · kg" },
  { key: "sand", labelAr: "الرمل · كجم جاف", labelEn: "Sand · dry kg" },
  { key: "aggregate1", labelAr: "سن 1 · كجم جاف", labelEn: "Aggregate 1 · dry kg" },
  { key: "aggregateHalf", labelAr: "سن نص · كجم جاف", labelEn: "Aggregate 1/2 · dry kg" },
  { key: "stonePowder", labelAr: "بودرة حجرية · كجم", labelEn: "Stone powder · kg" },
  { key: "water", labelAr: "المياه التصميمية · لتر", labelEn: "Design water · L" },
  { key: "admixture", labelAr: "إضافات كيميائية · كجم", labelEn: "Chemical admixture · kg" },
  { key: "oxide", labelAr: "أكاسيد / صبغة · كجم", labelEn: "Oxides / pigment · kg" },
];

const costFields: { key: keyof MixForm; labelAr: string; labelEn: string }[] = [
  { key: "costCement", labelAr: "الأسمنت · جنيه/طن", labelEn: "Cement · EGP/ton" },
  { key: "costSand", labelAr: "الرمل · جنيه/طن", labelEn: "Sand · EGP/ton" },
  { key: "costAggregate1", labelAr: "سن 1 · جنيه/طن", labelEn: "Aggregate 1 · EGP/ton" },
  { key: "costAggregateHalf", labelAr: "سن نص · جنيه/طن", labelEn: "Aggregate 1/2 · EGP/ton" },
  { key: "costStonePowder", labelAr: "البودرة · جنيه/طن", labelEn: "Stone powder · EGP/ton" },
  { key: "costWater", labelAr: "المياه · جنيه/م³", labelEn: "Water · EGP/m³" },
  { key: "costAdmixture", labelAr: "الإضافات · جنيه/طن", labelEn: "Admixture · EGP/ton" },
  { key: "costOxide", labelAr: "الأكاسيد · جنيه/طن", labelEn: "Oxides · EGP/ton" },
];

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function LaboratoryPage() {
  const { locale } = useI18n();
  const isAr = locale === "ar";
  const text = (ar: string, en: string) => isAr ? ar : en;
  const queryClient = useQueryClient();
  const [section, setSection] = useState("overview");
  const [selectedMaterial, setSelectedMaterial] = useState("sand");
  const [selectedTest, setSelectedTest] = useState("");
  const [result, setResult] = useState("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [sieveValues, setSieveValues] = useState<Record<string, string>>({});
  const [mix, setMix] = useState<MixForm>(initialMix);

  const { data, isLoading } = useQuery({
    queryKey: ["lab"],
    queryFn: async () => {
      const response = await fetch("/api/lab");
      if (!response.ok) throw new Error("Unable to load laboratory records");
      return response.json() as Promise<{ tests: any[]; mixDesigns: any[] }>;
    },
  });

  const availableTests = definitions.filter((test) => test.materials.includes(selectedMaterial));
  const activeTest = availableTests.find((test) => test.nameEn === selectedTest) ?? availableTests[0];
  const selectedMaterialInfo = materials.find((material) => material.id === selectedMaterial)!;
  const sieveSizes = ["37.5", "19", "9.5", "4.75", "2.36", "1.18", "0.6", "0.3", "0.15", "0.075"];
  const sieveResult = useMemo(() => {
    const entries = Object.entries(sieveValues).filter(([, value]) => value !== "");
    if (!entries.length) return null;
    const passing = Object.fromEntries(entries.map(([size, value]) => [size, Number(value)]));
    if (selectedMaterial === "sand") {
      const fmSizes = ["4.75", "2.36", "1.18", "0.6", "0.3", "0.15"];
      if (!fmSizes.every((size) => passing[size] !== undefined)) return null;
      return { value: fmSizes.reduce((sum, size) => sum + 100 - passing[size], 0) / 100, label: "Fineness modulus" };
    }
    if (passing["4.75"] === undefined) return null;
    return { value: 100 - passing["4.75"], label: "Retained on 4.75 mm" };
  }, [selectedMaterial, sieveValues]);
  const effectiveResult = activeTest?.nameEn === "Sieve analysis" ? sieveResult?.value ?? null : result === "" ? null : Number(result);
  const testMutation = useMutation({
    mutationFn: async () => {
      if (!activeTest || effectiveResult === null) throw new Error(text("أدخل بيانات الاختبار المطلوبة.", "Enter the required test data."));
      const value = effectiveResult;
      const minimum = minValue === "" ? null : Number(minValue);
      const maximum = maxValue === "" ? null : Number(maxValue);
      const status = minimum === null && maximum === null ? "REVIEW" :
        ((minimum === null || value >= minimum) && (maximum === null || value <= maximum) ? "PASS" : "FAIL");
      const response = await fetch("/api/lab", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "test", category: activeTest.group, material: isAr ? selectedMaterialInfo.nameAr : selectedMaterialInfo.nameEn,
          testName: isAr ? activeTest.nameAr : activeTest.nameEn, result: value,
          unit: activeTest.nameEn === "Sieve analysis" ? (selectedMaterial === "sand" ? "FM" : "%") : activeTest.unit,
          standard: activeTest.standard, minValue: minimum, maxValue: maximum, status,
          details: activeTest.nameEn === "Sieve analysis" ? {
            sieves: Object.fromEntries(Object.entries(sieveValues).filter(([, passing]) => passing !== "").map(([size, passing]) => [size, Number(passing)])),
            metricLabel: sieveResult?.label,
          } : undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to save test");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab"] });
      toast.success(text("تم حفظ نتيجة الاختبار", "Test result saved"));
      setResult(""); setMinValue(""); setMaxValue(""); setSieveValues({});
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const corrections = useMemo(() => {
    const correctedDry = (amount: number, grading: number) => Math.max(0, amount * (1 + grading / 100));
    const sandDry = correctedDry(mix.sand, mix.sandGrading);
    const aggregate1Dry = correctedDry(mix.aggregate1, mix.aggregate1Grading);
    const aggregateHalfDry = correctedDry(mix.aggregateHalf, mix.aggregateHalfGrading);
    const sandWet = sandDry * (1 + mix.sandMoisture / 100);
    const aggregate1Wet = aggregate1Dry * (1 + mix.aggregate1Moisture / 100);
    const aggregateHalfWet = aggregateHalfDry * (1 + mix.aggregateHalfMoisture / 100);
    const water = Math.max(0, mix.water - sandDry * (mix.sandMoisture - mix.sandAbsorption) / 100
      - aggregate1Dry * (mix.aggregate1Moisture - mix.aggregate1Absorption) / 100
      - aggregateHalfDry * (mix.aggregateHalfMoisture - mix.aggregateHalfAbsorption) / 100);
    const totalMass = mix.cement + sandWet + aggregate1Wet + aggregateHalfWet + mix.stonePowder + water + mix.admixture + mix.oxide;
    const costPerM3 = mix.cement * mix.costCement / 1000 + sandWet * mix.costSand / 1000
      + aggregate1Wet * mix.costAggregate1 / 1000 + aggregateHalfWet * mix.costAggregateHalf / 1000
      + mix.stonePowder * mix.costStonePowder / 1000 + water * mix.costWater / 1000
      + mix.admixture * mix.costAdmixture / 1000 + mix.oxide * mix.costOxide / 1000;
    const pieceVolume = Math.max(0.000001, mix.length * mix.width * mix.height / 1_000_000_000 * (1 - mix.voidRatio / 100));
    const piecesPerM3 = Math.floor(1 / pieceVolume);
    return {
      sandDry, aggregate1Dry, aggregateHalfDry, sandWet, aggregate1Wet, aggregateHalfWet,
      water, totalMass, costPerM3, piecesPerM3, pieceWeight: piecesPerM3 ? totalMass / piecesPerM3 : 0,
      costPerPiece: piecesPerM3 ? costPerM3 / piecesPerM3 : 0,
      waterCement: mix.cement ? water / mix.cement : 0,
    };
  }, [mix]);

  const mixMutation = useMutation({
    mutationFn: async () => {
      if (!mix.name.trim()) throw new Error(text("أدخل اسم تصميم الخلطة.", "Enter a mix design name."));
      const response = await fetch("/api/lab", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "mix", name: mix.name, productType: mix.productType, requiredStrength: mix.requiredStrength,
          cementType: mix.cementType, recipe: mix,
          corrections: {
            sandDry: corrections.sandDry, sandWet: corrections.sandWet,
            aggregate1Dry: corrections.aggregate1Dry, aggregate1Wet: corrections.aggregate1Wet,
            aggregateHalfDry: corrections.aggregateHalfDry, aggregateHalfWet: corrections.aggregateHalfWet,
            correctedWater: corrections.water,
          },
          metrics: {
            totalMass: corrections.totalMass, costPerM3: corrections.costPerM3,
            piecesPerM3: corrections.piecesPerM3, pieceWeight: corrections.pieceWeight,
            costPerPiece: corrections.costPerPiece, waterCement: corrections.waterCement,
          },
          standard: mix.standard || null,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to save mix design");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab"] });
      toast.success(text("تم حفظ تصميم الخلطة", "Mix design saved"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function applyLatestLabResults() {
    const findLatest = (materialNames: string[], testNames: string[]) => data?.tests?.find((test: any) =>
      materialNames.some((name) => test.material.toLowerCase().includes(name.toLowerCase()))
      && testNames.some((name) => test.testName.toLowerCase().includes(name.toLowerCase()))
    );
    const lookups: [NumericMixField, string[], string[]][] = [
      ["sandMoisture", ["الرمل", "sand"], ["نسبة الرطوبة", "moisture content"]],
      ["sandAbsorption", ["الرمل", "sand"], ["الامتصاص", "absorption"]],
      ["sandGrading", ["الرمل", "sand"], ["انحراف المنحنى", "grading"]],
      ["aggregate1Moisture", ["السن 1", "aggregate 1"], ["نسبة الرطوبة", "moisture content"]],
      ["aggregate1Absorption", ["السن 1", "aggregate 1"], ["الامتصاص", "absorption"]],
      ["aggregate1Grading", ["السن 1", "aggregate 1"], ["انحراف المنحنى", "grading"]],
      ["aggregateHalfMoisture", ["السن نص", "aggregate 1/2"], ["نسبة الرطوبة", "moisture content"]],
      ["aggregateHalfAbsorption", ["السن نص", "aggregate 1/2"], ["الامتصاص", "absorption"]],
      ["aggregateHalfGrading", ["السن نص", "aggregate 1/2"], ["انحراف المنحنى", "grading"]],
      ["targetDensity", ["الخلطة الطازجة", "fresh mix"], ["الكثافة الطازجة", "fresh density"]],
    ];
    const updates: Partial<Record<NumericMixField, number>> = {};
    for (const [field, materialNames, testNames] of lookups) {
      const record = findLatest(materialNames, testNames);
      if (record) updates[field] = Number(record.result);
    }
    if (!Object.keys(updates).length) {
      toast.error(text("لا توجد نتائج رطوبة أو امتصاص أو تدرج أو كثافة مسجلة بعد.", "No moisture, absorption, grading, or density results are available yet."));
      return;
    }
    setMix((current) => ({ ...current, ...updates }));
    toast.success(text(`تم تحديث ${Object.keys(updates).length} قيمة من أحدث الاختبارات`, `Updated ${Object.keys(updates).length} values from latest tests`));
  }

  const testCount = data?.tests?.length ?? 0;
  const passCount = data?.tests?.filter((test: any) => test.status === "PASS").length ?? 0;
  const failedCount = data?.tests?.filter((test: any) => test.status === "FAIL").length ?? 0;
  const groupCounts = definitions.reduce<Record<string, number>>((counts, test) => {
    counts[test.group] = (counts[test.group] ?? 0) + 1;
    return counts;
  }, {});
  const groups = Array.from(new Map(definitions.map((test) => [test.group, test])).values());

  function numberField(key: keyof MixForm, label: string, step = "0.1") {
    return <div className="space-y-1.5" key={key}>
      <Label htmlFor={key}>{label}</Label>
      <Input id={key} type="number" step={step} min="0" value={mix[key] as number}
        onChange={(event) => setMix((current) => ({ ...current, [key]: number(event.target.value) }))} />
    </div>;
  }

  function metric(title: string, value: string, detail: string, icon: React.ReactNode) {
    return <Card><CardContent className="flex items-start justify-between p-4">
      <div><p className="text-xs text-muted-foreground">{title}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>
      <span className="rounded-md bg-muted p-2 text-primary">{icon}</span>
    </CardContent></Card>;
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><FlaskConical className="h-4 w-4 text-primary" />{text("ضبط الجودة والخلطات", "Quality control and mix design")}</div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{text("المعمل", "Laboratory")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{text("اختبارات المواد والمنتجات، واعتماد تصميمات الخلطات ومراجعة نتائجها.", "Material and product testing, mix design, and result review.")}</p>
      </div>
      <div className="flex gap-2">
        <Link href="/inventory"><Button size="sm" variant="outline">{text("المخزون", "Inventory")}<ArrowUpRight className="h-3.5 w-3.5" /></Button></Link>
        <Link href="/production"><Button size="sm" variant="outline">{text("الإنتاج", "Production")}<ArrowUpRight className="h-3.5 w-3.5" /></Button></Link>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metric(text("نتائج الاختبارات", "Test records"), String(testCount), text("آخر 200 نتيجة محفوظة", "Latest 200 saved results"), <TestTube2 className="h-4 w-4" />)}
      {metric(text("مطابق", "Conforming"), String(passCount), text("ضمن حدود القبول المدخلة", "Within entered acceptance limits"), <ShieldCheck className="h-4 w-4" />)}
      {metric(text("غير مطابق", "Nonconforming"), String(failedCount), text("يحتاج مراجعة الجودة", "Requires quality review"), <ClipboardCheck className="h-4 w-4" />)}
      {metric(text("تصميمات الخلطات", "Mix designs"), String(data?.mixDesigns?.length ?? 0), text("البلوك والطوب والإنترلوك", "Blocks, bricks and pavers"), <Ruler className="h-4 w-4" />)}
    </div>

    <div className="flex gap-1 overflow-x-auto border-b">
      {[
        ["overview", text("نظرة عامة", "Overview")], ["tests", text("الاختبارات", "Test records")],
        ["mix", text("تصميم الخلطات", "Mix design")], ["standards", text("الأكواد والمواصفات", "Standards")],
      ].map(([value, label]) => <button key={value} onClick={() => setSection(value)}
        className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${section === value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
        {label}
      </button>)}
    </div>

    {section === "overview" && <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h2 className="text-base font-semibold">{text("نطاق الاختبارات", "Testing scope")}</h2><p className="mt-1 text-sm text-muted-foreground">{text("اختر فئة لعرض الاختبارات المتاحة وتسجيل النتائج.", "Choose a category to view available tests and record results.")}</p></div>
        <Button size="sm" onClick={() => setSection("tests")}><Plus className="h-4 w-4" />{text("تسجيل اختبار", "Record a test")}</Button></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => <button key={group.group} onClick={() => { setSelectedMaterial(group.materials[0]); setSelectedTest(""); setSection("tests"); }} className="text-left">
          <Card className="h-full transition-colors hover:border-primary/50"><CardContent className="flex items-center justify-between gap-3 p-4">
            <div><p className="font-medium">{isAr ? group.groupAr : group.groupEn}</p><p className="mt-1 text-xs text-muted-foreground">{groupCounts[group.group]} {text("اختباراً معرفاً", "defined tests")}</p></div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </CardContent></Card>
        </button>)}
      </div>
      <Card><CardHeader><CardTitle className="text-base">{text("أحدث النتائج", "Latest results")}</CardTitle></CardHeader><CardContent>
        <TestTable tests={data?.tests ?? []} loading={isLoading} isAr={isAr} emptyText={text("لا توجد نتائج محفوظة بعد.", "No saved results yet.")} />
      </CardContent></Card>
    </div>}

    {section === "tests" && <div className="space-y-5">
      <Card><CardHeader><CardTitle className="text-base">{text("تسجيل نتيجة اختبار", "Record a test result")}</CardTitle></CardHeader><CardContent>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5"><Label>{text("الخامة / المنتج", "Material / product")}</Label><NativeSelect value={selectedMaterial} onChange={(event) => { setSelectedMaterial(event.target.value); setSelectedTest(""); }}>
            {materials.map((material) => <option key={material.id} value={material.id}>{isAr ? material.nameAr : material.nameEn}</option>)}
          </NativeSelect></div>
          <div className="space-y-1.5"><Label>{text("الاختبار", "Test")}</Label><NativeSelect value={activeTest?.nameEn ?? ""} onChange={(event) => setSelectedTest(event.target.value)}>
            {availableTests.map((test) => <option key={`${test.group}-${test.nameEn}`} value={test.nameEn}>{isAr ? test.nameAr : test.nameEn}</option>)}
          </NativeSelect></div>
          <div className="space-y-1.5"><Label>{activeTest?.nameEn === "Sieve analysis" ? text("المؤشر المحسوب", "Calculated index") : text("النتيجة", "Result")} {activeTest?.unit && <span className="text-muted-foreground">({activeTest.unit})</span>}</Label>
            {activeTest?.nameEn === "Sieve analysis" ? <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm tabular-nums">{sieveResult ? `${sieveResult.value.toFixed(2)} · ${sieveResult.label}` : text("أكمل المناخل المطلوبة", "Complete required sieves")}</div> : <Input type="number" step="any" value={result} onChange={(event) => setResult(event.target.value)} />}
          </div>
          <div className="space-y-1.5"><Label>{text("مرجع الاختبار", "Test standard")}</Label><Input value={activeTest?.standard ?? ""} readOnly /></div>
          <div className="space-y-1.5"><Label>{text("الحد الأدنى للقبول", "Acceptance minimum")}</Label><Input type="number" step="any" value={minValue} onChange={(event) => setMinValue(event.target.value)} placeholder={text("اختياري", "Optional")} /></div>
          <div className="space-y-1.5"><Label>{text("الحد الأقصى للقبول", "Acceptance maximum")}</Label><Input type="number" step="any" value={maxValue} onChange={(event) => setMaxValue(event.target.value)} placeholder={text("اختياري", "Optional")} /></div>
          <div className="flex items-end md:col-span-2"><Button disabled={testMutation.isPending || effectiveResult === null} onClick={() => testMutation.mutate()}><Plus className="h-4 w-4" />{testMutation.isPending ? text("جارٍ الحفظ...", "Saving...") : text("حفظ النتيجة", "Save result")}</Button></div>
        </div>
        {activeTest?.nameEn === "Sieve analysis" && <div className="mt-5 border-t pt-4">
          <p className="mb-3 text-sm font-medium">{text("نسبة المار التراكمية لكل منخل · %", "Cumulative percent passing by sieve · %")}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {sieveSizes.map((size) => <div className="space-y-1.5" key={size}><Label htmlFor={`sieve-${size}`}>{size === "0.075" ? "0.075 mm (75 μm)" : `${size} mm`}</Label>
              <Input id={`sieve-${size}`} type="number" min="0" max="100" step="0.1" value={sieveValues[size] ?? ""} onChange={(event) => setSieveValues((current) => ({ ...current, [size]: event.target.value }))} />
            </div>)}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{text("يُحسب معامل النعومة للرمل من المناخل القياسية من 4.75 إلى 0.15 مم؛ وللسن تُسجل نسبة المار وملخص المار من 4.75 مم.", "Sand fineness modulus uses standard sieves from 4.75 to 0.15 mm; coarse aggregate records percent passing and the 4.75 mm retained summary.")}</p>
        </div>}
        <p className="mt-4 text-xs text-muted-foreground">{text("تُحدد المطابقة تلقائياً عند إدخال حدود القبول. بدون حدود، تحفظ النتيجة للمراجعة.", "Conformance is calculated from entered limits. Results without limits are marked for review.")}</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">{text("سجل الاختبارات", "Test register")}</CardTitle></CardHeader><CardContent>
        <TestTable tests={data?.tests ?? []} loading={isLoading} isAr={isAr} emptyText={text("لم تسجل اختبارات لهذه الدورة بعد.", "No tests recorded in this session yet.")} />
      </CardContent></Card>
    </div>}

    {section === "mix" && <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Card><CardHeader><CardTitle className="text-base">{text("بيانات التصميم", "Design details")}</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1.5"><Label>{text("اسم تصميم الخلطة", "Mix design name")}</Label><Input value={mix.name} onChange={(event) => setMix({ ...mix, name: event.target.value })} placeholder={text("مثال: بلوك 20 سم - خلطة 01", "e.g. 200 mm block · Mix 01")} /></div>
          <div className="space-y-1.5"><Label>{text("نوع المنتج", "Product")}</Label><NativeSelect value={mix.productType} onChange={(event) => setMix({ ...mix, productType: event.target.value })}>
            <option value="BLOCK">{text("بلوك", "Block")}</option><option value="BRICK">{text("طوب أسمنتي", "Concrete brick")}</option><option value="PAVER">{text("إنترلوك", "Interlock paver")}</option>
            <option value="READY_MIX">{text("خرسانة جاهزة", "Ready-mix concrete")}</option>
          </NativeSelect></div>
          <div className="space-y-1.5"><Label>{text("المقاومة المطلوبة · MPa", "Required strength · MPa")}</Label><Input type="number" min="0.1" step="0.1" value={mix.requiredStrength} onChange={(event) => setMix({ ...mix, requiredStrength: number(event.target.value) })} /></div>
          <div className="space-y-1.5"><Label>{text("نوع الأسمنت", "Cement type")}</Label><Input value={mix.cementType} onChange={(event) => setMix({ ...mix, cementType: event.target.value })} /></div>
          <div className="space-y-1.5"><Label>{text("الكود / المواصفة", "Code / standard")}</Label><Input value={mix.standard} onChange={(event) => setMix({ ...mix, standard: event.target.value })} /></div>
          {numberField("targetDensity", text("الكثافة المستهدفة · كجم/م³", "Target density · kg/m³"), "1")}
          {numberField("voidRatio", text("نسبة الفراغات · %", "Voids · %"))}
          {numberField("length", text("طول القطعة · مم", "Piece length · mm"), "1")}
          {numberField("width", text("عرض القطعة · مم", "Piece width · mm"), "1")}
          {numberField("height", text("ارتفاع / سمك القطعة · مم", "Piece height / thickness · mm"), "1")}
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="text-base">{text("مقادير الخلطة لكل متر مكعب", "Batch quantities per cubic metre")}</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {materialFields.map((field) => <div className="space-y-1.5" key={field.key}><Label htmlFor={field.key}>{isAr ? field.labelAr : field.labelEn}</Label>
            <Input id={field.key} type="number" step="0.1" min="0" value={mix[field.key] as number} onChange={(event) => setMix((current) => ({ ...current, [field.key]: number(event.target.value) }))} />
          </div>)}
        </CardContent></Card>

        <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-primary" /><CardTitle className="text-base">{text("تصحيح الخامات بنتائج الاختبارات", "Test-based material corrections")}</CardTitle></div><Button size="sm" variant="outline" onClick={applyLatestLabResults}>{text("تطبيق أحدث نتائج المعمل", "Apply latest lab results")}</Button></div></CardHeader><CardContent>
          <p className="mb-4 text-sm text-muted-foreground">{text("أدخل آخر نتائج الرطوبة والامتصاص، ثم تعديل التدرج المستخلص من التحليل المنخلي. تتغير أوزان التشغيل ومياه الإضافة مباشرة.", "Enter latest moisture and absorption results and grading adjustments from sieve analysis. Wet batch weights and added water update immediately.")}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { prefix: "sand", title: text("الرمل", "Sand") },
              { prefix: "aggregate1", title: text("سن 1", "Aggregate 1") },
              { prefix: "aggregateHalf", title: text("سن نص", "Aggregate 1/2") },
            ].map(({ prefix, title }) => <div key={prefix} className="space-y-3 border-t pt-3">
              <h3 className="text-sm font-medium">{title}</h3><div className="grid grid-cols-3 gap-2">
                {numberField(`${prefix}Moisture` as keyof MixForm, text("رطوبة %", "Moisture %"))}
                {numberField(`${prefix}Absorption` as keyof MixForm, text("امتصاص %", "Absorption %"))}
                {numberField(`${prefix}Grading` as keyof MixForm, text("تعديل التدرج %", "Grading adj. %"))}
              </div>
            </div>)}
          </div>
          <p className="mt-4 rounded-md bg-muted p-3 text-sm">{text("يُحدّث الزر القيم من أحدث سجلات الرطوبة والامتصاص وانحراف التدرج وكثافة الخلطة الطازجة. تُحسب مياه الإضافة والأوزان الرطبة تلقائياً؛ راجع صلاحية النتائج قبل اعتماد الإنتاج.", "The button imports the latest moisture, absorption, grading deviation, and fresh-density records. Added water and wet batch weights recalculate automatically; verify test validity before production release.")}</p>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="text-base">{text("تكلفة الخامات", "Material costs")}</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {costFields.map((field) => <div className="space-y-1.5" key={field.key}><Label htmlFor={field.key}>{isAr ? field.labelAr : field.labelEn}</Label>
            <Input id={field.key} type="number" min="0" step="1" value={mix[field.key] as number} onChange={(event) => setMix((current) => ({ ...current, [field.key]: number(event.target.value) }))} />
          </div>)}
        </CardContent></Card>
        <Button disabled={mixMutation.isPending} onClick={() => mixMutation.mutate()}><Save className="h-4 w-4" />{mixMutation.isPending ? text("جارٍ الحفظ...", "Saving...") : text("حفظ تصميم الخلطة", "Save mix design")}</Button>
      </div>

      <div className="space-y-4 xl:sticky xl:top-4">
        <Card><CardHeader><CardTitle className="text-base">{text("نتيجة الحساب", "Calculated summary")}</CardTitle></CardHeader><CardContent className="space-y-3">
          <SummaryRow label={text("المياه المصححة", "Corrected added water")} value={`${corrections.water.toFixed(1)} L/m³`} />
          <SummaryRow label={text("وزن الرمل الرطب", "Wet sand to batch")} value={`${corrections.sandWet.toFixed(1)} kg`} />
          <SummaryRow label={text("وزن سن 1 الرطب", "Wet aggregate 1")} value={`${corrections.aggregate1Wet.toFixed(1)} kg`} />
          <SummaryRow label={text("وزن السن النص الرطب", "Wet aggregate 1/2")} value={`${corrections.aggregateHalfWet.toFixed(1)} kg`} />
          <SummaryRow label={text("نسبة الماء/الأسمنت", "Water/cement ratio")} value={corrections.waterCement.toFixed(3)} />
          <SummaryRow label={text("الكثافة المحسوبة", "Calculated batch density")} value={`${corrections.totalMass.toFixed(0)} kg/m³`} />
          <SummaryRow label={text("الكثافة المستهدفة", "Target density")} value={`${mix.targetDensity.toFixed(0)} kg/m³`} />
          <SummaryRow label={text("تكلفة المتر المكعب", "Cost per m³")} value={`${corrections.costPerM3.toFixed(2)} EGP`} strong />
          <SummaryRow label={text("قطع لكل متر مكعب تقريباً", "Approx. pieces per m³")} value={corrections.piecesPerM3.toLocaleString()} />
          <SummaryRow label={text("وزن القطعة التقديري", "Estimated piece weight")} value={`${corrections.pieceWeight.toFixed(2)} kg`} />
          <SummaryRow label={text("تكلفة القطعة", "Cost per piece")} value={`${corrections.costPerPiece.toFixed(2)} EGP`} strong />
          <p className="border-t pt-3 text-xs leading-5 text-muted-foreground">{text("حساب استرشادي للمواد والكميات. لا يمثل اعتماداً إنشائياً أو ضماناً للمقاومة؛ يلزم التحقق بخلطات تجريبية واختبارات معملية وفق الكود والمواصفة المعتمدين.", "Indicative material calculation only, not structural approval or a strength guarantee. Verify with trial batches and lab testing against the governing code and specification.")}</p>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">{text("التصميمات المحفوظة", "Saved designs")}</CardTitle></CardHeader><CardContent className="space-y-3">
          {!data?.mixDesigns?.length && <p className="text-sm text-muted-foreground">{text("لا توجد تصميمات محفوظة بعد.", "No saved designs yet.")}</p>}
          {data?.mixDesigns?.slice(0, 6).map((design: any) => {
            const metrics = design.metrics as { costPerM3?: number; waterCement?: number };
            return <div key={design.id} className="border-b pb-3 last:border-0 last:pb-0">
              <div className="flex justify-between gap-2"><p className="text-sm font-medium">{design.name}</p><Badge variant="secondary">{design.productType}</Badge></div>
              <p className="mt-1 text-xs text-muted-foreground">{design.requiredStrength} MPa · {design.cementType}</p>
              <p className="mt-1 text-xs">{number(metrics.costPerM3).toFixed(2)} EGP/m³ · W/C {number(metrics.waterCement).toFixed(3)}</p>
              <Button size="sm" variant="ghost" className="mt-1 h-7 px-2" onClick={() => {
                setMix({ ...initialMix, ...(design.recipe as Partial<MixForm>) });
                toast.success(text("تم تحميل التصميم للتعديل", "Design loaded for editing"));
              }}>{text("تحميل للتعديل", "Load to edit")}</Button>
            </div>;
          })}
        </CardContent></Card>
      </div>
    </div>}

    {section === "standards" && <div className="space-y-4">
      <div><h2 className="text-base font-semibold">{text("مراجع الأكواد والمواصفات", "Codes and standards references")}</h2><p className="mt-1 text-sm text-muted-foreground">{text("يُعتمد المرجع والإصدار المحددان في العقد وتعليمات الاستشاري لكل اختبار.", "Use the edition and governing references specified by the contract and engineer for each test.")}</p></div>
      <div className="grid gap-3 md:grid-cols-2">
        {standards.map((standard) => <Card key={standard.name}><CardContent className="p-4"><h3 className="font-medium">{standard.name}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{isAr ? standard.detailAr : standard.detailEn}</p></CardContent></Card>)}
      </div>
      <Card><CardContent className="p-4 text-sm leading-6 text-muted-foreground">{text("لا يضع النظام حدود قبول افتراضية موحدة؛ سجّل حدود القبول المعتمدة للمشروع حتى تكون حالة المطابقة ذات معنى. أرقام الأكواد وأحدث إصداراتها تحتاج مراجعة مسؤول الجودة والجهة المصرية المختصة قبل التطبيق.", "No universal acceptance limits are prefilled. Enter project-approved limits for meaningful conformance status. QA and the Egyptian authority should verify standard numbers and current editions before use.")}</CardContent></Card>
    </div>}
  </div>;
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">{label}</span><span className={strong ? "font-semibold tabular-nums" : "font-medium tabular-nums"}>{value}</span></div>;
}

function TestTable({ tests, loading, isAr, emptyText }: { tests: any[]; loading: boolean; isAr: boolean; emptyText: string }) {
  const label = (ar: string, en: string) => isAr ? ar : en;
  return <div className="overflow-x-auto">
    <Table><TableHeader><TableRow>
      <TableHead>{label("التاريخ", "Date")}</TableHead><TableHead>{label("الخامة / المنتج", "Material / product")}</TableHead>
      <TableHead>{label("الاختبار", "Test")}</TableHead><TableHead>{label("النتيجة", "Result")}</TableHead>
      <TableHead>{label("المرجع", "Standard")}</TableHead><TableHead>{label("الحالة", "Status")}</TableHead>
    </TableRow></TableHeader><TableBody>
      {loading && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{label("جارٍ تحميل النتائج...", "Loading results...")}</TableCell></TableRow>}
      {!loading && tests.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{emptyText}</TableCell></TableRow>}
      {!loading && tests.map((test) => <TableRow key={test.id}>
        <TableCell className="whitespace-nowrap">{new Date(test.testedAt).toLocaleDateString(isAr ? "ar-EG" : "en-GB")}</TableCell>
        <TableCell>{test.material}</TableCell><TableCell>
          <div>{test.testName}</div>
          {test.details?.sieves && <details className="mt-1 text-xs text-muted-foreground">
            <summary className="cursor-pointer">{label("تفاصيل المناخل", "Sieve details")}</summary>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {Object.entries(test.details.sieves as Record<string, number>).sort(([first], [second]) => Number(second) - Number(first)).map(([size, passing]) =>
                <span key={size}>{size} mm: {passing}%</span>)}
            </div>
          </details>}
        </TableCell>
        <TableCell className="font-mono tabular-nums">{test.result} {test.unit}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{test.standard ?? "—"}</TableCell>
        <TableCell><Badge variant={test.status === "PASS" ? "success" : test.status === "FAIL" ? "destructive" : "warning"}>
          {test.status === "PASS" ? label("مطابق", "Pass") : test.status === "FAIL" ? label("غير مطابق", "Fail") : label("مراجعة", "Review")}
        </Badge></TableCell>
      </TableRow>)}
    </TableBody></Table>
  </div>;
}