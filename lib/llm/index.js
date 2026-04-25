import { puterCluster, PUTER_DASHBOARD_URL } from './puter-provider.js';
import { byokCluster } from './byok-provider.js';

export {
  ApiKeyMissingError,
  PuterNotSignedIn,
  PuterOutOfCredits,
  ClusterParseError,
  LlmError
} from './errors.js';
export { MODELS, PROVIDERS, PROVIDER_LABELS } from './models.js';
export { PUTER_DASHBOARD_URL };

export async function clusterTabs(tabs, settings) {
  if (settings.provider === 'puter') return puterCluster(tabs, settings);
  return byokCluster(tabs, settings);
}
