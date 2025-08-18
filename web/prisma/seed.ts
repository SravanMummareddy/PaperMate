// prisma/seed.ts
// Seeds ≥3 rows per table, wired to the single inventory ledger.
//
// How it's kept safe:
// - Products: upsert by sku
// - Parties: find-or-create by name (no unique constraint on name)
// - Orders/Productions/Payments: ONLY create if the table is empty (guard)
//
// Re-run behavior:
// - Running twice won't duplicate masters
// - Orders/productions/payments will be skipped if any rows exist

import {
  PrismaClient,
  ProductType,
  PartyType,
  FinishedKind,
  POStatus,
  OrderStatus,
  ProdStatus,
  PaymentStatus,
  TxnType,
} from '@prisma/client';

const prisma = new PrismaClient();

async function getOrCreatePartyByName(name: string, data: Omit<Parameters<typeof prisma.party.create>[0]['data'], 'name'>) {
  const existing = await prisma.party.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.party.create({ data: { name, ...data } });
}

async function upsertProductBySku(sku: string, data: Omit<Parameters<typeof prisma.product.create>[0]['data'], 'sku'>) {
  return prisma.product.upsert({
    where: { sku },
    update: {},
    create: { sku, ...data },
  });
}

async function main() {
  console.log('--- Seeding masters (Products, Parties) ---');

  // PRODUCTS (≥3; actually 5)
  const rawPaper = await upsertProductBySku('RAW-ROLL-100KG', {
    name: 'Paper Roll 100kg',
    type: ProductType.RAW,
    uom: 'KG',
    attributes: { gsm: 180 },
  });

  const rawKraft = await upsertProductBySku('RAW-KRAFT-80GSM', {
    name: 'Kraft Paper 80gsm',
    type: ProductType.RAW,
    uom: 'KG',
    attributes: { gsm: 80 },
  });

  const plate8 = await upsertProductBySku('PLATE-8IN-P25', {
    name: '8" Plate Pack (25)',
    type: ProductType.FINISHED,
    finishedKind: FinishedKind.PLATE,
    size: '8in',
    uom: 'PACK',
    attributes: { pack: 25 },
  });

  const plate10 = await upsertProductBySku('PLATE-10IN-P25', {
    name: '10" Plate Pack (25)',
    type: ProductType.FINISHED,
    finishedKind: FinishedKind.PLATE,
    size: '10in',
    uom: 'PACK',
    attributes: { pack: 25 },
  });

  const sheet12 = await upsertProductBySku('SHEET-12x12', {
    name: 'Paper Sheet 12x12in',
    type: ProductType.FINISHED,
    finishedKind: FinishedKind.SHEET,
    size: '12x12in',
    uom: 'SHEET',
  });

  // PARTIES (≥3; actually 4)
  const sapco = await getOrCreatePartyByName('SAPCO Papers', {
    type: PartyType.SUPPLIER,
    whatsapp: '+911234567890',
    email: 'sapco@example.com',
  });
  const coastal = await getOrCreatePartyByName('Coastal Pulp', {
    type: PartyType.SUPPLIER,
    whatsapp: '+919999000111',
    email: 'coastal@example.com',
  });
  const nellore = await getOrCreatePartyByName('Nellore Retail', {
    type: PartyType.CUSTOMER,
    whatsapp: '+919876543210',
    email: 'buyer@example.com',
  });
  const vizag = await getOrCreatePartyByName('Vizag Mart', {
    type: PartyType.CUSTOMER,
    whatsapp: '+919123456789',
    email: 'vizag@example.com',
  });

  console.log('Products:', [rawPaper.sku, rawKraft.sku, plate8.sku, plate10.sku, sheet12.sku]);
  console.log('Parties  :', [sapco.name, coastal.name, nellore.name, vizag.name]);

  // ===== PURCHASE ORDERS (≥3) + GRNs into the ledger =====
  const poCount = await prisma.purchaseOrder.count();
  if (poCount === 0) {
    console.log('--- Seeding PurchaseOrders + Lines + GRN ledger ---');

    // PO #1 (fully received)
    const po1 = await prisma.purchaseOrder.create({
      data: {
        supplierId: sapco.id,
        status: POStatus.RECEIVED,
        lines: {
          create: [
            { productId: rawPaper.id, qty: 200, unitCost: 1.2 },
            { productId: rawKraft.id, qty: 100, unitCost: 0.9 },
          ],
        },
      },
      include: { lines: true },
    });

    // Ledger: GRN for full lines
    await prisma.inventoryTxn.createMany({
      data: po1.lines.map((ln) => ({
        txnType: TxnType.GRN,
        productId: ln.productId,
        qty: ln.qty, // +qty
        warehouse: 'MAIN',
        refTable: 'PO',
        refId: BigInt(po1.id),
      })),
    });

    // PO #2 (partial received)
    const po2 = await prisma.purchaseOrder.create({
      data: {
        supplierId: coastal.id,
        status: POStatus.PARTIAL,
        lines: {
          create: [{ productId: rawPaper.id, qty: 150, unitCost: 1.25 }],
        },
      },
      include: { lines: true },
    });

    // Ledger: GRN partial (e.g., 50 of 150)
    await prisma.inventoryTxn.create({
      data: {
        txnType: TxnType.GRN,
        productId: rawPaper.id,
        qty: 50,
        warehouse: 'MAIN',
        refTable: 'PO',
        refId: BigInt(po2.id),
      },
    });

    // PO #3 (fully received)
    const po3 = await prisma.purchaseOrder.create({
      data: {
        supplierId: sapco.id,
        status: POStatus.RECEIVED,
        lines: {
          create: [{ productId: rawKraft.id, qty: 200, unitCost: 0.88 }],
        },
      },
      include: { lines: true },
    });

    await prisma.inventoryTxn.createMany({
      data: po3.lines.map((ln) => ({
        txnType: TxnType.GRN,
        productId: ln.productId,
        qty: ln.qty,
        warehouse: 'MAIN',
        refTable: 'PO',
        refId: BigInt(po3.id),
      })),
    });

    console.log('Created POs:', [po1.id, po2.id, po3.id]);
  } else {
    console.log('PurchaseOrders exist -> skipping PO seed');
  }

  // ===== PRODUCTION ORDERS (≥3) + consumption/output + ledger =====
  const prodCount = await prisma.productionOrder.count();
  if (prodCount === 0) {
    console.log('--- Seeding ProductionOrders + Consumption/Output + ledger ---');

    // PROD #1: use 80 KG rawPaper -> make 300 PACK of plate8
    const prod1 = await prisma.productionOrder.create({
      data: {
        status: ProdStatus.DONE,
        notes: 'Run A',
        consumption: { create: [{ productId: rawPaper.id, qty: 80 }] },
        output: { create: [{ productId: plate8.id, qty: 300, batchNo: 'A-2025-08-17' }] },
      },
      include: { consumption: true, output: true },
    });

    await prisma.inventoryTxn.createMany({
      data: [
        {
          txnType: TxnType.PROD_CONS,
          productId: rawPaper.id,
          qty: -80,
          warehouse: 'MAIN',
          refTable: 'PROD',
          refId: BigInt(prod1.id),
        },
        {
          txnType: TxnType.PROD_OUT,
          productId: plate8.id,
          qty: 300,
          warehouse: 'MAIN',
          refTable: 'PROD',
          refId: BigInt(prod1.id),
          batchNo: 'A-2025-08-17',
        },
      ],
    });

    // PROD #2: use 40 KG rawKraft -> make 500 SHEET
    const prod2 = await prisma.productionOrder.create({
      data: {
        status: ProdStatus.IN_PROGRESS,
        notes: 'Sheets S batch',
        consumption: { create: [{ productId: rawKraft.id, qty: 40 }] },
        output: { create: [{ productId: sheet12.id, qty: 500, batchNo: 'S-2025-08-17' }] },
      },
      include: { consumption: true, output: true },
    });

    await prisma.inventoryTxn.createMany({
      data: [
        {
          txnType: TxnType.PROD_CONS,
          productId: rawKraft.id,
          qty: -40,
          warehouse: 'MAIN',
          refTable: 'PROD',
          refId: BigInt(prod2.id),
        },
        {
          txnType: TxnType.PROD_OUT,
          productId: sheet12.id,
          qty: 500,
          warehouse: 'MAIN',
          refTable: 'PROD',
          refId: BigInt(prod2.id),
          batchNo: 'S-2025-08-17',
        },
      ],
    });

    // PROD #3: use 30 KG rawPaper -> make 100 PACK of plate10
    const prod3 = await prisma.productionOrder.create({
      data: {
        status: ProdStatus.DONE,
        notes: 'Run B',
        consumption: { create: [{ productId: rawPaper.id, qty: 30 }] },
        output: { create: [{ productId: plate10.id, qty: 100, batchNo: 'B-2025-08-17' }] },
      },
      include: { consumption: true, output: true },
    });

    await prisma.inventoryTxn.createMany({
      data: [
        {
          txnType: TxnType.PROD_CONS,
          productId: rawPaper.id,
          qty: -30,
          warehouse: 'MAIN',
          refTable: 'PROD',
          refId: BigInt(prod3.id),
        },
        {
          txnType: TxnType.PROD_OUT,
          productId: plate10.id,
          qty: 100,
          warehouse: 'MAIN',
          refTable: 'PROD',
          refId: BigInt(prod3.id),
          batchNo: 'B-2025-08-17',
        },
      ],
    });

    console.log('Created PRODs:', [prod1.id, prod2.id, prod3.id]);
  } else {
    console.log('ProductionOrders exist -> skipping production seed');
  }

  // ===== SALES ORDERS (≥3) + lines + shipments (ledger) =====
  const soCount = await prisma.salesOrder.count();
  if (soCount === 0) {
    console.log('--- Seeding SalesOrders + Lines + SHIP ledger ---');

    // SO #1: 120 PACK of plate8 -> fully shipped
    const so1 = await prisma.salesOrder.create({
      data: {
        customerId: nellore.id,
        status: OrderStatus.SHIPPED,
        lines: { create: [{ productId: plate8.id, qty: 120 }] },
      },
      include: { lines: true },
    });

    await prisma.inventoryTxn.create({
      data: {
        txnType: TxnType.SHIP,
        productId: plate8.id,
        qty: -120,
        warehouse: 'MAIN',
        refTable: 'SO',
        refId: BigInt(so1.id),
      },
    });

    // SO #2: 60 PACK of plate10 -> partially shipped 30
    const so2 = await prisma.salesOrder.create({
      data: {
        customerId: vizag.id,
        status: OrderStatus.CONFIRMED,
        lines: { create: [{ productId: plate10.id, qty: 60 }] },
      },
      include: { lines: true },
    });

    await prisma.inventoryTxn.create({
      data: {
        txnType: TxnType.SHIP,
        productId: plate10.id,
        qty: -30, // partial shipment
        warehouse: 'MAIN',
        refTable: 'SO',
        refId: BigInt(so2.id),
      },
    });

    // SO #3: 200 SHEET -> not shipped yet (DRAFT)
    const so3 = await prisma.salesOrder.create({
      data: {
        customerId: nellore.id,
        status: OrderStatus.DRAFT,
        lines: { create: [{ productId: sheet12.id, qty: 200 }] },
      },
    });

    console.log('Created SOs:', [so1.id, so2.id, so3.id]);

    // PAYMENTS (≥3) — one per SO for now
    await prisma.payment.createMany({
      data: [
        { soId: so1.id, status: PaymentStatus.PARTIAL, amount: 1200.0, paidDate: new Date('2025-08-18') },
        { soId: so2.id, status: PaymentStatus.UNPAID },
        { soId: so3.id, status: PaymentStatus.UNPAID },
      ],
    });
  } else {
    console.log('SalesOrders exist -> skipping SO + Payment seed');
  }

  // ===== Ensure we have lots of InventoryTxn rows (GRN/SHIP/PROD_*) =====
  const txnCount = await prisma.inventoryTxn.count();
  console.log('InventoryTxn count:', txnCount);

  // Final stock intuition (approx, by product):
  // rawPaper: +200 (po1) +50 (po2partial) -80 (prod1) -30 (prod3) = +140 KG
  // rawKraft: +100 (po1) +200 (po3) -40 (prod2) = +260 KG
  // plate8:   +300 (prod1) -120 (so1 ship) = +180 PACK
  // plate10:  +100 (prod3) -30 (so2 ship partial) = +70 PACK
  // sheet12:  +500 (prod2) -0 = +500 SHEET

  console.log('--- Seed complete ---');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
