import { Page } from '@playwright/test';

/**
 * Caption overlay helper for MendoraCI demo recording.
 * Ported from Forensa's caption-overlay.ts (sibling hackathon project).
 */

const BG = '#0a0e1a';
const BG_CARD = '#1e1b2e';
const WHITE = '#ffffff';
const TEXT_PRIMARY = '#e2e8f0';
const TEXT_SECONDARY = '#94a3b8';
const ACCENT_BLUE = '#3b82f6';
const ACCENT_GREEN = '#10b981';
const ACCENT_RED = '#dc2626';
const ACCENT_AMBER = '#f59e0b';

export async function showTitleCard(
  page: Page,
  opts: { title: string; subtitle: string; footnote?: string; durationMs: number },
): Promise<void> {
  await page.evaluate(
    ({ title, subtitle, footnote, bg, white, textPrimary, textSecondary, blue, amber }) => {
      const existing = document.getElementById('mendoraci-overlay');
      if (existing) existing.remove();
      const overlay = document.createElement('div');
      overlay.id = 'mendoraci-overlay';
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 999999;
        background: ${bg}; color: ${white};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        display: flex; flex-direction: column; justify-content: center; padding: 80px;
      `;
      const subtitleHtml = subtitle.split('\n').map((s) => `<div>${s}</div>`).join('');
      overlay.innerHTML = `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:48px;">
          <div style="width:24px;height:6px;background:${amber};border-radius:2px;"></div>
          <div style="font-size:14px;color:${textSecondary};letter-spacing:2px;">AT-HACK0020 \u00b7 IBM BOB HACKATHON</div>
        </div>
        <div style="font-size:84px;font-weight:600;letter-spacing:-2px;margin-bottom:8px;">${title}</div>
        <div style="width:120px;height:4px;background:${blue};margin-bottom:32px;"></div>
        <div style="font-size:28px;color:${textPrimary};font-weight:400;line-height:1.5;">${subtitleHtml}</div>
        ${footnote ? `<div style="margin-top:48px;font-size:16px;color:${textSecondary};">${footnote}</div>` : ''}
      `;
      document.body.appendChild(overlay);
    },
    { title: opts.title, subtitle: opts.subtitle, footnote: opts.footnote ?? '', bg: BG, white: WHITE, textPrimary: TEXT_PRIMARY, textSecondary: TEXT_SECONDARY, blue: ACCENT_BLUE, amber: ACCENT_AMBER },
  );
  await page.waitForTimeout(opts.durationMs);
}

export async function showSceneCard(
  page: Page,
  opts: {
    step: string;
    given: string;
    when: string;
    then: string;
    durationMs: number;
  },
): Promise<void> {
  await page.evaluate(
    ({ step, given, when, then, bg, white, textPrimary, blue, green, red, amber }) => {
      const existing = document.getElementById('mendoraci-overlay');
      if (existing) existing.remove();
      const overlay = document.createElement('div');
      overlay.id = 'mendoraci-overlay';
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 999999;
        background: ${bg}; color: ${white};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        display: flex; flex-direction: column; justify-content: center; padding: 64px;
      `;
      overlay.innerHTML = `
        <div style="font-size:14px;color:${amber};letter-spacing:2px;margin-bottom:32px;font-weight:500;">${step}</div>
        <div style="display:grid;grid-template-columns:140px 1fr;gap:24px 32px;font-size:24px;line-height:1.5;">
          <div style="color:${red};font-weight:500;">GIVEN</div>
          <div style="color:${textPrimary};">${given}</div>
          <div style="color:${blue};font-weight:500;">WHEN</div>
          <div style="color:${textPrimary};">${when}</div>
          <div style="color:${green};font-weight:500;">THEN</div>
          <div style="color:${textPrimary};">${then}</div>
        </div>
      `;
      document.body.appendChild(overlay);
    },
    { step: opts.step, given: opts.given, when: opts.when, then: opts.then, bg: BG, white: WHITE, textPrimary: TEXT_PRIMARY, blue: ACCENT_BLUE, green: ACCENT_GREEN, red: ACCENT_RED, amber: ACCENT_AMBER },
  );
  await page.waitForTimeout(opts.durationMs);
}

export async function showCaptionPill(
  page: Page,
  opts: { text: string; tone?: 'info' | 'success' | 'warn' },
): Promise<void> {
  await page.evaluate(
    ({ text, tone, bgCard, white, blue, green, amber }) => {
      const existing = document.getElementById('mendoraci-pill');
      if (existing) existing.remove();
      const accent = tone === 'success' ? green : tone === 'warn' ? amber : blue;
      const pill = document.createElement('div');
      pill.id = 'mendoraci-pill';
      pill.style.cssText = `
        position: fixed; top: 24px; left: 50%; transform: translateX(-50%);
        z-index: 999998;
        background: ${bgCard}; color: ${white};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        font-size: 18px; font-weight: 500;
        padding: 12px 24px; border-radius: 999px;
        border: 2px solid ${accent};
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      `;
      pill.textContent = text;
      document.body.appendChild(pill);
    },
    { text: opts.text, tone: opts.tone ?? 'info', bgCard: BG_CARD, white: WHITE, blue: ACCENT_BLUE, green: ACCENT_GREEN, amber: ACCENT_AMBER },
  );
}

export async function clearOverlay(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.getElementById('mendoraci-overlay')?.remove();
    document.getElementById('mendoraci-pill')?.remove();
  });
}
