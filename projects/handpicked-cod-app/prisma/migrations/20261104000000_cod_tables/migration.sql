-- CreateTable
CREATE TABLE "CodOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "productTitle" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "cityVerified" BOOLEAN NOT NULL DEFAULT false,
    "dedupeHash" TEXT NOT NULL,
    "ip" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "variantIds" TEXT NOT NULL DEFAULT '',
    "subtotal" INTEGER NOT NULL,
    "shipping" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "riskTags" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PhoneBlock" (
    "phone" TEXT NOT NULL PRIMARY KEY,
    "reason" TEXT NOT NULL DEFAULT '',
    "refusals" INTEGER NOT NULL DEFAULT 0,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RateHit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Setting" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "freeThreshold" INTEGER NOT NULL DEFAULT 300000,
    "flatRate" INTEGER NOT NULL DEFAULT 25000,
    "etaText" TEXT NOT NULL DEFAULT '2-4 working days via PostEx',
    "paymentTermsTemplateId" TEXT,
    "paymentGatewayId" TEXT,
    "blockedCitiesJson" TEXT NOT NULL DEFAULT '[]',
    "maxQty" INTEGER NOT NULL DEFAULT 5,
    "maxSubtotal" INTEGER NOT NULL DEFAULT 6000000,
    "highValueCap" INTEGER NOT NULL DEFAULT 1500000,
    "useDraftOrder" BOOLEAN NOT NULL DEFAULT false,
    "testMode" BOOLEAN NOT NULL DEFAULT false,
    "whatsappNumber" TEXT,
    "whatsappWebhookUrl" TEXT,
    "advanceInstructions" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "CodOrder_dedupeHash_key" ON "CodOrder"("dedupeHash");
CREATE INDEX "CodOrder_shop_createdAt_idx" ON "CodOrder"("shop", "createdAt");
CREATE INDEX "CodOrder_phone_idx" ON "CodOrder"("phone");
CREATE INDEX "RateHit_key_createdAt_idx" ON "RateHit"("key", "createdAt");
