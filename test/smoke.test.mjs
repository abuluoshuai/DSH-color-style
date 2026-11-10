/**
 * Smoke tests for the dsh-color-style client module.
 *
 * The module talks to the browser (window/document/localStorage) and the DSH
 * client services (theme/slots/locale); both surfaces are stubbed here, so the
 * tests exercise the real plugin logic: boot apply, token layering, the
 * belt-and-suspenders stylesheet, the sticky Appearance mode, legacy
 * migration, and the Settings page interactions.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/* ---------------------------------------------------------------- */
/* stubs                                                            */
/* ---------------------------------------------------------------- */

function makeReactStub() {
  return {
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children };
    },
    useState(initial) {
      return [typeof initial === "function" ? initial() : initial, () => {}];
    },
    useEffect() {},
    memo(fn) {
      return fn;
    },
    Fragment: "#fragment",
  };
}

function makeEnvironment({ stored = null, legacy = null, preference = "dark" } = {}) {
  const store = new Map();
  if (stored !== null) store.set("dsh.color-style.active", stored);
  if (legacy !== null) store.set("dsh.tinta-themes.active", legacy);

  const styleNodes = new Map();
  const makeNode = () => ({
    id: "",
    tag: "",
    dataset: {},
    textContent: '',
    remove() {
      styleNodes.delete(this.id);
    },
  });

  const documentStub = {
    getElementById(id) {
      return styleNodes.get(id) ?? null;
    },
    createElement(tag) {
      const node = makeNode();
      node.tag = tag;
      return node;
    },
    head: {
      appendChild(node) {
        styleNodes.set(node.id, node);
      },
    },
  };

  const layers = new Map();
  const setThemeCalls = [];
  let preferenceNow = preference;
  let listeners = [];

  const ctx = {
    effects: [],
    handlers: new Map(),
    slotFactories: new Map(),
    registrations: [],
    theme: {
      setTheme(next) {
        preferenceNow = next;
        setThemeCalls.push(next);
        for (const listener of listeners) listener({ preference: preferenceNow });
      },
      getTheme() {
        return { preference: preferenceNow };
      },
      overrideTokens(source, layer) {
        layers.set(source, layer);
        return () => layers.delete(source);
      },
    },
    slots: {
      inject(name, factory) {
        ctx.slotFactories.set(name, factory);
      },
      register(descriptor, component) {
        ctx.registrations.push({ descriptor, component });
        return () => {};
      },
    },
    locale: {
      dictionaries: new Map(),
      register(ns, dicts) {
        ctx.locale.dictionaries.set(ns, dicts);
        return () => ctx.locale.dictionaries.delete(ns);
      },
      bind(ns) {
        const registered = ctx.locale.dictionaries.get(ns) ?? {};
        const merged = { ...registered.en, ...registered.zh, ...registered };
        return (key) => merged[key] ?? key;
      },
      subscribe() {
        return () => {};
      },
    },
    on(event, handler) {
      ctx.handlers.set(event, handler);
    },
    effect(factory) {
      const dispose = factory();
      ctx.effects.push({ dispose });
    },
  };

  globalThis.window = {
    localStorage: {
      getItem(key) {
        return store.has(key) ? store.get(key) : null;
      },
      setItem(key, value) {
        store.set(key, String(value));
      },
      removeItem(key) {
        store.delete(key);
      },
    },
  };
  globalThis.document = documentStub;

  return {
    ctx,
    layers,
    setThemeCalls,
    styleNodes,
    store,
    reactStub: makeReactStub(),
  };
}

/* Load the plugin definition once; every test drives apply() on a fresh ctx. */
let loaded;
globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      loaded = definition;
    },
  },
  localStorage: {
    getItem() {
      return null;
    },
    setItem() {},
    removeItem() {},
  },
};
globalThis.document = {
  getElementById() {
    return null;
  },
  createElement() {
    return { dataset: {}, textContent: "", remove() {} };
  },
  head: { appendChild() {} },
};
await import(pathToFileURL(join(here, "..", "client.js")).href);

function boot(env, options = {}) {
  const plugin = loaded.factory(() => env.reactStub);
  plugin.apply(env.ctx);
  return plugin;
}

function walk(node, visit) {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
    return;
  }
  if (!node || typeof node !== "object") return;
  visit(node);
  const children = [].concat(node.children ?? []);
  for (const child of children) walk(child, visit);
}

function renderPage(env) {
  const section = env.ctx.slotFactories.get("settings.section");
  if (!section) throw new Error("settings.section was not injected");
  section();
  const entry = env.ctx.registrations.find((r) => r.descriptor.name === "settings.section");
  if (!entry) throw new Error("settings.section was not registered");
  return entry.component({});
}

function pageCards(env) {
  const cards = [];
  walk(renderPage(env), (node) => {
    if (node.props && node.props.className === "dcs-card") cards.push(node);
  });
  return cards;
}

/* ---------------------------------------------------------------- */
/* tests                                                            */
/* ---------------------------------------------------------------- */

