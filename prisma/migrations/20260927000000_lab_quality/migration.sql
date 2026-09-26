CREATE TABLE "lab_test_records" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "result" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "standard" TEXT,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "details" JSONB,
    "testedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_test_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lab_mix_designs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "requiredStrength" DOUBLE PRECISION NOT NULL,
    "cementType" TEXT NOT NULL,
    "recipe" JSONB NOT NULL,
    "corrections" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    "standard" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_mix_designs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lab_test_records_category_material_idx" ON "lab_test_records"("category", "material");
CREATE INDEX "lab_test_records_status_idx" ON "lab_test_records"("status");
CREATE INDEX "lab_mix_designs_productType_idx" ON "lab_mix_designs"("productType");
