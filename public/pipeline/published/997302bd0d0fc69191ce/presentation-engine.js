/* Runs only inside the published scene's same-origin bootstrap frame. The
   original drawing functions and tickers remain the one source of visuals.
   The parent adopts the actual node groups, retaining their ticker references. */
window.pipelinePresentation={
  nodes:NODES, nodeEls, tickers:TICKERS, definitions:defs, dots:DOTS,
  insideSil, silhouette:nodeSil, projection:P, topOf,
  setTheme(light){document.body.classList.toggle("light",light);readDotTones();},
  readNode(id){ renderNode(id); return read.innerHTML; },
  readOverview(){ renderOverview(); return read.innerHTML; },
  payload(id){return document.getElementById(id)?.textContent||'';}
};
