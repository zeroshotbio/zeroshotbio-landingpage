/* Load the published editor scene into a full-window map-only surface. */
(() => {
  let engine;
  window.pipelineViewerDiag=()=>engine?.diagnostics()||{ready:false};
  async function load(){
    try{
      const response=await fetch('/pipeline/published/current.json',{cache:'no-cache'});
      if(!response.ok)throw Error('Unable to load the published map');
      const manifest=await response.json();
      if(manifest.format!==4)throw Error('Unsupported map version');
      const iframe=document.createElement('iframe');iframe.title='Interactive pipeline map';
      await new Promise((resolve,reject)=>{
        iframe.onload=resolve;iframe.onerror=reject;
        iframe.src=manifest.engine;document.getElementById('map').append(iframe);
      });
      engine=iframe.contentWindow.pipelinePresentation;
      if(!engine)throw Error('The drawing engine did not load');
      iframe.classList.add('ready');engine.start();
      document.getElementById('status').textContent='';
    }catch(error){
      console.error(error);document.getElementById('status').textContent='The map could not load. Please reload to try again.';
    }
  }
  load();
})();
