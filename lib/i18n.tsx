"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Locale = "en" | "ar";

const messages = {
  en: {
    localeName: "English",
    language: "Language",
    english: "English",
    arabic: "Arabic",
    home: "Home",
    menu: "Menu",
    modules: "Modules",
    search: "Search",
    myAccount: "My Account",
    profile: "Profile",
    signOut: "Sign out",
    user: "User",
    signIn: "Sign in",
    signInTo: "Sign in to IMS",
    systemName: "Integrated Manufacturing System",
    email: "Email",
    password: "Password",
    forgotPassword: "Forgot password?",
    demo: "Demo: admin@ims.local / Admin123!",
    invalidCredentials: "Invalid email or password.",
    welcomeBack: "Welcome back!",
    validEmail: "Enter a valid email address",
    passwordRequired: "Password is required",
    enterpriseEdition: "IMS v1.0 · Enterprise Edition",
    roles: {
      ADMINISTRATOR: "Administrator",
      PRODUCTION_MANAGER: "Production Manager",
      WAREHOUSE_MANAGER: "Warehouse Manager",
      PURCHASING_OFFICER: "Purchasing Officer",
      SALES_STAFF: "Sales Staff",
      FINANCE: "Finance",
      HR: "HR",
      QA: "QA",
      EMPLOYEE: "Employee",
    },
    nav: {
      dashboard: "Dashboard",
      inventory: "Inventory",
      warehouse: "Warehouse",
      production: "Production",
      lab: "Laboratory",
      bom: "Bill of Materials",
      mrp: "MRP",
      sales: "Sales",
      purchasing: "Purchasing",
      reports: "Reports",
    },
    common: {
      add: "Add",
      newItem: "New Item",
      newWarehouse: "New Warehouse",
      newWorkOrder: "New Work Order",
      newBom: "New BOM",
      newCustomer: "New Customer",
      newSupplier: "New Supplier",
      save: "Save",
      saving: "Saving...",
      cancel: "Cancel",
      delete: "Delete",
      close: "Close",
      name: "Name",
      code: "Code",
      type: "Type",
      unit: "Unit",
      location: "Location",
      quantity: "Quantity",
      sku: "SKU",
      item: "Item",
      status: "Status",
      actions: "Actions",
      search: "Search SKU or name...",
      noResults: "No results found.",
      noItems: "No items found. Add your first item to get started.",
      rawMaterial: "Raw Material",
      component: "Component",
      finishedGood: "Finished Good",
      consumable: "Consumable",
      costPrice: "Cost price",
      salePrice: "Sale price",
      reorderPoint: "Reorder point",
      reorderQuantity: "Reorder quantity",
      onHand: "On hand",
      reorderPt: "Reorder pt.",
      price: "Price",
      cost: "Cost",
      run: "Run",
      running: "Running...",
      noData: "No data available.",
      total: "Total",
      date: "Date",
      description: "Description",
      email: "Email",
      phone: "Phone",
      address: "Address",
      orderNumber: "Order number",
      customer: "Customer",
      supplier: "Supplier",
      warehouse: "Warehouse",
      version: "Version",
      components: "Components",
      salesOrders: "Sales Orders",
      purchaseOrders: "Purchase Orders",
      workOrders: "Work Orders",
    },
    status: {
      PLANNED: "Planned", RELEASED: "Released", IN_PROGRESS: "In Progress", COMPLETED: "Completed", CANCELLED: "Cancelled",
      DRAFT: "Draft", CONFIRMED: "Confirmed", FULFILLED: "Fulfilled", ORDERED: "Ordered", RECEIVED: "Received",
    },
  },
  ar: {
    localeName: "العربية",
    language: "اللغة",
    english: "الإنجليزية",
    arabic: "العربية",
    home: "الرئيسية",
    menu: "القائمة",
    modules: "الوحدات",
    search: "بحث",
    myAccount: "حسابي",
    profile: "الملف الشخصي",
    signOut: "تسجيل الخروج",
    user: "مستخدم",
    signIn: "تسجيل الدخول",
    signInTo: "تسجيل الدخول إلى IMS",
    systemName: "نظام إدارة التصنيع المتكامل",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    forgotPassword: "هل نسيت كلمة المرور؟",
    demo: "تجريبي: admin@ims.local / Admin123!",
    invalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    welcomeBack: "مرحبًا بعودتك!",
    validEmail: "أدخل بريدًا إلكترونيًا صحيحًا",
    passwordRequired: "كلمة المرور مطلوبة",
    enterpriseEdition: "IMS الإصدار 1.0 · إصدار المؤسسات",
    roles: {
      ADMINISTRATOR: "مدير النظام",
      PRODUCTION_MANAGER: "مدير الإنتاج",
      WAREHOUSE_MANAGER: "مدير المستودع",
      PURCHASING_OFFICER: "مسؤول المشتريات",
      SALES_STAFF: "موظف المبيعات",
      FINANCE: "المالية",
      HR: "الموارد البشرية",
      QA: "ضمان الجودة",
      EMPLOYEE: "موظف",
    },
    nav: {
      dashboard: "لوحة التحكم",
      inventory: "المخزون",
      warehouse: "المستودع",
      production: "الإنتاج",
      lab: "المعمل",
      bom: "قائمة المواد",
      mrp: "تخطيط الاحتياجات",
      sales: "المبيعات",
      purchasing: "المشتريات",
      reports: "التقارير",
    },
    common: {
      add: "إضافة",
      newItem: "صنف جديد",
      newWarehouse: "مستودع جديد",
      newWorkOrder: "أمر إنتاج جديد",
      newBom: "قائمة مواد جديدة",
      newCustomer: "عميل جديد",
      newSupplier: "مورد جديد",
      save: "حفظ",
      saving: "جارٍ الحفظ...",
      cancel: "إلغاء",
      delete: "حذف",
      close: "إغلاق",
      name: "الاسم",
      code: "الكود",
      type: "النوع",
      unit: "الوحدة",
      location: "الموقع",
      quantity: "الكمية",
      sku: "رمز الصنف",
      item: "الصنف",
      status: "الحالة",
      actions: "الإجراءات",
      search: "البحث برمز الصنف أو الاسم...",
      noResults: "لا توجد نتائج.",
      noItems: "لا توجد أصناف. أضف أول صنف للبدء.",
      rawMaterial: "مادة خام",
      component: "مكوّن",
      finishedGood: "منتج نهائي",
      consumable: "مستهلكات",
      costPrice: "سعر التكلفة",
      salePrice: "سعر البيع",
      reorderPoint: "نقطة إعادة الطلب",
      reorderQuantity: "كمية إعادة الطلب",
      onHand: "المتاح بالمخزون",
      reorderPt: "نقطة الطلب",
      price: "السعر",
      cost: "التكلفة",
      run: "تشغيل",
      running: "جارٍ التشغيل...",
      noData: "لا توجد بيانات.",
      total: "الإجمالي",
      date: "التاريخ",
      description: "الوصف",
      email: "البريد الإلكتروني",
      phone: "الهاتف",
      address: "العنوان",
      orderNumber: "رقم الطلب",
      customer: "العميل",
      supplier: "المورد",
      warehouse: "المستودع",
      version: "الإصدار",
      components: "المكونات",
      salesOrders: "طلبات البيع",
      purchaseOrders: "طلبات الشراء",
      workOrders: "أوامر الإنتاج",
    },
    status: {
      PLANNED: "مخطط", RELEASED: "مُعتمد", IN_PROGRESS: "قيد التنفيذ", COMPLETED: "مكتمل", CANCELLED: "ملغى",
      DRAFT: "مسودة", CONFIRMED: "مؤكد", FULFILLED: "منفذ", ORDERED: "تم الطلب", RECEIVED: "مستلم",
    },
  },
} as const;

