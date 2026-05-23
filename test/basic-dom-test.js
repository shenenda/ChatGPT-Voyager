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

  scrollIntoView(options) {
    this.scrolledWith = options;
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (matchesAny(node, selector)) {
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
    const result = [];
    walk(this, (node) => {
      if (node !== this && matchesAny(node, selector)) {
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

function matchesAny(node, selector) {
  return selector.split(",").some((item) => matches(node, item.trim()));
}

function matches(node, selector) {
  if (selector.startsWith("#")) {
    return node.id === selector.slice(1);
  }
  if (selector === "article") {
    return node.tagName === "ARTICLE";
  }
  if (selector === ".cgv-anchor-track") {
    return node.className.split(/\s+/).includes("cgv-anchor-track");
  }
  if (selector === ".cgv-anchor-dot") {
    return node.className.split(/\s+/).includes("cgv-anchor-dot");
  }
  if (selector === '[data-message-author-role="user"]') {
    return node.getAttribute("data-message-author-role") === "user";
  }
  if (selector === "[data-testid]" || selector === "[data-message-id]") {
    return Boolean(node.getAttribute(selector.slice(1, -1)));
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
  return article;
}

const firstPrompt = addMessage("user", "First prompt");
addMessage("assistant", "First answer");
addMessage("user", "Second prompt");

const document = {
  body,
  documentElement,
  querySelectorAll: (selector) => documentElement.querySelectorAll(selector),
  querySelector: (selector) => documentElement.querySelector(selector),
  getElementById: (id) => documentElement.querySelectorAll(`#${id}`)[0] || null,
  createElement: (tagName) => new Element(tagName)
};

const timers = [];
const context = {
  console,
  Element,
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
    setInterval: () => 1,
    scrollY: 0,
    scrollX: 0,
    innerHeight: 900,
    getComputedStyle: () => ({ visibility: "visible", display: "block" })
  }
};

context.window.window = context.window;
context.window.document = document;
context.window.history = context.history;
context.window.location = context.location;
context.window.Element = Element;
context.window.MutationObserver = context.MutationObserver;
context.window.IntersectionObserver = context.IntersectionObserver;
context.window.getComputedStyle = context.window.getComputedStyle;
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

if (document.getElementById("cgv-quote-action")) {
  throw new Error("Expected quote action UI to be removed");
}

dots[0].eventListeners.click();
if (!firstPrompt.scrolledWith || firstPrompt.scrolledWith.block !== "start") {
  throw new Error("Expected anchor dot click to scroll to the prompt");
}

console.log("basic DOM test passed");
