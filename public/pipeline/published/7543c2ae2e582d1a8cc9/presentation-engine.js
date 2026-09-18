/* Thin adapter: the public surface runs the editor's own camera, animation
   scheduler and dot canvas. Presentation mode keeps authoring/API features off. */
(() => {
  let started=false,wasFitted=true;
  window.pipelinePresentation={
    describe(){
      const b=contentBox();
      return {bounds:{x:b.x,y:b.y,width:b.width,height:b.height},nodes:NODES.map(n=>n.id)};
    },
    start(){
      if(started)return;started=true;
      // The whole map is movable immediately; no opening shot or guided tour.
      anim=null;fit();sizeDotCanvas();placeDots(0);paintDots(true);
      svg.setAttribute('tabindex','0');
      svg.setAttribute('aria-label','Pipeline map. Drag to pan. Scroll or pinch to zoom. Home fits the map. M toggles motion.');
      nodeEls&&Object.values(nodeEls).forEach(g=>{g.removeAttribute('tabindex');g.removeAttribute('role');});
      svg.focus({preventScroll:true});
      const userCamera=()=>{wasFitted=false;};
      svg.addEventListener('pointerdown',userCamera);
      svg.addEventListener('wheel',userCamera,{passive:true});
      window.addEventListener('resize',()=>{if(wasFitted)fit();});
      window.addEventListener('keydown',e=>{
        if(e.metaKey||e.ctrlKey||e.altKey)return;
        if(['Home','0'].includes(e.key)){anim=null;fit();wasFitted=true;}
        else if(e.key.toLowerCase()==='m'){setMotion(!playing,false);}
        else if(['+','=','-'].includes(e.key)){
          const [cx,cy]=centre(),k=Math.max(.01,view.k*(e.key==='-'?1/1.4:1.4));
          view.x=cx-(cx-view.x)*k/view.k;view.y=cy-(cy-view.y)*k/view.k;view.k=k;applyView();wasFitted=false;
        }else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
          view.x+=e.key==='ArrowLeft'?80:e.key==='ArrowRight'?-80:0;
          view.y+=e.key==='ArrowUp'?80:e.key==='ArrowDown'?-80:0;applyView();wasFitted=false;
        }else return;
        e.preventDefault();
      });
      last=performance.now();requestAnimationFrame(frame);
    },
    diagnostics(){return {...pipelineDiag(),ready:started,view:{...view},nodes:NODES.length,
      hiddenNodes:Object.values(nodeEls).filter(g=>getComputedStyle(g).display==='none').length};}
  };
})();
