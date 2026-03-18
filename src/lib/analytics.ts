// GA4 Analytics helpers — GDPR-compliant (IP anonymisation enabled in config)

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

const GA_ID = "G-X79CDG15K0";

/**
 * Send a virtual page view (for SPA topic changes).
 */
export function trackPageView(path: string, title?: string) {
  if (typeof window.gtag !== "function") return;
  window.gtag("config", GA_ID, {
    page_path: path,
    page_title: title ?? document.title,
  });
}

/**
 * Send a custom GA4 event.
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
) {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", eventName, params);
}
