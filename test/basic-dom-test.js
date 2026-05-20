const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const contentScript = fs.readFileSync(path.join(root, "content.js"), "utf8");

class Element {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.dataset = {};
    this.className = "";
    this.style = {};
    this.eventListeners = {};
    this.textContent = "";
    this.innerText = "";
    this.id = "";
    this.value = "";
    this.nodeType = 1;
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    this.children = [];
    children.forEach((child) => this.appendChild(child));
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "id") {
      this.id = String(value);
    }
    if (name.startsWith("data-")) {
      const key = name
        .slice(5)
        .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      this.dataset[key] = String(value);
    }
  }

  getAttribute(name) {
    if (name === "id") {
      return this.id || null;
    }
    return this.attributes.get(name) || null;
  }

  addEventListener(type, handler) {
    this.eventListeners[type] = handler;
  }

  dispatchEvent(event) {
    this.lastEvent = event;
    return true;
  }

  focus() {
    this.focused = true;
  }

  setSelectionRange(start, end) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }

  scrollIntoView(options) {
    this.scrolledWith = options;
  }

  contains(target) {
    let node = target;
    while (node) {
      if (node === this) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (matches(node, selector)) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const selectors = selector.split(",").map((item) => item.trim());
    const result = [];
    walk(this, (node) => {
      if (node !== this && selectors.some((item) => matches(node, item))) {
        result.push(node);
      }
    });
    return result;
  }

  getBoundingClientRect() {
    return { width: 100, height: 40, top: 100, left: 100 };
  }

  get classList() {
    return {
      add: (name) => {
        this.className = [...new Set(`${this.className} ${name}`.trim().split(/\s+/))].join(" ");
      },
      remove: (name) => {
        this.className = this.className
          .split(/\s+/)
          .filter((item) => item && item !== name)
          .join(" ");
      },
      toggle: (name, force) => {
        if (force) {
          this.classList.add(name);
        } else {
          this.classList.remove(name);
        }
      }
    };
  }
}

function walk(node, callback) {
  callback(node);
  node.children.forEach((child) => walk(child, callback));
}

function matches(node, selector) {
  if (selector.startsWith("#")) {
    return node.id === selector.slice(1);
  }
  if (selector === "article") {
    return node.tagName === "ARTICLE";
  }
  if (selector === "textarea") {
    return node.tagName === "TEXTAREA";
  }
  if (selector === ".cgv-anchor-track") {
    return node.className.split(/\s+/).includes("cgv-anchor-track");
  }
  if (selector === ".cgv-anchor-dot") {
    return node.className.split(/\s+/).includes("cgv-anchor-dot");
  }
  if (selector === ".cgv-quote-button") {
    return node.className.split(/\s+/).includes("cgv-quote-button");
  }
  if (selector === '[data-message-author-role="user"]') {
    return node.getAttribute("data-message-author-role") === "user";
  }
  if (selector === "[data-testid]" || selector === "[data-message-id]") {
    return Boolean(node.getAttribute(selector.slice(1, -1)));
  }
  if (selector === '[contenteditable="true"]' || selector === '[contenteditable="true"][role="textbox"]') {
    return node.getAttribute("contenteditable") === "true";
  }
  if (selector === 'textarea[data-id="root"]') {
    return node.tagName === "TEXTAREA" && node.getAttribute("data-id") === "root";
  }
  if (selector.startsWith("textarea[")) {
    return node.tagName === "TEXTAREA";
  }
  if (selector === `[id="cgv-anchor-rail"]`) {
    return node.id === "cgv-anchor-rail";
  }
  return false;
}

const documentElement = new Element("html");
const body = new Element("body");
documentElement.appendChild(body);

function addMessage(role, text) {
  const article = new Element("article");
  const message = new Element("div");
  message.setAttribute("data-message-author-role", role);
  message.textContent = text;
  message.innerText = text;
  article.textContent = text;
  article.innerText = text;
  article.appendChild(message);
  body.appendChild(article);
}

addMessage("user", "First prompt");
addMessage("assistant", "First answer");
addMessage("user", "Second prompt");
const selectableMessage = body.children[1].children[0];

const textarea = new Element("textarea");
textarea.id = "prompt-textarea";
textarea.setAttribute("id", "prompt-textarea");
body.appendChild(textarea);

const documentListeners = {};
let currentSelection = { isCollapsed: true, rangeCount: 0 };
const intervals = [];
let lastScrollTo = null;

