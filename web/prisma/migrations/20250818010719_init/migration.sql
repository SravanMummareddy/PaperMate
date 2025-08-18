-- CreateEnum
CREATE TYPE "public"."ProductType" AS ENUM ('RAW', 'FINISHED');

-- CreateEnum
CREATE TYPE "public"."PartyType" AS ENUM ('CUSTOMER', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'SHIPPED');

-- CreateEnum
CREATE TYPE "public"."POStatus" AS ENUM ('DRAFT', 'PLACED', 'RECEIVED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "public"."TxnType" AS ENUM ('GRN', 'SHIP', 'PROD_OUT', 'PROD_CONS', 'ADJ');

-- CreateEnum
CREATE TYPE "public"."ProdStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PAID', 'UNPAID', 'PARTIAL');

-- CreateEnum
CREATE TYPE "public"."FinishedKind" AS ENUM ('PLATE', 'SHEET', 'OTHER');

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" SERIAL NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "type" "public"."ProductType" NOT NULL,
    "finishedKind" "public"."FinishedKind",
    "size" TEXT,
    "uom" TEXT NOT NULL,
    "attributes" JSONB DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Party" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."PartyType" NOT NULL,
    "whatsapp" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalesOrder" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalesOrderLine" (
    "id" SERIAL NOT NULL,
    "soId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PurchaseOrder" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."POStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PurchaseOrderLine" (
    "id" SERIAL NOT NULL,
    "poId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(14,4),

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InventoryTxn" (
    "id" BIGSERIAL NOT NULL,
    "txnType" "public"."TxnType" NOT NULL,
    "productId" INTEGER NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "warehouse" TEXT NOT NULL DEFAULT 'MAIN',
    "batchNo" TEXT,
    "refTable" TEXT,
    "refId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTxn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductionOrder" (
    "id" SERIAL NOT NULL,
    "status" "public"."ProdStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductionConsumption" (
    "id" SERIAL NOT NULL,
    "prodId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "ProductionConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductionOutput" (
    "id" SERIAL NOT NULL,
    "prodId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "batchNo" TEXT,

    CONSTRAINT "ProductionOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" SERIAL NOT NULL,
    "soId" INTEGER NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "amount" DECIMAL(14,2),
    "paidDate" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "public"."Product"("sku");

-- CreateIndex
CREATE INDEX "InventoryTxn_productId_createdAt_idx" ON "public"."InventoryTxn"("productId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_soId_fkey" FOREIGN KEY ("soId") REFERENCES "public"."SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_poId_fkey" FOREIGN KEY ("poId") REFERENCES "public"."PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InventoryTxn" ADD CONSTRAINT "InventoryTxn_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionConsumption" ADD CONSTRAINT "ProductionConsumption_prodId_fkey" FOREIGN KEY ("prodId") REFERENCES "public"."ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionConsumption" ADD CONSTRAINT "ProductionConsumption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionOutput" ADD CONSTRAINT "ProductionOutput_prodId_fkey" FOREIGN KEY ("prodId") REFERENCES "public"."ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionOutput" ADD CONSTRAINT "ProductionOutput_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_soId_fkey" FOREIGN KEY ("soId") REFERENCES "public"."SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
