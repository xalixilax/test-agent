export interface DeviceNameHints {
  userAgent: string;
  brave?: boolean;
}

const platformName = (userAgent: string): string | null => {
  if (/Mac OS|Macintosh/u.test(userAgent)) return "macOS";
  if (/Windows/u.test(userAgent)) return "Windows";
  if (/CrOS/u.test(userAgent)) return "ChromeOS";
  if (/Linux/u.test(userAgent)) return "Linux";
  return null;
};

export const detectDeviceName = ({ userAgent, brave = false }: DeviceNameHints): string => {
  const brand = brave
    ? "Brave"
    : /Edg\//u.test(userAgent)
      ? "Edge"
      : /OPR\//u.test(userAgent)
        ? "Opera"
        : "Chrome";
  const platform = platformName(userAgent);
  return platform ? `${brand} (${platform})` : brand;
};
