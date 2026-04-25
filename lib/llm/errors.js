export class ApiKeyMissingError extends Error {
  constructor(provider) {
    super(`No API key for ${provider}`);
    this.name = 'ApiKeyMissingError';
    this.provider = provider;
  }
}

export class PuterNotSignedIn extends Error {
  constructor() {
    super('Not signed in to Puter');
    this.name = 'PuterNotSignedIn';
  }
}

export class PuterOutOfCredits extends Error {
  constructor(originalError) {
    super('Puter account is out of credits');
    this.name = 'PuterOutOfCredits';
    this.original = originalError;
  }
}

export class ClusterParseError extends Error {
  constructor(message, raw) {
    super(message);
    this.name = 'ClusterParseError';
    this.raw = raw;
  }
}

export class LlmError extends Error {
  constructor(kind, message, original) {
    super(message);
    this.name = 'LlmError';
    this.kind = kind; // 'auth' | 'rate_limit' | 'network' | 'unknown'
    this.original = original;
  }
}
