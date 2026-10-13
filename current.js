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
    const mark = new Image();
    mark.src = new URL("assets/chen-mark.svg?v=20261013",document.currentScript.src).href;
    const markRatio = 3.62;
    const grainTile = document.createElement("canvas");
    grainTile.width = grainTile.height = 128;
    const grainContext = grainTile.getContext("2d");
    const grainPixels = grainContext.createImageData(128,128);
    let grainSeed = 1313;
    for (let pixel = 0; pixel < grainPixels.data.length; pixel += 4) {
      grainSeed = (Math.imul(grainSeed,1664525)+1013904223) >>> 0;
      grainPixels.data[pixel] = 50;
      grainPixels.data[pixel+1] = 44;
      grainPixels.data[pixel+2] = 49;
      grainPixels.data[pixel+3] = grainSeed%7 === 0 ? 12 : 0;
    }
    grainContext.putImageData(grainPixels,0,0);
    const grain = context?.createPattern(grainTile,"repeat");
    let visible = true, frameId = 0, lastTime = 0, elapsed = 0, mode = "idle", lastPointerType = "";
    let pose = 0, returnFrom = 0, returnElapsed = 0, hint = 0, returnHintFrom = 0;
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
    function clipPolygon(points,axis,limit,keepGreater) {
      const output = [];
      const inside = point => keepGreater ? point[axis] >= limit : point[axis] <= limit;
      for (let index = 0; index < points.length; index++) {
        const a = points[index], b = points[(index+1)%points.length];
        const aInside = inside(a), bInside = inside(b);
        if (aInside) output.push(a);
        if (aInside !== bInside) {
          const fraction = (limit-a[axis])/(b[axis]-a[axis]);
          output.push([a[0]+(b[0]-a[0])*fraction,a[1]+(b[1]-a[1])*fraction]);
        }
      }
      return output;
    }
    function updateHitArea() {
      const pad = width <= 560 ? 10 : 28;
      const halfW = geometry.fontSize*markRatio*.5+pad;
      const halfH = geometry.fontSize*.5+pad;
      const cos = Math.cos(geometry.angle), sin = Math.sin(geometry.angle);
      let points = [[-halfW,-halfH],[halfW,-halfH],[halfW,halfH],[-halfW,halfH]].map(([x,y]) => {
        const skewedX = x-.09*y;
        return [geometry.cx+skewedX*cos-y*sin,geometry.cy+skewedX*sin+y*cos];
      });
      points = clipPolygon(points,0,geometry.clipX,true);
      points = clipPolygon(points,0,width,false);
      points = clipPolygon(points,1,geometry.clipY,true);
      points = clipPolygon(points,1,geometry.clipY+geometry.clipH,false);
      const left = Math.min(...points.map(point => point[0]));
      const top = Math.min(...points.map(point => point[1]));
      const hitWidth = Math.max(44,Math.max(...points.map(point => point[0]))-left);
      const hitHeight = Math.max(44,Math.max(...points.map(point => point[1]))-top);
      art.style.left = left+"px";
      art.style.top = top+"px";
      art.style.width = hitWidth+"px";
      art.style.height = hitHeight+"px";
      art.style.clipPath = "polygon("+points.map(([x,y]) => `${(x-left)/hitWidth*100}% ${(y-top)/hitHeight*100}%`).join(",")+")";
    }
    function draw() {
      if (!context || !width || !height) return;
      const w = width, h = height;
      const cut = pose * design.strength;
      context.setTransform(ratio,0,0,ratio,0,0);
      context.clearRect(0,0,w,h);
      context.save();

      // Matte, intersecting cut planes. No blur, soft shadow, or liquid shape.
      const blushPlane = [[w*(.84-.028*cut),-h*.16],[w*1.18,-h*.16],[w*1.18,h*1.16],[w*(.56+.025*cut),h*1.16]];
      const platePlane = [[w*(.89+.025*cut),-h*.08],[w*1.12,-h*.08],[w*(.73+.025*cut),h*.72],[w*(.63+.025*cut),h*.56]];
      polygon(blushPlane, colors.blush);
      polygon(platePlane, colors.plate);
      if (grain) {
        context.save();
        context.beginPath();
        [blushPlane,platePlane].forEach(points => {
          points.forEach(([x,y],index) => index ? context.lineTo(x,y) : context.moveTo(x,y));
          context.closePath();
        });
        context.clip();
        context.fillStyle = grain;
        context.globalAlpha = .4;
        context.fillRect(0,0,w,h);
        context.restore();
      }
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
      const textWidth = size*markRatio;

      // Two quiet corner marks replace the overlapping spatial wireframes.
      context.save();
      context.translate(cx,cy);
      context.rotate(geometry.angle);
      const halfW = textWidth*.5+10+hint*3, halfH = size*.5+10+hint*3, corner = size*.24;
      if (art.matches(":focus-visible")) {
        context.strokeStyle = colors.accent;
        context.globalAlpha = .8;
        context.lineWidth = 1.5;
        context.strokeRect(-halfW-5,-halfH-5,halfW*2+10,halfH*2+10);
      }
      context.beginPath();
      context.moveTo(-halfW,-halfH+corner);
      context.lineTo(-halfW,-halfH);
      context.lineTo(-halfW+corner,-halfH);
      context.moveTo(halfW,halfH-corner);
      context.lineTo(halfW,halfH);
      context.lineTo(halfW-corner,halfH);
      context.strokeStyle = colors.ink;
      context.globalAlpha = .4+hint*.2;
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
        context.globalAlpha = .94;
        if (mark.complete && mark.naturalWidth) context.drawImage(mark,-textWidth*.5,-size*.5,textWidth,size);
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
        const clipY = email.top-box.top-13;
        const available = width-clipX;
        const clipH = email.height+26;
        geometry = { cx: clipX+available*.5, cy: email.top-box.top+email.height*.5, fontSize: Math.min(38,available*.247), angle: -.09, shift: Math.min(7,available*.04), clipX, clipY, clipH, bandTop: clipY, bandHeight: clipH/3 };
      } else {
        const clipX = readingBox.right-box.left-rightPadding+26;
        const clipY = email.bottom-box.top+22;
        const available = width-clipX;
        const clipH = Math.max(44,height-clipY);
        geometry = { cx: clipX+available*.52, cy: clipY+clipH*.5, fontSize: Math.min(available*.5,clipH*.235), angle: -1.34, shift: Math.min(width*.027,available*.08), clipX, clipY, clipH, bandTop: clipY, bandHeight: clipH/3 };
      }
      updateHitArea();
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
      hint = 0;
      returnFrom = 0;
      returnHintFrom = 0;
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
      if (!isRunning() || (pose === 0 && hint === 0)) { stop(); return; }
      if (frameId) cancelAnimationFrame(frameId);
      returnFrom = pose;
      returnHintFrom = hint;
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
          hint = returnHintFrom*Math.pow(1-progress,3);
          if (progress === 1) { stop(); return; }
        } else {
          elapsed += step;
          if (mode === "once" && elapsed >= cycle) { stop(); return; }
          if (mode === "hover" && elapsed >= cycle) elapsed %= cycle;
          pose = cutAt(elapsed);
          hint = 1-(1-hint)*Math.exp(-step*25);
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
    art.addEventListener("focus",draw);
    art.addEventListener("click",event => {
      if (event.detail > 0 && lastPointerType !== "touch" && hoverPointer.matches) return;
      if (mode === "once") settle();
      else start("once");
    });
    art.addEventListener("blur",() => { if (mode === "once") settle(); else draw(); });
    reducedMotion.addEventListener("change",() => requestAnimationFrame(render));
    document.addEventListener("visibilitychange",() => { if (document.hidden) stop(); });
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(site);
    const visibilityObserver = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (!visible) stop(); });
    visibilityObserver.observe(site);
    mark.addEventListener("load",() => { site.dataset.markReady = "true"; resize(); });
    if (mark.complete && mark.naturalWidth) site.dataset.markReady = "true";
    render();
    resize();

  })();
