-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT NOT NULL,
    "targetProtocol" TEXT NOT NULL,
    "targetHost" TEXT NOT NULL,
    "targetPort" INTEGER NOT NULL,
    "healthCheckPath" TEXT,
    "websocketEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sslEnabled" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "configFileName" TEXT NOT NULL,
    "configStatus" TEXT NOT NULL DEFAULT 'NOT_APPLIED',
    "healthStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastHealthCheckedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProgramHealthCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "tcpOk" BOOLEAN NOT NULL,
    "httpOk" BOOLEAN NOT NULL,
    "healthOk" BOOLEAN,
    "statusCode" INTEGER,
    "responseTimeMs" INTEGER,
    "errorMessage" TEXT,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProgramHealthCheck_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApacheConfigRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT,
    "fileName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "ApacheConfigRevision_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApacheBackup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "folderName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "manifestJson" TEXT NOT NULL,
    "testResult" TEXT,
    "applyResult" TEXT,
    "restored" BOOLEAN NOT NULL DEFAULT false,
    "restoredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "actorUsername" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "detail" TEXT,
    "result" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "apacheRootPath" TEXT NOT NULL,
    "apacheExecutablePath" TEXT NOT NULL,
    "apacheVhostsPath" TEXT NOT NULL,
    "managedSitesPath" TEXT NOT NULL,
    "backupPath" TEXT NOT NULL,
    "sslCertificatePath" TEXT NOT NULL,
    "sslCertificateKeyPath" TEXT NOT NULL,
    "defaultDomainSuffix" TEXT NOT NULL,
    "defaultHealthCheckTimeoutMs" INTEGER NOT NULL DEFAULT 3000,
    "includeOptionalApplied" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "programId" TEXT,
    "location" TEXT,
    "memo" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastConnectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Device_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "DeviceToken_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Program_domain_key" ON "Program"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "ApacheBackup_folderName_key" ON "ApacheBackup"("folderName");

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceId_key" ON "Device"("deviceId");
