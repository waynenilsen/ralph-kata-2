/**
 * Parsed session information from user agent string.
 */
export interface ParsedSession {
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  os: string;
  displayName: string;
}

/**
 * Parse user agent string into readable device info.
 * @param userAgent - The user agent string from the request
 * @returns Parsed session information with browser, OS, and device type
 */
export function parseUserAgent(userAgent: string | null): ParsedSession {
  if (!userAgent) {
    return {
      deviceType: 'unknown',
      browser: 'Unknown',
      os: 'Unknown',
      displayName: 'Unknown Device',
    };
  }

  const ua = userAgent.toLowerCase();

  // Detect browser (order matters - Edge includes "chrome", Chrome includes "safari")
  let browser = 'Unknown';
  if (ua.includes('firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('edg')) {
    browser = 'Edge';
  } else if (ua.includes('chrome')) {
    browser = 'Chrome';
  } else if (ua.includes('safari')) {
    browser = 'Safari';
  }

  // Detect OS
  let os = 'Unknown';
  if (ua.includes('windows')) {
    os = 'Windows';
  } else if (ua.includes('android')) {
    os = 'Android';
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    os = 'iOS';
  } else if (ua.includes('mac')) {
    os = 'macOS';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  }

  // Detect device type
  let deviceType: ParsedSession['deviceType'] = 'desktop';
  if (ua.includes('ipad') || ua.includes('tablet')) {
    deviceType = 'tablet';
  } else if (
    ua.includes('mobile') ||
    ua.includes('android') ||
    ua.includes('iphone')
  ) {
    deviceType = 'mobile';
  }

  return {
    deviceType,
    browser,
    os,
    displayName: `${browser} on ${os}`,
  };
}

/**
 * Format relative time for session display.
 * @param date - The date to format
 * @returns Human-readable relative time string
 */
export function formatLastActive(date: Date | null): string {
  if (!date) {
    return 'Unknown';
  }

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (days < 7) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  return date.toLocaleDateString();
}
