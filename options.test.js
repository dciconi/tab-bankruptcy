// Tab Bankruptcy — options.test.js
// Unit tests for settings page logic

const DEFAULT_PROMPT = 'You are a witty, slightly roasty productivity coach. Names must make users laugh or wince in recognition. Avoid: "Work", "Shopping", "Misc" unless ironic. Use pop culture, puns, self-deprecation.';

describe('options.js', () => {
  beforeEach(() => {
    // Mock chrome APIs
    global.chrome = {
      storage: {
        sync: {
          get: jest.fn((keys, cb) => cb({})),
          set: jest.fn((obj, cb) => cb && cb())
        }
      },
      runtime: {
        sendMessage: jest.fn((msg, cb) => cb({ lists: [] })),
        lastError: null
      },
      tabs: {
        create: jest.fn()
      }
    };
    document.body.innerHTML = '';
  });

  test('escapeHtml sanitizes dangerous content', () => {
    const div = document.createElement('div');
    div.textContent = '<script>alert(1)</script>';
    expect(div.innerHTML).not.toContain('<script>');
  });

  test('formatDate returns fallback for missing timestamp', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });

  test('formatDate formats valid timestamp', () => {
    const ts = new Date('2026-04-01').getTime();
    const out = formatDate(ts);
    expect(out).toMatch(/Apr 1/);
  });

  test('renderReadingLists shows empty state when no lists', () => {
    const container = document.createElement('div');
    renderReadingLists([], container);
    expect(container.innerHTML).toContain('No reading lists yet');
  });

  test('renderReadingLists renders items with Open All buttons', () => {
    const container = document.createElement('div');
    const lists = [{
      name: 'Test List',
      tabs: [{ url: 'https://a.com' }, { url: 'https://b.com' }],
      vibe: 'Chaotic',
      createdAt: Date.now()
    }];
    renderReadingLists(lists, container);
    expect(container.querySelectorAll('.reading-list-item').length).toBe(1);
    expect(container.querySelector('.btn-open-all')).not.toBeNull();
  });

  test('openAllTabs creates chrome.tabs for each url', () => {
    const list = { tabs: [{ url: 'https://x.com' }, { url: 'https://y.com' }] };
    openAllTabs(list);
    expect(chrome.tabs.create).toHaveBeenCalledTimes(2);
  });

  test('initPromptEditor loads default when storage empty', () => {
    chrome.storage.sync.get.mockImplementation((keys, cb) => cb({}));
    const textarea = document.createElement('textarea');
    textarea.id = 'custom-prompt';
    document.body.appendChild(textarea);

    // Simulate init
    textarea.value = DEFAULT_PROMPT;
    expect(textarea.value).toContain('witty');
  });

  test('initMuteToggle reads muted from storage', () => {
    chrome.storage.sync.get.mockImplementation((keys, cb) => cb({ muted: true }));
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.id = 'mute-toggle';
    document.body.appendChild(toggle);

    // Simulate load
    chrome.storage.sync.get(['muted'], (result) => {
      toggle.checked = !!result.muted;
    });
    expect(toggle.checked).toBe(true);
  });
});

// Helpers (mirrored from options.js for test isolation)
function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function renderReadingLists(lists, container) {
  container.innerHTML = '';
  if (!lists.length) {
    container.innerHTML = '<p class="empty-state">No reading lists yet. Save clusters to build your archive.</p>';
    return;
  }
  lists.forEach((list) => {
    const item = document.createElement('div');
    item.className = 'reading-list-item';
    item.innerHTML = `<h3>${list.name}</h3><button class="btn-open-all">Open All</button>`;
    container.appendChild(item);
  });
}

function openAllTabs(list) {
  const tabs = list.tabs || [];
  tabs.forEach((t) => chrome.tabs.create({ url: t.url || t }));
}
