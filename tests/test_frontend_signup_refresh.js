const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function createElement() {
  return {
    children: [],
    className: '',
    innerHTML: '',
    value: '',
    textContent: '',
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    addEventListener(type, handler) {
      this._handlers = this._handlers || {};
      this._handlers[type] = handler;
    },
    reset() {
      this.value = '';
    },
    classList: {
      add() {},
      remove() {},
    },
  };
}

function loadApp({ activities, signupResult }) {
  const elements = {
    'activities-list': createElement(),
    activity: createElement(),
    'signup-form': createElement(),
    message: createElement(),
  };

  const document = {
    _domReadyHandler: null,
    addEventListener(type, handler) {
      if (type === 'DOMContentLoaded') {
        this._domReadyHandler = handler;
      }
    },
    getElementById(id) {
      return elements[id] || (elements[id] = createElement());
    },
    createElement(tagName) {
      return {
        tagName: tagName.toUpperCase(),
        children: [],
        className: '',
        innerHTML: '',
        value: '',
        textContent: '',
        appendChild(child) {
          this.children.push(child);
          return child;
        },
        classList: {
          add() {},
          remove() {},
        },
      };
    },
  };

  const fetchCalls = [];
  const context = {
    document,
    console,
    fetch: async (url, options) => {
      fetchCalls.push({ url, options });
      if (url === '/activities') {
        return {
          ok: true,
          json: async () => activities,
        };
      }

      if (url.includes('/signup')) {
        return {
          ok: true,
          json: async () => signupResult,
        };
      }

      return {
        ok: false,
        json: async () => ({ detail: 'Unexpected request' }),
      };
    },
    setTimeout: (fn) => {
      fn();
      return 1;
    },
    clearTimeout() {},
  };

  const script = fs.readFileSync(path.join(__dirname, '../src/static/app.js'), 'utf8');
  vm.createContext(context);
  vm.runInContext(script, context);
  document._domReadyHandler();

  return { elements, fetchCalls };
}

test('signup refreshes activities immediately after a successful signup', async () => {
  const { elements, fetchCalls } = loadApp({
    activities: {
      'Chess Club': {
        description: 'Strategy',
        schedule: 'Friday',
        max_participants: 10,
        participants: ['student@example.com'],
      },
    },
    signupResult: { message: 'Signed up' },
  });

  const form = elements['signup-form'];
  const event = { preventDefault() {} };
  const emailInput = elements.email || { value: 'new@example.com' };
  const activityInput = elements.activity || { value: 'Chess Club' };

  elements.email = emailInput;
  elements.activity = activityInput;

  const submitHandler = form._handlers.submit;
  await submitHandler(event);

  const activityFetches = fetchCalls.filter((call) => call.url === '/activities');
  assert.equal(activityFetches.length, 2, 'Expected the page to refresh activities after a successful signup');
});
