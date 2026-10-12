(() => {
    const root = document.getElementById("pinjun-cut-current");
    const site = root.querySelector(".pc-site");
    const canvas = site.querySelector(".pc-ambient");
    const context = canvas.getContext("2d", { alpha: true });
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const hoverPointer = matchMedia("(hover: hover) and (pointer: fine)");
    const art = site.querySelector(".pc-art");
    const design = { canvas: "#faf7f8", blush: "#efe2e7", gap: 20, motion: true, speed: 1, strength: 1 };
    const cycle = 2.8;
    let visible = true, frameId = 0, lastTime = 0, elapsed = 0, mode = "idle", lastPointerType = "";
    let pose = 0, returnFrom = 0, returnElapsed = 0;
    const returnDuration = .48;
    let width = 0, height = 0, ratio = 1, colors = {}, geometry = {};

    function prefersReducedMotion() {
      return reducedMotion.matches || getComputedStyle(site).getPropertyValue("--pc-reduced-motion").trim() === "1";
    }
    function readColors() {
      const style = getComputedStyle(site);
      colors = Object.fromEntries(["canvas","blush","plate","paper","ink","accent"].map(name => [name, style.getPropertyValue("--pc-" + name).trim()]));
    }
    function ease(value) {
      const v = Math.max(0, Math.min(1, value));
      return v < .5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
    }
    function cutAt(time) {
      const phase = ((time / cycle) % 1 + 1) % 1;
      if (phase < .1) return 0;
      if (phase < .33) return ease((phase - .1) / .23);
      if (phase < .49) return 1;
      if (phase < .91) return 1 - ease((phase - .49) / .42);
      return 0;
    }
    function openingTime(value) {
      const v = Math.max(0,Math.min(1,value));
      if (v === 0) return 0;
      const inverseEase = v < .5 ? Math.cbrt(v/4) : 1-Math.cbrt((1-v)/4);
      return cycle*(.1+.23*inverseEase);
    }
    function polygon(points, fill) {
      context.beginPath();
      points.forEach(([x,y], index) => index ? context.lineTo(x,y) : context.moveTo(x,y));
      context.closePath();
      context.fillStyle = fill;
      context.fill();
    }
    function draw() {
      if (!context || !width || !height) return;
      const w = width, h = height;
      const cut = pose * design.strength;
      context.setTransform(ratio,0,0,ratio,0,0);
      context.clearRect(0,0,w,h);
      context.save();

      // Matte, intersecting cut planes. No blur, soft shadow, or liquid shape.
      polygon([[w*(.84-.028*cut),-h*.16],[w*1.18,-h*.16],[w*1.18,h*1.16],[w*(.56+.025*cut),h*1.16]], colors.blush);
      polygon([[w*(.89+.025*cut),-h*.08],[w*1.12,-h*.08],[w*(.73+.025*cut),h*.72],[w*(.63+.025*cut),h*.56]], colors.plate);
      polygon([[w*(.74-.025*cut),h*.06],[w*1.18,h*.13],[w*1.18,h*.39],[w*(.69-.025*cut),h*.25]], colors.paper);
      polygon([[w*1.15,h*.52],[w*(.73-.018*cut),h*.85],[w*(.71-.018*cut),h*.97],[w*1.12,h*.67]], colors.paper);

      // The high-contrast installation has a protected boundary beside the text.
      context.save();
      context.beginPath();
      context.rect(geometry.clipX,geometry.clipY,Math.max(0,w-geometry.clipX+30),geometry.clipH);
      context.clip();
      const cx = geometry.cx, cy = geometry.cy;
      const size = geometry.fontSize;
      const angle = geometry.angle + cut * .035;
      context.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
      const textWidth = context.measureText("CHEN").width;

      // Two quiet corner marks replace the overlapping spatial wireframes.
      context.save();
      context.translate(cx,cy);
      context.rotate(geometry.angle);
      const halfW = textWidth*.53, halfH = size*.52, corner = size*.28;
      context.beginPath();
      context.moveTo(-halfW,-halfH+corner);
      context.lineTo(-halfW,-halfH);
      context.lineTo(-halfW+corner,-halfH);
      context.moveTo(halfW,halfH-corner);
      context.lineTo(halfW,halfH);
      context.lineTo(halfW-corner,halfH);
      context.strokeStyle = colors.ink;
      context.globalAlpha = .45;
      context.lineWidth = 1;
      context.stroke();
      context.restore();

      // One filled word, three coordinated cuts; no echo outlines.
      const bandTop = geometry.bandTop;
      const bandHeight = geometry.bandHeight;
      const slices = cut === 0 ? 1 : 3;
      for (let i = 0; i < slices; i++) {
        const direction = i === 1 ? 1 : -.65;
        const shift = direction * cut * geometry.shift;
        context.save();
        if (slices > 1) {
          context.beginPath();
          context.rect(geometry.clipX-30,bandTop+i*bandHeight,w+60,bandHeight);
          context.clip();
        }
        context.translate(cx+shift,cy);
        context.rotate(angle);
        context.transform(1,0,-.09,1,0,0);
        context.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.globalAlpha = .94;
        context.fillStyle = colors.ink;
        context.fillText("CHEN",0,0);
        context.restore();
      }
      context.restore();
      context.restore();
    }
    function resize() {
      width = site.clientWidth;
      height = site.clientHeight;
      ratio = Math.min(devicePixelRatio || 1,1.5);
      if (canvas.width !== Math.round(width*ratio) || canvas.height !== Math.round(height*ratio)) {
        canvas.width = Math.round(width*ratio);
        canvas.height = Math.round(height*ratio);
      }
      const box = site.getBoundingClientRect();
      const email = site.querySelector(".pc-email").getBoundingClientRect();
      const reading = site.querySelector(".pc-reading");
      const readingBox = reading.getBoundingClientRect();
      const rightPadding = parseFloat(getComputedStyle(reading).paddingRight);
      if (width <= 560) {
        const clipX = email.right-box.left+28;
        const clipY = email.top-box.top-10;
        const available = width-clipX;
        const clipH = email.height+22;
        geometry = { cx: clipX+available*.52, cy: email.top-box.top+email.height*.5, fontSize: Math.min(54,available*.29), angle: -.12, shift: Math.min(9,available*.045), clipX, clipY, clipH, bandTop: clipY, bandHeight: clipH/3 };
      } else {
        const clipX = readingBox.right-box.left-rightPadding+26;
        const clipY = email.bottom-box.top+22;
        const available = width-clipX;
        const clipH = Math.max(44,height-clipY);
        geometry = { cx: clipX+available*.52, cy: clipY+clipH*.5, fontSize: Math.min(available*.63,clipH*.27), angle: -1.34, shift: Math.min(width*.027,available*.08), clipX, clipY, clipH, bandTop: clipY, bandHeight: clipH/3 };
      }
      art.style.left = geometry.clipX+"px";
      art.style.top = geometry.clipY+"px";
      art.style.width = Math.max(44,width-geometry.clipX)+"px";
      art.style.height = geometry.clipH+"px";
      draw();
    }
    function isRunning() {
      return Boolean(mode !== "idle" && context && design.motion && visible && !document.hidden && root.isConnected && !prefersReducedMotion());
    }
    function updateArtState() {
      art.disabled = !design.motion || prefersReducedMotion();
      art.setAttribute("aria-pressed",mode === "idle" ? "false" : "true");
      art.dataset.motion = mode;
    }
    function stop() {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
      lastTime = 0;
      elapsed = 0;
      pose = 0;
      returnFrom = 0;
      returnElapsed = 0;
      mode = "idle";
      updateArtState();
      draw();
    }
    function start(nextMode) {
      if (!context || !design.motion || !visible || document.hidden || prefersReducedMotion()) { render(); return; }
      if (frameId) cancelAnimationFrame(frameId);
      mode = nextMode;
      // Re-enter at the same pose, including during the return transition.
      elapsed = openingTime(pose);
      returnElapsed = 0;
      lastTime = 0;
      updateArtState();
      draw();
      frameId = requestAnimationFrame(tick);
    }
    function settle() {
      if (mode === "idle" || mode === "return") return;
      if (!isRunning() || pose === 0) { stop(); return; }
      if (frameId) cancelAnimationFrame(frameId);
      returnFrom = pose;
      returnElapsed = 0;
      lastTime = 0;
      mode = "return";
      updateArtState();
      // Keep the current drawing on exit; subsequent frames ease it home.
      frameId = requestAnimationFrame(tick);
    }
    function tick(now) {
      frameId = 0;
      if (!isRunning()) { stop(); return; }
      if (!lastTime) lastTime = now;
      const delta = now-lastTime;
      if (delta >= 1000/30) {
        const step = Math.min(delta,80)/1000*design.speed;
        lastTime = now;
        if (mode === "return") {
          returnElapsed += step;
          const progress = Math.min(1,returnElapsed/returnDuration);
          pose = returnFrom*Math.pow(1-progress,3);
          if (progress === 1) { stop(); return; }
        } else {
          elapsed += step;
          if (mode === "once" && elapsed >= cycle) { stop(); return; }
          if (mode === "hover" && elapsed >= cycle) elapsed %= cycle;
          pose = cutAt(elapsed);
        }
        draw();
      }
      frameId = requestAnimationFrame(tick);
    }
    function render() {
      site.style.setProperty("--pc-canvas",design.canvas);
      site.style.setProperty("--pc-blush",design.blush);
      site.style.setProperty("--pc-gap",design.gap+"px");
      readColors();
      if (!design.motion || prefersReducedMotion()) stop();
      else updateArtState();
      if (width) resize();
    }
    art.addEventListener("pointerenter",event => {
      if (event.pointerType !== "touch" && hoverPointer.matches) start("hover");
    });
    art.addEventListener("pointerleave",() => { if (mode === "hover") settle(); });
    art.addEventListener("pointerdown",event => { lastPointerType = event.pointerType; });
    art.addEventListener("click",event => {
      if (event.detail > 0 && lastPointerType !== "touch" && hoverPointer.matches) return;
      if (mode === "once") settle();
      else start("once");
    });
    art.addEventListener("blur",() => { if (mode === "once") settle(); });
    reducedMotion.addEventListener("change",() => requestAnimationFrame(render));
    document.addEventListener("visibilitychange",() => { if (document.hidden) stop(); });
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(site);
    const visibilityObserver = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (!visible) stop(); });
    visibilityObserver.observe(site);
    render();
    resize();

  })();
