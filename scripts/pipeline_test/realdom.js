/* Load the actual page in a real DOM.
 *
 * runview.js drives the code against a hand-written stub, and that stub INVENTS
 * any element asked for and tolerates DOM calls a browser rejects — so it is
 * blind to a whole class of bug: a script reaching for an element the shell does
 * not have. That happened. A browser holding a stale index.html against fresh
 * scripts hit a null, everything after it in the file stopped, and the map drew
 * perfectly and then sat frozen with a dead camera.
 *
 *   node scripts/pipeline_test/realdom.js
 *   INDEX=/path/to/other.html node scripts/pipeline_test/realdom.js
 *
 * Needs jsdom:  npm install --no-save jsdom
 *
 * Deliberately NOT in package.json. It is a local test dependency, the build
 * does not want it, and adding it without regenerating package-lock.json makes
 * `npm ci` fail on Vercel — which is a far worse failure than not having the
 * test.
 */
const fs=require("fs"), path=require("path");
const {JSDOM, VirtualConsole}=require("jsdom");
const DIR=path.resolve(__dirname,"../../public/pipeline");

const errs=[];
const vc=new VirtualConsole();
vc.on("jsdomError",e=>errs.push("jsdomError: "+(e.detail?e.detail.stack||e.detail.message:e.message)));
vc.on("error",(...a)=>errs.push("console.error: "+a.join(" ")));

let html=fs.readFileSync(process.env.INDEX||path.join(DIR,"index.html"),"utf8");
/* jsdom gaps that a browser does not have — polyfill them so what is left is
   the page's own errors, not jsdom's */
const SHIM=`<script>
window.matchMedia = q => ({matches:false, media:q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){}});
if(!SVGElement.prototype.getBBox) SVGElement.prototype.getBBox = function(){
  return {x:0,y:-8,width:this.tagName==="text"?90:1000,height:this.tagName==="text"?11:800};
};
if(!Element.prototype.getBoundingClientRect) Element.prototype.getBoundingClientRect = function(){
  return {width:1200,height:800,left:0,top:0,right:1200,bottom:800,x:0,y:0};
};
Element.prototype.getBoundingClientRect = function(){
  return {width:1200,height:800,left:0,top:0,right:1200,bottom:800,x:0,y:0};
};
if(!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture=function(){};
if(!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture=function(){};
if(!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView=function(){};
window.fetch = () => Promise.reject(new Error("no network in this harness"));
<\/script>`;
html=html.replace("</head>", SHIM+"</head>");

// inline the four scripts so jsdom does not need to fetch them
html=html.replace(/<script src="\/pipeline\/([a-z-]+\.js)(\?[^"]*)?"><\/script>/g,
  (_,f)=>`<script>\n${fs.readFileSync(path.join(DIR,f),"utf8")}\n</script>`);

const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc,
                         url:"https://www.zeroshot.bio/pipeline"});
const w=dom.window;

setTimeout(()=>{
  if(errs.length){
    console.log(`${errs.length} ERROR(S) ON LOAD\n`);
    errs.slice(0,3).forEach(e=>console.log(e.split("\n").slice(0,6).join("\n")+"\n"));
  } else console.log("no errors on load");

  // did the tail of view.js run? fit() is the last thing before the rAF loop
  const svg=w.document.getElementById("svg");
  const world=svg&&svg.querySelector("g");
  console.log("world transform:", world?world.getAttribute("transform"):"NO WORLD");
  console.log("nodes drawn:", svg?svg.querySelectorAll("g[role=button]").length:0);
  console.log("index rows:", w.document.querySelectorAll(".row").length);
  console.log("step buttons:", !!w.document.getElementById("stNext"));

  // is the rAF loop actually turning? sample a dot's position over time
  /* a dot is a <g> whose first child is the r=10 transparent hit circle */
  const dots=[...svg.querySelectorAll("g")].filter(g=>{
    const c=g.firstElementChild; return c&&c.tagName==="circle"&&c.getAttribute("r")==="10"; });
  const anyDot=()=>dots.length?dots[0].getAttribute("transform"):null;
  console.log("dots found:", dots.length);
  const t1=anyDot();
  setTimeout(()=>{
    const t2=anyDot();
    console.log("dot moved over 600ms:", t1!==t2, t1===t2?`(stuck at ${t1})`:"");

    // now do what the user did: click a row in the left index
    const row=w.document.querySelector('.row[data-id="A5"]')||w.document.querySelector(".row");
    const before=world.getAttribute("transform");
    row.dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
    setTimeout(()=>{
      const after=world.getAttribute("transform");
      console.log("clicked", row.getAttribute("data-id"));
      console.log("  world before:", before);
      console.log("  world after: ", after);
      console.log("  camera moved:", before!==after);
      const bad=[];
      if(errs.length) bad.push(`${errs.length} error(s)`);
      if(!world.getAttribute("transform")) bad.push("the map never fitted — the tail of view.js did not run");
      if(t1===t2) bad.push("nothing is animating");
      if(before===after) bad.push("the camera did not move on an index click");
      if(bad.length){ console.log("\nFAIL — "+bad.join("; "));
        errs.slice(0,3).forEach(e=>console.log(e.split("\n").slice(0,7).join("\n")+"\n"));
        dom.window.close(); process.exit(1); }
      const boxBad=editorWindow(w);
      if(boxBad.length){ console.log("\nFAIL — "+boxBad.join("; "));
        dom.window.close(); process.exit(1); }
      console.log("\nreal DOM: loads, animates, the camera moves, and the editor is a window");
      dom.window.close();
    },900);
  },600);
},1500);