test("module registers through the client module loader", () => {
  assert.ok(loaded, "window.__ModuleLoader__.load captured the definition");
  assert.equal(loaded.id, "dsh-color-style");
  const plugin = loaded.factory(() => ({ createElement: () => null, useState: (v) => [v, () => {}], useEffect: () => {}, memo: (fn) => fn }));
  assert.deepEqual(plugin.inject, ["slots", "theme", "locale"]);
  assert.equal(typeof plugin.apply, "function");
});

test("boot with a stored selection layers the palette and paints the window", () => {
  const env = makeEnvironment({ stored: "sakura", preference: "dark" });
  boot(env);

  assert.deepEqual(env.setThemeCalls, ["light"], "the palette owns the Appearance mode");
  assert.ok(env.layers.has("dsh-color-style"), "token layer registered");
  const layer = env.layers.get("dsh-color-style");
  assert.equal(layer["--dsw-alias-bg-base"].light, "#fdf8f8");
  assert.equal(layer["--dsw-alias-bg-base"].dark, "#fdf8f8");
  assert.equal(layer["--shiki-token-keyword"].light, "#c44569");

  const sheet = [...env.styleNodes.values()].find((node) => node.id === "dsh-color-style-sheet");
  assert.ok(sheet, "belt-and-suspenders sheet installed");
  assert.ok(sheet.textContent.includes("background-color:#fdf8f8"), "window canvas painted");
  assert.ok(sheet.textContent.includes("[class*=\"_markdown_\"]"), "markdown scoping present");
  assert.ok(sheet.textContent.includes(":not(pre)>code"), "inline code ink present");
  assert.equal(env.store.get("dsh.color-style.active"), "sakura");
});

test("legacy tinta selection migrates into the new storage key", () => {
  const env = makeEnvironment({ legacy: "midnight" });
  boot(env);

  assert.ok(!env.store.has("dsh.tinta-themes.active"), "legacy key removed");
  assert.equal(env.store.get("dsh.color-style.active"), "midnight", "selection adopted");
  assert.deepEqual(env.setThemeCalls, ["dark"]);
});

test("an external Appearance flip reasserts the palette mode", () => {
  const env = makeEnvironment({ stored: "sakura", preference: "light" });
  boot(env);

  const flipsBefore = env.setThemeCalls.length;
  env.ctx.theme.setTheme("dark"); // something outside flips the mode
  env.ctx.handlers.get("theme/change")?.({ preference: "dark" });

  assert.ok(
    env.setThemeCalls.length > flipsBefore,
    "the sticky handler pulled the mode back to the palette scheme",
  );
  assert.equal(env.setThemeCalls.at(-1), "light");
  assert.ok(env.layers.has("dsh-color-style"), "the palette layer survived");
});

test("reset drops the layer, clears storage and stops the stickiness", () => {
  const env = makeEnvironment({ stored: "abyss", preference: "dark" });
  boot(env);

  const buttons = [];
  walk(renderPage(env), (node) => {
    if (node.type === "button") buttons.push(node);
  });
  const reset = buttons.find((button) => button.props.className === "dcs-reset");
  assert.ok(reset, "reset button rendered while a palette is active");
  reset.props.onClick();

  assert.ok(!env.store.has("dsh.color-style.active"), "selection cleared");
  assert.equal(env.layers.has("dsh-color-style"), false, "token layer disposed");

  const flipsBefore = env.setThemeCalls.length;
  env.ctx.theme.setTheme("dark");
  env.ctx.handlers.get("theme/change")?.({ preference: "dark" });
  assert.equal(env.setThemeCalls.length, flipsBefore + 1, "no reassert after reset");
});

test("all ten palettes render as complete, distinct cards", () => {
  const env = makeEnvironment();
  boot(env);

  const cards = pageCards(env);
  assert.equal(cards.length, 10, "ten palette cards render");
  const titles = cards.map((card) => card.props.title);
  assert.equal(new Set(titles).size, 10, "palette names are distinct");
  // 双列布局：行优先填充，左列浅色、右列同色系深色
  assert.deepEqual(
    titles,
    ["纸卷", "余烬", "樱雪", "德古拉", "冰原", "午夜", "草甸", "幽林", "暮光", "深渊"],
    "left column lights, right column their dark counterparts",
  );
});

test("palette card selection applies that palette", () => {
  const env = makeEnvironment({ preference: "dark" });
  boot(env);

  const forest = pageCards(env).find((card) => card.props.title === "幽林");
  assert.ok(forest, "forest card rendered");
  forest.props.onClick();

  assert.equal(env.store.get("dsh.color-style.active"), "forest");
  assert.equal(env.setThemeCalls.at(-1), "dark");
  const layer = env.layers.get("dsh-color-style");
  assert.equal(layer["--dsw-alias-bg-base"].light, "#0d1512");
  const sheet = [...env.styleNodes.values()].find((node) => node.id === "dsh-color-style-sheet");
  assert.ok(sheet.textContent.includes("background-color:#0d1512"));
});