type Messages = (typeof messages)[Locale];
type I18nContextValue = {
  locale: Locale;
  direction: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: Messages;
};

const documentTranslations: Record<string, string> = {
  "لوحة التحكم": "Dashboard",
  "المخزون": "Inventory",
  "المستودع": "Warehouse",
  "الإنتاج": "Production",
  "المعمل": "Laboratory",
  "قائمة المواد": "Bill of Materials",
  "المبيعات": "Sales",
  "المشتريات": "Purchasing",
  "التقارير": "Reports",
  "تخطيط الاحتياجات": "MRP",
  "الأصناف النشطة": "Active SKUs",
  "أوامر الإنتاج قيد التنفيذ": "Work Orders in Progress",
  "طلبات البيع المفتوحة": "Open Sales Orders",
  "طلبات الشراء المفتوحة": "Open Purchase Orders",
  "قيمة مبيعات الطلبات (مسودة + مؤكدة)": "Pipeline Sales Value (Draft + Confirmed)",
  "إدارة الأصناف ومستويات المخزون وحدود إعادة الطلب.": "Manage items, stock levels, and reorder thresholds.",
  "إدارة العملاء وطلبات البيع.": "Manage customers and sales orders.",
  "إدارة الموردين وطلبات الشراء.": "Manage suppliers and purchase orders.",
  "مواقع التخزين والمخزون الحالي بها.": "Storage locations and their current stock.",
  "متابعة أوامر الإنتاج من التخطيط حتى الإكمال.": "Track work orders from planning through completion.",
  "تعريف المكونات المطلوبة لإنتاج كل منتج نهائي.": "Define the components required to build each finished good.",
  "نظرة شاملة على الإنتاج والمخزون والمبيعات والمشتريات.": "Enterprise overview across production, inventory, sales and purchasing.",
  "إضافة": "Add", "حفظ": "Save", "جارٍ الحفظ...": "Saving...", "حذف": "Delete", "إلغاء": "Cancel",
  "الاسم": "Name", "الكود": "Code", "النوع": "Type", "الوحدة": "Unit", "الموقع": "Location",
  "الكمية": "Quantity", "الصنف": "Item", "الحالة": "Status", "التاريخ": "Date", "الإجمالي": "Total",
  "العميل": "Customer", "المورد": "Supplier", "المكونات": "Components", "الإصدار": "Version",
  "البريد الإلكتروني": "Email", "الهاتف": "Phone", "العنوان": "Address", "المتاح": "On hand",
  "نقطة إعادة الطلب": "Reorder point", "سعر التكلفة": "Cost price", "سعر البيع": "Sale price",
  "مواد خام": "Raw Material", "مكونات": "Component", "منتجات نهائية": "Finished Good", "مستهلكات": "Consumable",
  "مخطط": "Planned", "مُعتمد": "Released", "قيد التنفيذ": "In Progress", "مكتمل": "Completed", "ملغى": "Cancelled",
  "مسودة": "Draft", "مؤكد": "Confirmed", "منفذ": "Fulfilled", "تم الطلب": "Ordered", "مستلم": "Received",
  "لا توجد بيانات.": "No data available.", "لا توجد نتائج.": "No results found.",
  "لا توجد أصناف. أضف أول صنف للبدء.": "No items found. Add your first item to get started.",
  "لا توجد أوامر إنتاج بعد.": "No work orders yet.", "لا توجد مستودعات بعد.": "No warehouses yet.",
  "لا توجد قوائم مواد بعد.": "No BOMs defined yet.", "لا توجد طلبات بيع بعد.": "No sales orders yet.",
  "لا توجد طلبات شراء بعد.": "No purchase orders yet.", "لم يتم تحديد الموقع": "No location set",
  "إضافة عميل": "Add customer", "عميل جديد": "New Customer", "حفظ العميل": "Save customer",
  "إضافة مورد": "Add supplier", "مورد جديد": "New Supplier", "حفظ المورد": "Save supplier",
  "إضافة مستودع": "Add warehouse", "مستودع جديد": "New Warehouse", "حفظ المستودع": "Save warehouse",
  "طلب بيع جديد": "New Sales Order", "إنشاء طلب بيع": "Create sales order", "طلب شراء جديد": "New Purchase Order", "إنشاء طلب شراء": "Create purchase order",
  "أمر إنتاج جديد": "New Work Order", "إنشاء أمر إنتاج": "Create work order", "قائمة مواد جديدة": "New BOM", "إنشاء قائمة مواد": "Create bill of materials",
  "اختر الصنف...": "Select item...", "اختر العميل...": "Select customer...", "اختر المورد...": "Select supplier...",
  "اختر مستودعًا...": "Select a warehouse...", "اختر قائمة المواد...": "Select a BOM...",
  "إضافة بند": "Add line", "إضافة مكوّن": "Add component", "بنود الطلب": "Order lines",
  "تم تحديث الحالة": "Status updated", "تم حذف الطلب": "Order deleted", "تم حذف المستودع": "Warehouse removed",
  "تم إنشاء أمر الإنتاج": "Work order created", "تم حذف أمر الإنتاج": "Work order deleted",
  "تم إنشاء المستودع": "Warehouse created", "تم إنشاء قائمة المواد": "BOM created", "تم حذف قائمة المواد": "BOM deleted",
  "تمت إضافة العميل": "Customer added", "تمت إضافة المورد": "Supplier added", "تم إنشاء طلب البيع": "Sales order created", "تم إنشاء طلب الشراء": "Purchase order created",
  "طلبات البيع حسب الحالة": "Sales Orders by Status", "طلبات الشراء حسب الحالة": "Purchase Orders by Status",
  "تقرير المخزون المنخفض": "Low Stock Report", "إجمالي قيمة المخزون": "Total Inventory Value",
  "الأصناف عند نقطة إعادة الطلب المحددة أو أقل": "Items at or below their configured reorder point",
  "مستويات المخزون كافية لجميع الأصناف.": "Everything is sufficiently stocked.",
};