/* ============================================================
   THE TEXT EDITOR IS A WINDOW
   Only worth testing against the real shell: the head, the grip and the flex
   column all live in index.html, and the stub harness invents any element it
   is asked for — which is exactly how a box with no grip would pass there and
   fail here.
   ============================================================ */
function editorWindow(w){
  const bad=[], d=w.document;
  const pop=d.getElementById("tedit"), head=pop&&pop.querySelector(".tehead"),
        grip=d.getElementById("teGrip");
  if(!pop||!head||!grip){ return ["the shell has no draggable editor: "+
    [!pop&&"#tedit",!head&&".tehead",!grip&&"#teGrip"].filter(Boolean).join(" ")]; }
  const pt=(t,x,y)=>new w.MouseEvent(t,{bubbles:true,clientX:x,clientY:y,button:0});
  const num=v=>parseFloat(v||"0");

  d.getElementById("btnText").click();                       // into text mode
  const edits0=w.localStorage.getItem("pipeline.edits")||"";
  const handle=d.querySelector("#svg .thandle");
  if(!handle) return ["no clickable string boxes in text mode"];
  handle.dispatchEvent(pt("pointerdown",10,10));
  if(!pop.classList.contains("on")) return ["clicking a string did not open the editor"];
  const w0=num(pop.style.width), h0=num(pop.style.height),
        x0=num(pop.style.left),  y0=num(pop.style.top);
  console.log(`\neditor opened at ${x0},${y0} sized ${w0}x${h0}`);
  if(!(w0>0&&h0>0)) bad.push("the editor opened with no size of its own");

  head.dispatchEvent(pt("pointerdown",100,100));
  head.dispatchEvent(pt("pointermove",160,140));
  head.dispatchEvent(pt("pointerup",160,140));
  const x1=num(pop.style.left), y1=num(pop.style.top);
  console.log(`dragged by the head -> ${x1},${y1} (want ${x0+60},${y0+40})`);
  if(Math.abs(x1-(x0+60))>1||Math.abs(y1-(y0+40))>1) bad.push("dragging the head does not move the editor");
  if(num(pop.style.width)!==w0) bad.push("dragging the head resized it");

  grip.dispatchEvent(pt("pointerdown",0,0));
  grip.dispatchEvent(pt("pointermove",80,60));
  grip.dispatchEvent(pt("pointerup",80,60));
  const w1=num(pop.style.width), h1=num(pop.style.height);
  console.log(`pulled the grip -> ${w1}x${h1} (want ${w0+80}x${h0+60})`);
  if(Math.abs(w1-(w0+80))>1||Math.abs(h1-(h0+60))>1) bad.push("the corner grip does not resize the editor");
  if(num(pop.style.left)!==x1) bad.push("resizing moved the editor");

  const saved=JSON.parse(w.localStorage.getItem("pipeline.tedit.box")||"null");
  console.log("remembered:", JSON.stringify(saved));
  if(!saved||saved.w!==w1||saved.x!==x1) bad.push("the box was not remembered");
  /* geometry is furniture, not content: moving the editor must leave the edits
     payload — the thing that reaches the shared copy — exactly as it was */
  if((w.localStorage.getItem("pipeline.edits")||"")!==edits0)
    bad.push("moving the editor changed the edits payload");

  d.getElementById("teX").click();
  const other=[...d.querySelectorAll("#svg .thandle")][4];
  if(other){
    other.dispatchEvent(pt("pointerdown",10,10));
    console.log(`reopened at ${num(pop.style.left)},${num(pop.style.top)} sized `+
                `${num(pop.style.width)}x${num(pop.style.height)}`);
    if(num(pop.style.left)!==x1||num(pop.style.width)!==w1)
      bad.push("the editor jumped back instead of staying where it was put");
    d.getElementById("teX").click();
  }
  return bad;
}
