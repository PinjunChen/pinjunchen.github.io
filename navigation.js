(() => {
  const site = document.querySelector("#pinjun-cut-current .pc-site");
  const reading = site?.querySelector(".pc-reading");
  if (!reading || !window.fetch || !window.AbortController) return;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const links = [...site.querySelectorAll(".pc-nav")];
  // Resolve once: relative navigation links must not drift after pushState.
  links.forEach(link => { link.href = new URL(link.href, location.href).href; });
  const routes = new Set(links.map(link => new URL(link.href).pathname));
  const headFields = [
    ["link[rel='canonical']", "href"],
    ["meta[name='description']", "content"],
    ["meta[property='og:title']", "content"],
    ["meta[property='og:description']", "content"],
    ["meta[property='og:url']", "content"],
    ["meta[name='twitter:title']", "content"],
    ["meta[name='twitter:description']", "content"]
  ];
  const cache = new Map();
  const scrollPositions = new Map();
  let displayedUrl = new URL(location.href);
  let navigationId = 0, motionId = 0, controller = null, animations = [];

  function snapshot(doc) {
    const content = doc.querySelector("#pinjun-cut-current .pc-reading");
    const activeLink = doc.querySelector(".pc-nav[aria-current='page']");
    if (!content || !activeLink) throw new Error("Not a personal-site page");
    return {
      content: [...content.children].map(node => node.cloneNode(true)),
      title: doc.title,
      label: activeLink.textContent.trim(),
      head: headFields.map(([selector, attribute]) => [selector, attribute, doc.querySelector(selector)?.getAttribute(attribute)])
    };
  }

  function cancelMotion() {
    motionId++;
    animations.forEach(animation => animation.cancel());
    animations = [];
    reading.style.removeProperty("height");
    reading.style.removeProperty("overflow");
    site.dataset.textMotion = "idle";
  }

  function animate(element, frames, options) {
    const animation = element.animate(frames, options);
    animations.push(animation);
    return animation;
  }

  async function enter() {
    if (reducedMotion.matches || !reading.animate) return;
    const id = ++motionId;
    site.dataset.textMotion = "enter";
    const compact = matchMedia("(max-width: 560px)").matches;
    const blocks = [...reading.querySelectorAll(".pc-content > *, .pc-empty > *")];
    const entering = blocks.map((block, index) => animate(block, [
      { opacity: 0, transform: `translate(${compact ? 10 : 16}px, 5px)`, clipPath: "inset(0 100% 0 0)" },
      { opacity: 1, transform: "translate(0, 0)", clipPath: "inset(0 0 0 0)" }
    ], {
      duration: 420,
      delay: Math.min(index, 6) * 42,
      easing: "cubic-bezier(.18,.8,.25,1)",
      fill: "both"
    }));
    await Promise.all(entering.map(animation => animation.finished.catch(() => {})));
    if (id !== motionId) return;
    entering.forEach(animation => animation.cancel());
    animations = animations.filter(animation => !entering.includes(animation));
    site.dataset.textMotion = "idle";
  }

  async function exit() {
    if (reducedMotion.matches || !reading.animate) return;
    site.dataset.textMotion = "exit";
    const leaving = animate(reading, [
      { opacity: 1, transform: "translate(0, 0)" },
      { opacity: 0, transform: "translate(-12px, -3px)" }
    ], { duration: 140, easing: "cubic-bezier(.4,0,.8,.3)", fill: "both" });
    await leaving.finished.catch(() => {});
  }

  async function load(url, signal) {
    if (cache.has(url.pathname)) return cache.get(url.pathname);
    const response = await fetch(url.href, { signal, credentials: "same-origin" });
    if (!response.ok || new URL(response.url).origin !== location.origin) throw new Error("Page request failed");
    const doc = new DOMParser().parseFromString(await response.text(), "text/html");
    const page = snapshot(doc);
    cache.set(url.pathname, page);
    return page;
  }

  async function navigate(url, fromHistory = false) {
    const id = ++navigationId;
    controller?.abort();
    controller = null;
    cancelMotion();
    scrollPositions.set(displayedUrl.href, [scrollX, scrollY]);
    if (url.href === displayedUrl.href) {
      reading.removeAttribute("aria-busy");
      site.dataset.navigation = "idle";
      return;
    }

    const request = new AbortController();
    controller = request;
    const timeout = setTimeout(() => request.abort(), 10000);
    reading.setAttribute("aria-busy", "true");
    site.dataset.navigation = "loading";
    try {
      // Keep the old text readable while the next document is loading.
      const page = await load(url, request.signal);
      clearTimeout(timeout);
      if (id !== navigationId) return;
      site.dataset.navigation = "transitioning";
      await exit();
      if (id !== navigationId) return;

      const oldHeight = reading.getBoundingClientRect().height;
      cancelMotion();
      reading.replaceChildren(...page.content.map(node => node.cloneNode(true)));
      const newHeight = reading.getBoundingClientRect().height;
      document.title = page.title;
      page.head.forEach(([selector, attribute, value]) => {
        if (value !== null && value !== undefined) document.querySelector(selector)?.setAttribute(attribute, value);
      });
      links.forEach(link => {
        if (new URL(link.href).pathname === url.pathname) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
      if (!fromHistory) history.pushState(null, "", url.href);
      displayedUrl = url;
      reading.setAttribute("aria-label", page.label);
      reading.focus({ preventScroll: true });
      const position = fromHistory ? (scrollPositions.get(url.href) || [0, 0]) : [0, 0];

      // Ease the quote and page height along with the text, rather than snapping
      // between the longer Home page and the shorter empty sections.
      let layout = Promise.resolve();
      if (!reducedMotion.matches && reading.animate && position[1] === 0 && Math.abs(oldHeight - newHeight) > 1) {
        reading.style.height = `${oldHeight}px`;
        reading.style.overflow = "hidden";
        const resizing = animate(reading, [{ height: `${oldHeight}px` }, { height: `${newHeight}px` }], {
          duration: 300, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both"
        });
        layout = resizing.finished.catch(() => {}).then(() => {
          if (id !== navigationId) return;
          reading.style.removeProperty("height");
          reading.style.removeProperty("overflow");
          resizing.cancel();
          animations = animations.filter(animation => animation !== resizing);
        });
      }
      window.scrollTo(...position);
      await Promise.all([enter(), layout]);
      if (id !== navigationId) return;
      controller = null;
      reading.removeAttribute("aria-busy");
      site.dataset.navigation = "idle";
    } catch {
      if (id !== navigationId) return;
      cancelMotion();
      reading.removeAttribute("aria-busy");
      site.dataset.navigation = "idle";
      // Real static routes remain the fallback if fetch or enhancement fails.
      if (fromHistory) location.replace(url.href);
      else location.assign(url.href);
    } finally {
      clearTimeout(timeout);
    }
  }

  cache.set(displayedUrl.pathname, snapshot(document));
  reading.tabIndex = -1;
  reading.setAttribute("aria-label", cache.get(displayedUrl.pathname).label);
  site.dataset.navigation = "idle";
  site.dataset.textMotion = "idle";
  history.scrollRestoration = "manual";
  links.forEach(link => link.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute("download")) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || !routes.has(url.pathname) || url.hash) return;
    event.preventDefault();
    void navigate(url);
  }));
  window.addEventListener("popstate", () => {
    const url = new URL(location.href);
    if (routes.has(url.pathname)) void navigate(url, true);
    else location.reload();
  });
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) cancelMotion();
  });
  window.addEventListener("pagehide", () => {
    navigationId++;
    controller?.abort();
    controller = null;
    cancelMotion();
    reading.removeAttribute("aria-busy");
    site.dataset.navigation = "idle";
  });
  void enter();
})();
