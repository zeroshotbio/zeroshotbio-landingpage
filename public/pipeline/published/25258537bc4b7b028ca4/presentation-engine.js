/* Published adapter for the editor's original vector scene. The viewer adopts
   the actual world and definitions, so drawing callbacks retain their nodes. */
(() => {
  const rowByNode=new Map();
  function rowOf(n,seen=new Set()){
    if(rowByNode.has(n.id))return rowByNode.get(n.id);
    const lane=/^r(\d)/.exec(n.lane||'');
    let row;
    if(lane)row=Number(lane[1])-1;
    else if(n.follow?.a&&byId[n.follow.a]&&!seen.has(n.id)){
      seen.add(n.id);row=rowOf(byId[n.follow.a],seen);
    }else if(n.scenery&&byId[n.from])row=rowOf(byId[n.from],seen);
    else{
      const originalY=n.y-(LIVE[n.id]?.dy||0);
      row=ROWS.reduce((best,y,i)=>Math.abs(y-originalY)<Math.abs(ROWS[best]-originalY)?i:best,0);
    }
    rowByNode.set(n.id,row);return row;
  }
  function boxOf(element){
    const b=element.getBBox(),m=world.getCTM().inverse().multiply(element.getCTM());
    const corners=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]]
      .map(([x,y])=>new DOMPoint(x,y).matrixTransform(m));
    const x=Math.min(...corners.map(p=>p.x)),y=Math.min(...corners.map(p=>p.y));
    return {x,y,width:Math.max(...corners.map(p=>p.x))-x,height:Math.max(...corners.map(p=>p.y))-y};
  }
  const sections=BANDEL.map((band,index)=>({id:`section-${index+1}`,index,name:band.b.name,band,nodes:[],elements:[],ticks:[],dots:[]}));
  function assign(element,row){
    if(!element)return;
    element.dataset.section=String(row);
    sections[row].elements.push({element,display:element.style.display});
  }
  NODES.forEach(n=>{
    const row=rowOf(n);sections[row].nodes.push(n);
    [nodeEls[n.id],labelEls[n.id],plinthEls[n.id]].forEach(e=>assign(e,row));
    nodeEls[n.id].dataset.node=n.id;
    if(labelEls[n.id])labelEls[n.id].dataset.node=n.id;
  });
  sections.forEach(s=>{assign(s.band.pad,s.index);assign(s.band.g,s.index);});
  const carryPaths=[...gEdge.children].filter(e=>e.tagName==='path');
  edgeGeom.forEach(e=>{
    e.section=e.a?rowByNode.get(e.a):sections.length-1;
    assign(e.host||carryPaths.shift(),e.section);
  });
  sections.forEach(s=>{
    // A directed depth puts parallel upstream branches at the same point in
    // the wave, and their shared downstream steps after both branches.
    const ids=new Set(s.nodes.map(n=>n.id)),depths=new Map();
    function depth(id,visiting=new Set()){
      if(depths.has(id))return depths.get(id);
      if(visiting.has(id))return 0;
      const path=new Set(visiting);path.add(id);
      const incoming=EDGES.filter(e=>e.b===id&&ids.has(e.a));
      const d=incoming.length?1+Math.max(...incoming.map(e=>depth(e.a,path))):0;
      depths.set(id,d);return d;
    }
    s.nodes.forEach(n=>depth(n.id));
    const max=Math.max(1,...depths.values());
    s.progress=Object.fromEntries([...depths].map(([id,d])=>[id,d/max]));
    s.ticks=TICKERS.filter(fn=>rowByNode.get(fn.__n?.id)===s.index);
    s.dots=DOTS.filter(r=>r.e.section===s.index);
    const main=s.nodes.filter(n=>n.lane&&!n.scenery);
    const terminal=(main.length?main:s.nodes).reduce((a,b)=>s.progress[b.id]>s.progress[a.id]||
      (s.progress[b.id]===s.progress[a.id]&&b.x>a.x)?b:a);
    s.end=P(terminal.x+terminal.w/2,terminal.y,0);
    s.entry=P(s.band.b.x0,(s.band.b.y0+s.band.b.y1)/2,0);
  });
  // A consistent populated initial pose; the overview never advances it.
  TICKERS.forEach(fn=>fn(0,0,1));
  function bounds(index){
    const elements=index===null?sections.flatMap(s=>s.elements):sections[index].elements;
    const boxes=elements.filter(r=>r.element.getAttribute('display')!=='none').map(r=>boxOf(r.element));
    const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
    return {x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};
  }
  // Cache before hiding anything; later measurement of display:none is zero.
  sections.forEach(s=>s.bounds=bounds(s.index));
  const overviewBounds=bounds(null);
  window.pipelinePresentation={
    world,definitions:defs,nodes:NODES,nodeEls,sections,overviewBounds,tickers:TICKERS,dots:DOTS,
    insideSil,silhouette:nodeSil,
    setSection(index){sections.forEach(s=>s.elements.forEach(({element,display})=>{
      element.style.display=index===null||s.index===index?display:'none';
    }));},
    setTheme(light){document.body.classList.toggle('light',light);readDotTones();},
    readNode(id){renderNode(id);return read.innerHTML;},
    payload(id){return document.getElementById(id)?.textContent||'';},
    describe(){return {bounds:overviewBounds,sections:sections.map(s=>({id:s.id,name:s.name,bounds:s.bounds,
      nodes:s.nodes.map(n=>n.id),progress:s.progress,end:s.end,entry:s.entry}))};}
  };
})();
