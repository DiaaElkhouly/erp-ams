import { PrismaClient, Role, ItemType, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const password = await bcrypt.hash("Admin123!", 10);

  const users = await Promise.all([
    db.user.upsert({
      where: { email: "admin@ims.local" },
      update: {},
      create: { name: "Alex Reyes", email: "admin@ims.local", passwordHash: password, role: Role.ADMINISTRATOR },
    }),
    db.user.upsert({
      where: { email: "production@ims.local" },
      update: {},
      create: { name: "Priya Santos", email: "production@ims.local", passwordHash: password, role: Role.PRODUCTION_MANAGER },
    }),
    db.user.upsert({
      where: { email: "warehouse@ims.local" },
      update: {},
      create: { name: "Marco Diaz", email: "warehouse@ims.local", passwordHash: password, role: Role.WAREHOUSE_MANAGER },
    }),
    db.user.upsert({
      where: { email: "purchasing@ims.local" },
      update: {},
      create: { name: "Lena Cruz", email: "purchasing@ims.local", passwordHash: password, role: Role.PURCHASING_OFFICER },
    }),
    db.user.upsert({
      where: { email: "sales@ims.local" },
      update: {},
      create: { name: "Jordan Tan", email: "sales@ims.local", passwordHash: password, role: Role.SALES_STAFF },
    }),
    db.user.upsert({
      where: { email: "quality@ims.local" },
      update: {},
      create: { name: "م. أحمد حسن - مدير الجودة", email: "quality@ims.local", passwordHash: password, role: Role.QA },
    }),
  ]);
  const admin = users[0];

  const warehouseA = await db.warehouse.upsert({
    where: { code: "WH-MAIN" }, update: {},
    create: { code: "WH-MAIN", name: "Main Distribution Center", location: "Cebu City, PH" },
  });
  const warehouseB = await db.warehouse.upsert({
    where: { code: "WH-PROD" }, update: {},
    create: { code: "WH-PROD", name: "Production Floor Stock", location: "Mandaue City, PH" },
  });

  const steel = await db.item.upsert({
    where: { sku: "RM-1001" }, update: {},
    create: { sku: "RM-1001", name: "Steel Sheet 2mm", type: ItemType.RAW_MATERIAL, unit: "sheet", costPrice: 12.5, salePrice: 0, reorderPoint: 50, reorderQty: 200 },
  });
  const bolt = await db.item.upsert({
    where: { sku: "RM-1002" }, update: {},
    create: { sku: "RM-1002", name: "M8 Hex Bolt", type: ItemType.RAW_MATERIAL, unit: "pcs", costPrice: 0.15, salePrice: 0, reorderPoint: 500, reorderQty: 2000 },
  });
  const bracketComp = await db.item.upsert({
    where: { sku: "CP-2001" }, update: {},
    create: { sku: "CP-2001", name: "Welded Bracket Frame", type: ItemType.COMPONENT, unit: "pcs", costPrice: 18, salePrice: 0, reorderPoint: 20, reorderQty: 100 },
  });
  const finishedUnit = await db.item.upsert({
    where: { sku: "FG-3001" }, update: {},
    create: { sku: "FG-3001", name: "Heavy-Duty Shelf Unit", type: ItemType.FINISHED_GOOD, unit: "pcs", costPrice: 45, salePrice: 129.99, reorderPoint: 10, reorderQty: 50 },
  });
  const lubricant = await db.item.upsert({
    where: { sku: "CS-4001" }, update: {},
    create: { sku: "CS-4001", name: "Industrial Lubricant 1L", type: ItemType.CONSUMABLE, unit: "bottle", costPrice: 6, salePrice: 0, reorderPoint: 15, reorderQty: 60 },
  });

  await db.stockLevel.upsert({
    where: { itemId_warehouseId: { itemId: steel.id, warehouseId: warehouseA.id } }, update: { quantity: 40 },
    create: { itemId: steel.id, warehouseId: warehouseA.id, quantity: 40 },
  });
  await db.stockLevel.upsert({
    where: { itemId_warehouseId: { itemId: bolt.id, warehouseId: warehouseA.id } }, update: { quantity: 3000 },
    create: { itemId: bolt.id, warehouseId: warehouseA.id, quantity: 3000 },
  });
  await db.stockLevel.upsert({
    where: { itemId_warehouseId: { itemId: bracketComp.id, warehouseId: warehouseB.id } }, update: { quantity: 35 },
    create: { itemId: bracketComp.id, warehouseId: warehouseB.id, quantity: 35 },
  });
  await db.stockLevel.upsert({
    where: { itemId_warehouseId: { itemId: finishedUnit.id, warehouseId: warehouseA.id } }, update: { quantity: 8 },
    create: { itemId: finishedUnit.id, warehouseId: warehouseA.id, quantity: 8 },
  });
  await db.stockLevel.upsert({
    where: { itemId_warehouseId: { itemId: lubricant.id, warehouseId: warehouseB.id } }, update: { quantity: 22 },
    create: { itemId: lubricant.id, warehouseId: warehouseB.id, quantity: 22 },
  });

  const factoryWarehouse = await db.warehouse.upsert({
    where: { code: "WH-EGYPT-FACTORY" }, update: {},
    create: { code: "WH-EGYPT-FACTORY", name: "مخزن مصنع الطوب والخلطات", location: "القاهرة، مصر" },
  });
  const factoryYard = await db.warehouse.upsert({
    where: { code: "WH-EGYPT-YARD" }, update: {},
    create: { code: "WH-EGYPT-YARD", name: "ساحة التشغيل والتجفيف", location: "القاهرة، مصر" },
  });

  const factoryItemData = [
    { sku: "RM-CEM-425", name: "أسمنت بورتلاندي CEM I 42.5N", type: ItemType.RAW_MATERIAL, unit: "ton", costPrice: 4200, reorderPoint: 10, reorderQty: 25 },
    { sku: "RM-SAND-01", name: "رمل مغسول - ركام ناعم", type: ItemType.RAW_MATERIAL, unit: "ton", costPrice: 850, reorderPoint: 15, reorderQty: 40 },
    { sku: "RM-AGG-01", name: "سن 1 - ركام خشن", type: ItemType.RAW_MATERIAL, unit: "ton", costPrice: 1150, reorderPoint: 15, reorderQty: 40 },
    { sku: "RM-AGG-HALF", name: "سن نص - ركام خشن", type: ItemType.RAW_MATERIAL, unit: "ton", costPrice: 1050, reorderPoint: 12, reorderQty: 30 },
    { sku: "RM-STONE-DUST", name: "بودرة حجرية", type: ItemType.RAW_MATERIAL, unit: "ton", costPrice: 650, reorderPoint: 8, reorderQty: 20 },
    { sku: "RM-ADMIX-01", name: "ملدن فائق للخرسانة", type: ItemType.RAW_MATERIAL, unit: "kg", costPrice: 42, reorderPoint: 300, reorderQty: 1000 },
    { sku: "RM-OXIDE-RED", name: "أكسيد حديد أحمر للإنترلوك", type: ItemType.RAW_MATERIAL, unit: "kg", costPrice: 68, reorderPoint: 100, reorderQty: 300 },
    { sku: "FG-BLOCK-20", name: "بلوك أسمنتي مفرغ 20×20×40 سم", type: ItemType.FINISHED_GOOD, unit: "pcs", costPrice: 8.5, salePrice: 12, reorderPoint: 1000, reorderQty: 5000 },
    { sku: "FG-BRICK-10", name: "طوب أسمنتي مصمت 10×20×40 سم", type: ItemType.FINISHED_GOOD, unit: "pcs", costPrice: 4.2, salePrice: 6, reorderPoint: 1500, reorderQty: 6000 },
    { sku: "FG-PAVER-06", name: "إنترلوك متداخل 6 سم - رمادي", type: ItemType.FINISHED_GOOD, unit: "pcs", costPrice: 3.5, salePrice: 5.25, reorderPoint: 2000, reorderQty: 10000 },
    { sku: "FG-RMC-C25", name: "خرسانة جاهزة C25", type: ItemType.FINISHED_GOOD, unit: "m3", costPrice: 2850, salePrice: 3400, reorderPoint: 10, reorderQty: 30 },
  ];
  const factoryItems: Record<string, { id: string }> = {};
  for (const itemData of factoryItemData) {
    factoryItems[itemData.sku] = await db.item.upsert({ where: { sku: itemData.sku }, update: {}, create: itemData });
  }

  const factoryStock = [
    ["RM-CEM-425", factoryWarehouse.id, 28], ["RM-SAND-01", factoryWarehouse.id, 65],
    ["RM-AGG-01", factoryWarehouse.id, 42], ["RM-AGG-HALF", factoryWarehouse.id, 38],
    ["RM-STONE-DUST", factoryWarehouse.id, 18], ["RM-ADMIX-01", factoryWarehouse.id, 850],
    ["RM-OXIDE-RED", factoryWarehouse.id, 220], ["FG-BLOCK-20", factoryYard.id, 3200],
    ["FG-BRICK-10", factoryYard.id, 5400], ["FG-PAVER-06", factoryYard.id, 7600],
  ] as const;
  for (const [sku, warehouseId, quantity] of factoryStock) {
    const item = factoryItems[sku];
    await db.stockLevel.upsert({
      where: { itemId_warehouseId: { itemId: item.id, warehouseId } }, update: {},
      create: { itemId: item.id, warehouseId, quantity },
    });
  }

  const existingBom = await db.bom.findFirst({ where: { finishedSku: "FG-3001" } });
  const bom = existingBom ?? await db.bom.create({
    data: {
      name: "Heavy-Duty Shelf Unit Assembly",
      finishedSku: "FG-3001",
      version: "1.0",
      components: {
        create: [
          { itemId: steel.id, quantity: 4 },
          { itemId: bolt.id, quantity: 16 },
          { itemId: bracketComp.id, quantity: 2 },
        ],
      },
    },
  });

  const woCount = await db.workOrder.count();
  if (woCount === 0) {
    await db.workOrder.create({
      data: {
        orderNumber: "WO-SEED-0001",
        bomId: bom.id,
        itemId: finishedUnit.id,
        warehouseId: warehouseA.id,
        quantity: 20,
        status: "IN_PROGRESS",
        startDate: new Date(),
        createdById: admin.id,
      },
    });
  }

  const seedFactoryBom = async (name: string, finishedSku: string, parts: [string, number][]) => {
    const existing = await db.bom.findFirst({ where: { finishedSku } });
    if (existing) return existing;
    return db.bom.create({
      data: {
        name, finishedSku, version: "1.0",
        components: { create: parts.map(([sku, quantity]) => ({ itemId: factoryItems[sku].id, quantity })) },
      },
    });
  };
  const factoryBoms = [
    { sku: "FG-BLOCK-20", name: "خلطة بلوك مفرغ 20 سم", parts: [["RM-CEM-425", 2.3], ["RM-SAND-01", 2.2], ["RM-AGG-01", 1.8], ["RM-AGG-HALF", 0.7], ["RM-STONE-DUST", 0.6]] as [string, number][] },
    { sku: "FG-BRICK-10", name: "خلطة طوب أسمنتي مصمت 10 سم", parts: [["RM-CEM-425", 1.1], ["RM-SAND-01", 2.4], ["RM-AGG-01", 0.8], ["RM-STONE-DUST", 0.5]] as [string, number][] },
    { sku: "FG-PAVER-06", name: "خلطة إنترلوك 6 سم", parts: [["RM-CEM-425", 0.8], ["RM-SAND-01", 1.1], ["RM-AGG-01", 0.9], ["RM-AGG-HALF", 0.4], ["RM-OXIDE-RED", 0.04]] as [string, number][] },
    { sku: "FG-RMC-C25", name: "خلطة خرسانة جاهزة C25", parts: [["RM-CEM-425", 0.35], ["RM-SAND-01", 0.75], ["RM-AGG-01", 0.7], ["RM-AGG-HALF", 0.35], ["RM-ADMIX-01", 0.004]] as [string, number][] },
  ];
  const factoryBomBySku: Record<string, { id: string }> = {};
  for (const bomData of factoryBoms) {
    factoryBomBySku[bomData.sku] = await seedFactoryBom(bomData.name, bomData.sku, bomData.parts);
  }
  const factoryWorkOrders = [
    { orderNumber: "WO-FACTORY-BLOCK-001", sku: "FG-BLOCK-20", quantity: 2500, status: "IN_PROGRESS" as const },
    { orderNumber: "WO-FACTORY-BRICK-001", sku: "FG-BRICK-10", quantity: 4000, status: "PLANNED" as const },
    { orderNumber: "WO-FACTORY-RMC-001", sku: "FG-RMC-C25", quantity: 8, status: "PLANNED" as const },
    { orderNumber: "WO-FACTORY-PAVER-001", sku: "FG-PAVER-06", quantity: 6000, status: "RELEASED" as const },
  ];
  for (const workOrder of factoryWorkOrders) {
    await db.workOrder.upsert({
      where: { orderNumber: workOrder.orderNumber }, update: {},
      create: {
        orderNumber: workOrder.orderNumber, bomId: factoryBomBySku[workOrder.sku].id,
        itemId: factoryItems[workOrder.sku].id, warehouseId: factoryYard.id,
        quantity: workOrder.quantity, status: workOrder.status, startDate: new Date("2026-09-25T06:00:00Z"), createdById: admin.id,
      },
    });
  }

  let customer = await db.customer.findFirst({ where: { name: "Northwind Retailers" } });
  if (!customer) {
    customer = await db.customer.create({
      data: { name: "Northwind Retailers", email: "orders@northwind.example", phone: "+63 917 000 1111", address: "Ayala Center, Cebu City" },
    });
  }

  let supplier = await db.supplier.findFirst({ where: { name: "Visayas Steel Supply Co." } });
  if (!supplier) {
    supplier = await db.supplier.create({
      data: { name: "Visayas Steel Supply Co.", email: "sales@visayassteel.example", phone: "+63 917 222 3333", address: "Mandaue Industrial Park" },
    });
  }

  const soCount = await db.salesOrder.count();
  if (soCount === 0) {
    await db.salesOrder.create({
      data: {
        orderNumber: "SO-SEED-0001",
        customerId: customer.id,
        createdById: admin.id,
        status: "CONFIRMED",
        lines: { create: [{ itemId: finishedUnit.id, quantity: 5, unitPrice: 129.99 }] },
      },
    });
  }

  const poCount = await db.purchaseOrder.count();
  if (poCount === 0) {
    await db.purchaseOrder.create({
      data: {
        orderNumber: "PO-SEED-0001",
        supplierId: supplier.id,
        createdById: admin.id,
        status: "ORDERED",
        lines: { create: [{ itemId: steel.id, quantity: 100, unitCost: 12.5 }] },
      },
    });
  }

  const labTestRecords: Prisma.LabTestRecordUncheckedCreateInput[] = [
    { id: "lab-seed-sand-sieve", category: "aggregate-physical", material: "الرمل", testName: "التحليل المنخلي", result: 2.72, unit: "FM", standard: "ASTM C136 / C117", minValue: 2.2, maxValue: 3.1, status: "PASS", testedAt: new Date("2026-09-25T08:00:00Z"), details: { sieves: { "4.75": 100, "2.36": 96, "1.18": 82, "0.6": 61, "0.3": 34, "0.15": 14, "0.075": 4 } } },
    { id: "lab-seed-sand-moisture", category: "aggregate-physical", material: "الرمل", testName: "نسبة الرطوبة", result: 3.2, unit: "%", standard: "ASTM C566", minValue: 0, maxValue: 8, status: "PASS", testedAt: new Date("2026-09-26T07:30:00Z") },
    { id: "lab-seed-sand-absorption", category: "aggregate-physical", material: "الرمل", testName: "الامتصاص", result: 1.1, unit: "%", standard: "ASTM C128", minValue: 0, maxValue: 3, status: "PASS", testedAt: new Date("2026-09-24T09:00:00Z") },
    { id: "lab-seed-sand-grading", category: "aggregate-physical", material: "الرمل", testName: "التدرج الحبيبي (انحراف المنحنى)", result: 1.5, unit: "%", standard: "ASTM C33 / EN 12620", minValue: -5, maxValue: 5, status: "PASS", testedAt: new Date("2026-09-25T08:30:00Z") },
    { id: "lab-seed-a1-moisture", category: "aggregate-physical", material: "السن 1", testName: "نسبة الرطوبة", result: 0.8, unit: "%", standard: "ASTM C566", minValue: 0, maxValue: 3, status: "PASS", testedAt: new Date("2026-09-26T07:40:00Z") },
    { id: "lab-seed-a1-absorption", category: "aggregate-physical", material: "السن 1", testName: "الامتصاص", result: 0.7, unit: "%", standard: "ASTM C127", minValue: 0, maxValue: 2, status: "PASS", testedAt: new Date("2026-09-24T09:30:00Z") },
    { id: "lab-seed-a1-grading", category: "aggregate-physical", material: "السن 1", testName: "التدرج الحبيبي (انحراف المنحنى)", result: -1.2, unit: "%", standard: "ASTM C33 / EN 12620", minValue: -5, maxValue: 5, status: "PASS", testedAt: new Date("2026-09-25T08:45:00Z") },
    { id: "lab-seed-half-moisture", category: "aggregate-physical", material: "السن نص", testName: "نسبة الرطوبة", result: 1.1, unit: "%", standard: "ASTM C566", minValue: 0, maxValue: 3, status: "PASS", testedAt: new Date("2026-09-26T07:50:00Z") },
    { id: "lab-seed-half-absorption", category: "aggregate-physical", material: "السن نص", testName: "الامتصاص", result: 0.9, unit: "%", standard: "ASTM C127", minValue: 0, maxValue: 2, status: "PASS", testedAt: new Date("2026-09-24T10:00:00Z") },
    { id: "lab-seed-half-grading", category: "aggregate-physical", material: "السن نص", testName: "التدرج الحبيبي (انحراف المنحنى)", result: 0.6, unit: "%", standard: "ASTM C33 / EN 12620", minValue: -5, maxValue: 5, status: "PASS", testedAt: new Date("2026-09-25T09:00:00Z") },
    { id: "lab-seed-cement-setting", category: "cement", material: "الأسمنت", testName: "زمن الشك الابتدائي", result: 142, unit: "min", standard: "ASTM C191", minValue: 45, maxValue: 375, status: "PASS", testedAt: new Date("2026-09-23T10:00:00Z") },
    { id: "lab-seed-cement-28d", category: "cement", material: "الأسمنت", testName: "مقاومة الضغط · 28 يوماً", result: 48.6, unit: "MPa", standard: "ASTM C109", minValue: 42.5, maxValue: null, status: "PASS", testedAt: new Date("2026-09-23T10:30:00Z") },
    { id: "lab-seed-water-ph", category: "water", material: "المياه", testName: "الرقم الهيدروجيني", result: 7.4, unit: "pH", standard: "ASTM D1293", minValue: 6, maxValue: 9, status: "PASS", testedAt: new Date("2026-09-26T08:00:00Z") },
    { id: "lab-seed-water-chloride", category: "water", material: "المياه", testName: "الكلوريدات", result: 185, unit: "mg/L", standard: "ASTM D512", minValue: 0, maxValue: 1000, status: "PASS", testedAt: new Date("2026-09-26T08:15:00Z") },
    { id: "lab-seed-fresh-density", category: "fresh", material: "الخلطة الطازجة", testName: "الكثافة الطازجة", result: 2325, unit: "kg/m³", standard: "ASTM C138", minValue: 2200, maxValue: 2450, status: "PASS", testedAt: new Date("2026-09-26T09:00:00Z") },
    { id: "lab-seed-fresh-slump", category: "fresh", material: "الخلطة الطازجة", testName: "الهبوط", result: 105, unit: "mm", standard: "ASTM C143", minValue: 80, maxValue: 130, status: "PASS", testedAt: new Date("2026-09-26T09:05:00Z") },
    { id: "lab-seed-fresh-temperature", category: "fresh", material: "الخلطة الطازجة", testName: "درجة الحرارة", result: 27, unit: "°C", standard: "ASTM C1064", minValue: 10, maxValue: 32, status: "PASS", testedAt: new Date("2026-09-26T09:10:00Z") },
    { id: "lab-seed-block-strength", category: "block", material: "البلوك الأسمنتي", testName: "مقاومة الضغط", result: 8.4, unit: "MPa", standard: "ASTM C140", minValue: 7, maxValue: null, status: "PASS", testedAt: new Date("2026-09-25T11:00:00Z") },
    { id: "lab-seed-block-absorption", category: "block", material: "البلوك الأسمنتي", testName: "الامتصاص", result: 7.8, unit: "%", standard: "ASTM C140", minValue: 0, maxValue: 12, status: "PASS", testedAt: new Date("2026-09-25T11:15:00Z") },
    { id: "lab-seed-brick-strength", category: "brick", material: "الطوب الأسمنتي", testName: "مقاومة الضغط", result: 12.2, unit: "MPa", standard: "ASTM C55 / C140", minValue: 10, maxValue: null, status: "PASS", testedAt: new Date("2026-09-24T11:00:00Z") },
    { id: "lab-seed-paver-strength", category: "paver", material: "الإنترلوك", testName: "مقاومة الضغط", result: 38.5, unit: "MPa", standard: "EN 1338", minValue: 30, maxValue: null, status: "PASS", testedAt: new Date("2026-09-25T12:00:00Z") },
    { id: "lab-seed-paver-abrasion", category: "paver", material: "الإنترلوك", testName: "مقاومة البري", result: 19, unit: "mm", standard: "EN 1338", minValue: 0, maxValue: 23, status: "PASS", testedAt: new Date("2026-09-25T12:15:00Z") },
    { id: "lab-seed-concrete-strength", category: "hardened", material: "الخرسانة المتصلدة", testName: "مقاومة الضغط", result: 31.2, unit: "MPa", standard: "ASTM C39", minValue: 25, maxValue: null, status: "PASS", testedAt: new Date("2026-09-26T10:00:00Z") },
  ];
  for (const record of labTestRecords) {
    await db.labTestRecord.upsert({ where: { id: record.id }, update: {}, create: record });
  }

  const mixDesigns: Prisma.LabMixDesignUncheckedCreateInput[] = [
    {
      id: "mix-seed-block-20", name: "خلطة بلوك مفرغ 20 سم - تشغيل تجريبي", productType: "BLOCK", requiredStrength: 7.5, cementType: "CEM I 42.5N", standard: "ASTM C140 / EOS",
      recipe: { name: "خلطة بلوك مفرغ 20 سم - تشغيل تجريبي", productType: "BLOCK", requiredStrength: 7.5, cementType: "CEM I 42.5N", cement: 360, sand: 670, aggregate1: 620, aggregateHalf: 220, stonePowder: 80, water: 155, admixture: 2, oxide: 0, targetDensity: 2325, voidRatio: 35, sandMoisture: 3.2, sandAbsorption: 1.1, sandGrading: 1.5, aggregate1Moisture: 0.8, aggregate1Absorption: 0.7, aggregate1Grading: -1.2, aggregateHalfMoisture: 1.1, aggregateHalfAbsorption: 0.9, aggregateHalfGrading: 0.6, length: 400, width: 200, height: 200, costCement: 4200, costSand: 850, costAggregate1: 1150, costAggregateHalf: 1050, costStonePowder: 650, costWater: 20, costAdmixture: 42000, costOxide: 68000, standard: "ASTM C140 / EOS" },
      corrections: { correctedWater: 129.2, sandWet: 700.8, aggregate1Wet: 615.8, aggregateHalfWet: 223.5 },
      metrics: { totalMass: 2332, costPerM3: 3320, piecesPerM3: 72, pieceWeight: 32.4, costPerPiece: 46.11, waterCement: 0.359 },
    },
    {
      id: "mix-seed-brick-10", name: "خلطة طوب أسمنتي مصمت 10 سم", productType: "BRICK", requiredStrength: 10, cementType: "CEM I 42.5N", standard: "ASTM C55 / C140",
      recipe: { name: "خلطة طوب أسمنتي مصمت 10 سم", productType: "BRICK", requiredStrength: 10, cementType: "CEM I 42.5N", cement: 390, sand: 920, aggregate1: 320, aggregateHalf: 0, stonePowder: 160, water: 170, admixture: 1.5, oxide: 0, targetDensity: 2250, voidRatio: 0, sandMoisture: 3.2, sandAbsorption: 1.1, sandGrading: 1.5, aggregate1Moisture: 0.8, aggregate1Absorption: 0.7, aggregate1Grading: -1.2, aggregateHalfMoisture: 0, aggregateHalfAbsorption: 0, aggregateHalfGrading: 0, length: 400, width: 200, height: 100, costCement: 4200, costSand: 850, costAggregate1: 1150, costAggregateHalf: 1050, costStonePowder: 650, costWater: 20, costAdmixture: 42000, costOxide: 68000, standard: "ASTM C55 / C140" },
      corrections: { correctedWater: 132, sandWet: 949.4, aggregate1Wet: 316.8, aggregateHalfWet: 0 },
      metrics: { totalMass: 2120, costPerM3: 3185, piecesPerM3: 125, pieceWeight: 16.96, costPerPiece: 25.48, waterCement: 0.338 },
    },
    {
      id: "mix-seed-paver-06", name: "خلطة إنترلوك ملون 6 سم", productType: "PAVER", requiredStrength: 35, cementType: "CEM I 42.5N", standard: "EN 1338 / EOS",
      recipe: { name: "خلطة إنترلوك ملون 6 سم", productType: "PAVER", requiredStrength: 35, cementType: "CEM I 42.5N", cement: 430, sand: 760, aggregate1: 530, aggregateHalf: 340, stonePowder: 100, water: 165, admixture: 3.5, oxide: 18, targetDensity: 2380, voidRatio: 0, sandMoisture: 3.2, sandAbsorption: 1.1, sandGrading: 1.5, aggregate1Moisture: 0.8, aggregate1Absorption: 0.7, aggregate1Grading: -1.2, aggregateHalfMoisture: 1.1, aggregateHalfAbsorption: 0.9, aggregateHalfGrading: 0.6, length: 200, width: 100, height: 60, costCement: 4200, costSand: 850, costAggregate1: 1150, costAggregateHalf: 1050, costStonePowder: 650, costWater: 20, costAdmixture: 42000, costOxide: 68000, standard: "EN 1338 / EOS" },
      corrections: { correctedWater: 130, sandWet: 797, aggregate1Wet: 525, aggregateHalfWet: 345 },
      metrics: { totalMass: 2290, costPerM3: 3810, piecesPerM3: 833, pieceWeight: 2.75, costPerPiece: 4.58, waterCement: 0.302 },
    },
    {
      id: "mix-seed-ready-c25", name: "خلطة خرسانة جاهزة C25", productType: "READY_MIX", requiredStrength: 25, cementType: "CEM I 42.5N", standard: "ECP 203 / ASTM C39",
      recipe: { name: "خلطة خرسانة جاهزة C25", productType: "READY_MIX", requiredStrength: 25, cementType: "CEM I 42.5N", cement: 350, sand: 750, aggregate1: 700, aggregateHalf: 350, stonePowder: 0, water: 175, admixture: 3.5, oxide: 0, targetDensity: 2350, voidRatio: 2, sandMoisture: 3.2, sandAbsorption: 1.1, sandGrading: 1.5, aggregate1Moisture: 0.8, aggregate1Absorption: 0.7, aggregate1Grading: -1.2, aggregateHalfMoisture: 1.1, aggregateHalfAbsorption: 0.9, aggregateHalfGrading: 0.6, length: 1000, width: 1000, height: 1000, costCement: 4200, costSand: 850, costAggregate1: 1150, costAggregateHalf: 1050, costStonePowder: 650, costWater: 20, costAdmixture: 42000, costOxide: 68000, standard: "ECP 203 / ASTM C39" },
      corrections: { correctedWater: 141, sandWet: 772.5, aggregate1Wet: 690, aggregateHalfWet: 350.7 },
      metrics: { totalMass: 2325, costPerM3: 2850, piecesPerM3: 1, pieceWeight: 2325, costPerPiece: 2850, waterCement: 0.403 },
    },
  ];
  for (const design of mixDesigns) {
    await db.labMixDesign.upsert({ where: { id: design.id }, update: {}, create: design });
  }

  console.log("Seed complete.");
  console.log("Demo password: Admin123! (admin@ims.local, production@ims.local, warehouse@ims.local, purchasing@ims.local, sales@ims.local, quality@ims.local)");
  console.log("Factory demo: block, cement brick, interlock, ready-mix concrete, lab test results, mix designs, and work orders.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
