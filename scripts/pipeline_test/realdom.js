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
      console.log("\nreal DOM: loads, animates, and the camera moves");
      dom.window.close();
    },900);
  },600);
},1500);