const reverseDocumentTranslations = Object.fromEntries(
  Object.entries(documentTranslations).map(([arabic, english]) => [english, arabic])
);

function translateRenderedDocument(locale: Locale) {
  const dictionary = locale === "ar" ? reverseDocumentTranslations : documentTranslations;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  for (const node of textNodes) {
    const value = node.nodeValue ?? "";
    const trimmed = value.trim();
    if (!trimmed || !dictionary[trimmed]) continue;
    node.nodeValue = value.replace(trimmed, dictionary[trimmed]);
  }
  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[placeholder], textarea[placeholder]").forEach((element) => {
    const translated = dictionary[element.placeholder.trim()];
    if (translated) element.placeholder = translated;
  });
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ar");

  useEffect(() => {
    const savedLocale = window.localStorage.getItem("ims-locale");
    if (savedLocale === "ar" || savedLocale === "en") setLocaleState(savedLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem("ims-locale", locale);
    translateRenderedDocument(locale);
    const observer = new MutationObserver(() => translateRenderedDocument(locale));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [locale]);

  function setLocale(nextLocale: Locale) {
    setLocaleState(nextLocale);
  }

  return (
    <I18nContext.Provider value={{ locale, direction: locale === "ar" ? "rtl" : "ltr", setLocale, t: messages[locale] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
