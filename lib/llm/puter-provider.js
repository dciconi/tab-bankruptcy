import { buildMessages } from './prompt.js';
import { parseClusters } from './parse.js';
import { PuterNotSignedIn, PuterOutOfCredits } from './errors.js';

export const PUTER_DASHBOARD_URL = 'https://puter.com/dashboard';

export async function puterCluster(tabs, settings) {
  if (typeof window === 'undefined' || !window.puter) {
    throw new Error('Puter SDK not loaded');
  }
  const isSignedIn = await window.puter.auth.isSignedIn();
  if (!isSignedIn) {
    // Do NOT call puter.auth.signIn() here. By the time this runs we're mid-async
    // after the click that triggered clustering, so the user-gesture context is
    // gone and the popup will be blocked. Sign-in only happens in the options
    // page, where it's bound to a direct click handler.
    throw new PuterNotSignedIn();
  }
  const messages = buildMessages(tabs, settings.customPrompt);
  try {
    const res = await window.puter.ai.chat(messages, false, {
      // Puter's default model is gpt-5-nano; we always pass our chosen model explicitly.
      model: settings.puterModel,
      response_format: { type: 'json_object' }
      // Do NOT set stream: true — Puter issue #2410 makes streaming hang on errors.
    });
    const content = res?.message?.content ?? res?.content ?? '';
    return parseClusters(typeof content === 'string' ? content : JSON.stringify(content));
  } catch (err) {
    if (err?.delegate === 'usage-limited-chat' || err?.code === 'error_400_from_delegate') {
      throw new PuterOutOfCredits(err);
    }
    throw err;
  }
}