const document = {
  body,
  documentElement,
  querySelectorAll: (selector) => documentElement.querySelectorAll(selector),
  querySelector: (selector) => documentElement.querySelector(selector),
  getElementById: (id) => documentElement.querySelectorAll(`#${id}`)[0] || null,
  createElement: (tagName) => new Element(tagName),
  addEventListener: (type, handler) => {
    documentListeners[type] = handler;
  },
  createRange: () => ({
    selectNodeContents: () => {},
    collapse: () => {}
  })
};

const timers = [];
const context = {
  console,
  Element,
  Node: { ELEMENT_NODE: 1 },
  InputEvent: class InputEvent {
    constructor(type, init) {
      this.type = type;
      Object.assign(this, init);
    }
  },
  MutationObserver: class MutationObserver {
    observe() {}
  },
  IntersectionObserver: class IntersectionObserver {
    observe() {}
    disconnect() {}
  },
  document,
  location: { href: "https://chatgpt.com/c/test" },
  history: {
    pushState() {},
    replaceState() {}
  },
  window: {
    __chatgptVoyagerLoaded: false,
    addEventListener: () => {},
    setTimeout: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clearTimeout: () => {},
    setInterval: (fn) => {
      intervals.push(fn);
      return intervals.length;
    },
    clearInterval: (id) => {
      intervals[id - 1] = null;
    },
    scrollTo: (x, y) => {
      lastScrollTo = { x, y };
      context.window.scrollX = x;
      context.window.scrollY = y;
    },
    scrollY: 0,
    scrollX: 0,
    innerWidth: 1200,
    innerHeight: 900,
    getComputedStyle: () => ({ visibility: "visible", display: "block" }),
    getSelection: () => currentSelection
  }
};

context.window.window = context.window;
context.window.document = document;
context.window.history = context.history;
context.window.location = context.location;
context.window.Element = Element;
context.window.Node = context.Node;
context.window.InputEvent = context.InputEvent;
context.window.MutationObserver = context.MutationObserver;
context.window.IntersectionObserver = context.IntersectionObserver;
context.window.getComputedStyle = context.window.getComputedStyle;
context.window.getSelection = context.window.getSelection;
context.window.Math = Math;
context.window.Date = Date;
context.globalThis = context.window;

vm.createContext(context.window);
vm.runInContext(contentScript, context.window);

while (timers.length) {
  timers.shift()();
}

const dots = document.querySelectorAll(".cgv-anchor-dot");
if (dots.length !== 2) {
  throw new Error(`Expected 2 anchor dots, got ${dots.length}`);
}

if (!document.getElementById("cgv-anchor-rail")) {
  throw new Error("Expected rail to be created");
}

currentSelection = {
  isCollapsed: false,
  rangeCount: 1,
  anchorNode: selectableMessage,
  toString: () => "selectable quote",
  getRangeAt: () => ({
    getBoundingClientRect: () => ({
      width: 120,
      height: 24,
      top: 120,
      right: 260,
      bottom: 144,
      left: 140
    }),
    getClientRects: () => []
  }),
  removeAllRanges() {
    this.isCollapsed = true;
    this.rangeCount = 0;
  }
};

documentListeners.selectionchange({ type: "selectionchange" });
documentListeners.pointerup({ type: "pointerup", target: selectableMessage });

while (timers.length) {
  timers.shift()();
}

if (textarea.value) {
  throw new Error("Expected selection to wait for manual quote action before filling the editor");
}

const quoteAction = document.getElementById("cgv-quote-action");
const quoteButton = quoteAction?.querySelector(".cgv-quote-button");
if (!quoteAction || !quoteButton || quoteAction.className.includes("cgv-hidden")) {
  throw new Error("Expected quote action button to be shown after selecting text");
}

quoteButton.eventListeners.click({ preventDefault() {} });

if (!textarea.value.includes("> selectable quote")) {
  throw new Error("Expected quote action click to insert selected text into the editor");
}

if (!textarea.value.includes("请基于上面引用内容回答：")) {
  throw new Error("Expected quote action click to insert the quote prompt");
}

if (!quoteAction.className.includes("cgv-hidden")) {
  throw new Error("Expected quote action to hide after inserting the quote");
}

const intervalCountBeforeSend = intervals.length;
context.window.scrollY = 320;
documentListeners.submit({ type: "submit", target: textarea });

if (intervals.length !== intervalCountBeforeSend + 1) {
  throw new Error("Expected every prompt submit to start scroll lock");
}

context.window.scrollY = 900;
intervals[intervals.length - 1]();

if (!lastScrollTo || lastScrollTo.y !== 320) {
  throw new Error("Expected scroll lock to restore the scroll position captured before sending");
}

console.log("basic DOM test passed");
