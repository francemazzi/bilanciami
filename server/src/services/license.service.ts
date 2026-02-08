import { prisma } from "../lib/prisma.js";

// License tier limits
export const LICENSE_LIMITS: Record<string, number> = {
  free: 20,
  starter: 100,
  professional: 500,
  enterprise: -1, // unlimited
};

export const LICENSE_TIERS = ["free", "starter", "professional", "enterprise"] as const;
export type LicenseTier = (typeof LICENSE_TIERS)[number];

export interface UserLicenseInfo {
  licenseTier: LicenseTier;
  pdfLimit: number;
  pdfCount: number;
  remainingPdfs: number;
  isLimitReached: boolean;
  licenseExpiresAt: Date | null;
  isLicenseActive: boolean;
}

export interface CanUploadResult {
  allowed: boolean;
  reason?: string;
  remainingPdfs: number;
  licenseTier: LicenseTier;
}

function isValidTier(tier: string): tier is LicenseTier {
  return LICENSE_TIERS.includes(tier as LicenseTier);
}

export async function getUserLicenseInfo(userId: string): Promise<UserLicenseInfo> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      licenseTier: true,
      licenseExpiresAt: true,
    },
  });

  if (!user) {
    throw new Error("Utente non trovato");
  }

  const tier = isValidTier(user.licenseTier) ? user.licenseTier : "free";

  // Check if license is expired (if it has an expiration date)
  const isLicenseActive =
    tier !== "free" &&
    (!user.licenseExpiresAt || user.licenseExpiresAt > new Date());

  // If license expired, treat as free tier
  const effectiveTier = isLicenseActive ? tier : "free";
  const limit = LICENSE_LIMITS[effectiveTier];

  // Count user's documents
  const pdfCount = await prisma.userOnDocument.count({
    where: { userId },
  });

  const remainingPdfs = limit === -1 ? -1 : Math.max(0, limit - pdfCount);
  const isLimitReached = limit !== -1 && pdfCount >= limit;

  return {
    licenseTier: effectiveTier,
    pdfLimit: limit,
    pdfCount,
    remainingPdfs,
    isLimitReached,
    licenseExpiresAt: user.licenseExpiresAt,
    isLicenseActive,
  };
}

export async function canUploadPdfs(
  userId: string,
  fileCount: number
): Promise<CanUploadResult> {
  const licenseInfo = await getUserLicenseInfo(userId);

  if (licenseInfo.isLimitReached) {
    return {
      allowed: false,
      reason: `Hai raggiunto il limite di ${licenseInfo.pdfLimit} PDF del piano ${licenseInfo.licenseTier}. Passa a un piano superiore per caricare più documenti.`,
      remainingPdfs: 0,
      licenseTier: licenseInfo.licenseTier,
    };
  }

  if (
    licenseInfo.remainingPdfs !== -1 &&
    fileCount > licenseInfo.remainingPdfs
  ) {
    return {
      allowed: false,
      reason: `Puoi caricare ancora ${licenseInfo.remainingPdfs} PDF. Stai tentando di caricarne ${fileCount}.`,
      remainingPdfs: licenseInfo.remainingPdfs,
      licenseTier: licenseInfo.licenseTier,
    };
  }

  return {
    allowed: true,
    remainingPdfs: licenseInfo.remainingPdfs,
    licenseTier: licenseInfo.licenseTier,
  };
}

export async function setUserLicense(
  userId: string,
  licenseTier: LicenseTier,
  expiresAt?: Date | null
): Promise<void> {
  if (!isValidTier(licenseTier)) {
    throw new Error(`Tier non valido: ${licenseTier}`);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      licenseTier,
      licenseExpiresAt: expiresAt ?? null,
    },
  });
}
