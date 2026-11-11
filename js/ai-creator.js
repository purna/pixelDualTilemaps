(() => {
  const APP = document.currentScript?.dataset.appId || 'pixel-app';
  const SPECS = {
    pixelArt: ['pixel-art sprite', 'Return JSON only: {"width":16,"height":16,"palette":["#hex"],"pixels":[[...]]}. pixels is height rows of width palette indexes. Use transparent as -1.'],
    pixelText: ['pixel lettering or icon art', 'Return JSON only: {"width":16,"height":16,"palette":["#hex"],"pixels":[[...]]}. pixels is height rows of width palette indexes. Use transparent as -1.'],
    pixelTilemap: ['seamless pixel tile', 'Return JSON only: {"width":16,"height":16,"palette":["#hex"],"pixels":[[...]]}. Make the edges tile seamlessly. pixels is height rows of width palette indexes; transparent is -1.'],
    pixelDualTilemaps: ['seamless dual tilemap tile', 'Return JSON only: {"width":16,"height":16,"palette":["#hex"],"pixels":[[...]]}. Make the edges tile seamlessly and use clear readable shapes. pixels is height rows of width palette indexes; transparent is -1.'],
    pixelPose: ['2D character pose', 'Return JSON only: {"nodes":[{"id":"node-id","x":0,"y":0}]}. Only include IDs from the supplied skeleton. Coordinates are in the editor character-local coordinate system. Keep feet near ground and limb lengths plausible.'],
    pixelMusic: ['8-bit sound effect', 'Return JSON only: {"name":"short sound name","settings":{"attack":0,"sustain":0,"punch":0,"decay":0,"frequency":0,"slide":0,"deltaSlide":0,"vibratoEnable":false,"vibratoDepth":0,"vibratoSpeed":0,"arpEnable":false,"arpMult":1,"arpSpeed":0,"duty":50,"dutySweep":0,"waveform":"square","lpfEnable":false,"lpf":22050,"hpfEnable":false,"hpf":0,"gain":-10}}. Tune numbers to make the requested sound.'],
    pixelIsometric: ['isometric 3D scene', 'Return JSON only: {"objects":[{"type":"cube|sphere|cylinder|ramp|wall|building","position":[x,y,z],"scale":[x,y,z],"color":"#hex","name":"short name"}]}. Use at most 12 objects and coordinates between -8 and 8.'],
  };
  const spec = SPECS[APP];
  if (!spec) return;
  const style = document.createElement('style');
  style.textContent = `
    #pixel-ai-create-launch{position:fixed;right:18px;bottom:18px;z-index:1001;display:inline-flex;align-items:center;gap:8px;padding:10px 16px;background:linear-gradient(135deg,var(--accent-primary,#00ff41),var(--accent-tertiary,#00d9ff));color:#00160a;border:1px solid var(--accent-primary,#00ff41);border-radius:6px;font:700 12px/1 'Inter',system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;box-shadow:0 0 18px var(--border-glow,rgba(0,255,65,.3)),0 4px 14px rgba(0,0,0,.45);cursor:pointer;transition:transform .2s ease,box-shadow .2s ease,filter .2s ease}
    #pixel-ai-create-launch:hover{transform:translateY(-2px);filter:brightness(1.08);box-shadow:0 0 26px var(--border-glow,rgba(0,255,65,.45)),0 8px 20px rgba(0,0,0,.5)}
    #pixel-ai-create-launch:active{transform:translateY(0)}
    #pixel-ai-create-launch i{font-size:13px}
    #pixel-ai-create{position:fixed;inset:0;z-index:10050;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.8);backdrop-filter:blur(4px);font-family:'Inter',system-ui,sans-serif;color:var(--text-primary,#e0e7ff)}
    #pixel-ai-create.open{display:flex}
    #pixel-ai-create .card{position:relative;display:flex;flex-direction:column;width:min(660px,94vw);max-height:88vh;overflow:hidden;background:linear-gradient(135deg,var(--bg-dark,#1a1a2e) 0%,var(--bg-medium,#16213e) 100%);border:1px solid var(--border-color,#2d3748);border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.65),0 0 40px rgba(0,255,65,.08)}
    #pixel-ai-create .card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--accent-primary,#00ff41),var(--accent-tertiary,#00d9ff),var(--accent-secondary,#ff006e))}
    #pixel-ai-create.open .card{animation:pixelAiPop .22s ease-out}
    @keyframes pixelAiPop{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
    #pixel-ai-create .pixel-ai-modal-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 20px 14px;border-bottom:1px solid var(--border-color,#2d3748);background:rgba(15,15,27,.35)}
    #pixel-ai-create .pixel-ai-kicker{display:flex;align-items:center;gap:6px;font-size:.62rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--accent-tertiary,#00d9ff)}
    #pixel-ai-create h2{display:flex;align-items:center;gap:8px;margin:5px 0 0;font-size:1.15rem;line-height:1.2;font-weight:700;color:var(--accent-primary,#00ff41);text-shadow:0 0 12px var(--border-glow,rgba(0,255,65,.35))}
    #pixel-ai-create .pixel-ai-close{width:32px;height:32px;display:grid;place-items:center;flex-shrink:0;background:transparent;border:1px solid transparent;border-radius:4px;color:var(--text-secondary,#94a3b8);font-size:22px;line-height:1;cursor:pointer;transition:all .2s ease}
    #pixel-ai-create .pixel-ai-close:hover{color:var(--accent-secondary,#ff006e);background:rgba(255,0,110,.1);border-color:rgba(255,0,110,.25)}
    #pixel-ai-create .pixel-ai-body{padding:18px 20px 20px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--accent-primary,#00ff41) var(--bg-dark,#1a1a2e)}
    #pixel-ai-create .pixel-ai-body::-webkit-scrollbar,#pixel-ai-create pre::-webkit-scrollbar{width:8px;height:8px}
    #pixel-ai-create .pixel-ai-body::-webkit-scrollbar-track,#pixel-ai-create pre::-webkit-scrollbar-track{background:var(--bg-dark,#1a1a2e);border-radius:4px}
    #pixel-ai-create .pixel-ai-body::-webkit-scrollbar-thumb,#pixel-ai-create pre::-webkit-scrollbar-thumb{background:var(--accent-primary,#00ff41);border-radius:4px}
    #pixel-ai-create .pixel-ai-body::-webkit-scrollbar-thumb:hover,#pixel-ai-create pre::-webkit-scrollbar-thumb:hover{background:var(--accent-secondary,#ff006e)}
    #pixel-ai-create .pixel-ai-intro{margin:0 0 16px;color:var(--text-secondary,#94a3b8);font-size:.82rem;line-height:1.5}
    #pixel-ai-create .pixel-ai-label{display:block;margin-bottom:7px;font-size:.68rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--text-secondary,#94a3b8)}
    #pixel-ai-create textarea{box-sizing:border-box;width:100%;min-height:110px;margin:0 0 14px;padding:12px;background:var(--bg-darkest,#0f0f1b);border:1px solid var(--border-color,#2d3748);border-radius:6px;color:var(--text-primary,#e0e7ff);font:14px/1.5 'Inter',system-ui,sans-serif;resize:vertical}
    #pixel-ai-create textarea::placeholder{color:var(--text-secondary,#94a3b8)}
    #pixel-ai-create textarea:focus{outline:none;border-color:var(--accent-primary,#00ff41);box-shadow:0 0 8px var(--border-glow,rgba(0,255,65,.3))}
    #pixel-ai-create .pixel-ai-actions{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
    #pixel-ai-create .pixel-ai-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 14px;background:var(--bg-light,#1e293b);border:1px solid var(--border-color,#2d3748);border-radius:4px;color:var(--text-primary,#e0e7ff);font:600 12px/1 'Inter',system-ui,sans-serif;cursor:pointer;transition:all .2s ease}
    #pixel-ai-create .pixel-ai-btn:hover{background:var(--bg-medium,#16213e);border-color:var(--text-secondary,#94a3b8);transform:translateY(-1px)}
    #pixel-ai-create .pixel-ai-btn.primary{background:var(--accent-primary,#00ff41);border-color:var(--accent-primary,#00ff41);color:#00160a;font-weight:700;box-shadow:0 0 12px var(--border-glow,rgba(0,255,65,.3))}
    #pixel-ai-create .pixel-ai-btn.primary:hover{filter:brightness(1.05);box-shadow:0 0 20px var(--border-glow,rgba(0,255,65,.45))}
    #pixel-ai-create .pixel-ai-btn.apply:not(:disabled){border-color:var(--accent-tertiary,#00d9ff);color:var(--accent-tertiary,#00d9ff)}
    #pixel-ai-create .pixel-ai-btn.apply:not(:disabled):hover{background:rgba(0,217,255,.1);box-shadow:0 0 12px rgba(0,217,255,.25)}
    #pixel-ai-create .pixel-ai-btn.ghost{margin-left:auto;background:transparent;color:var(--text-secondary,#94a3b8)}
    #pixel-ai-create .pixel-ai-btn.ghost:hover{color:var(--text-primary,#e0e7ff);background:var(--bg-light,#1e293b)}
    #pixel-ai-create .pixel-ai-btn:disabled{opacity:.45;cursor:not-allowed;transform:none;box-shadow:none}
    #pixel-ai-create .pixel-ai-status{min-height:1.3em;margin:0 0 16px;color:var(--accent-tertiary,#00d9ff);font-size:.78rem;line-height:1.45}
    #pixel-ai-create .pixel-ai-preview-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;font-size:.65rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--text-secondary,#94a3b8)}
    #pixel-ai-create .pixel-ai-preview-hint{color:var(--accent-tertiary,#00d9ff);letter-spacing:.08em}
    #pixel-ai-create pre{white-space:pre-wrap;word-break:break-word;max-height:34vh;overflow:auto;margin:0;padding:12px;background:var(--bg-darkest,#0f0f1b);border:1px solid var(--border-color,#2d3748);border-radius:6px;color:#b7f7d0;font:11px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;scrollbar-width:thin;scrollbar-color:var(--accent-primary,#00ff41) var(--bg-dark,#1a1a2e)}
    #pixel-ai-create-launch:focus-visible,#pixel-ai-create button:focus-visible,#pixel-ai-create textarea:focus-visible{outline:2px solid var(--accent-tertiary,#00d9ff);outline-offset:2px}
    @media (max-width:520px){#pixel-ai-create{padding:12px}#pixel-ai-create-launch{right:12px;bottom:12px;padding:10px 14px}#pixel-ai-create .pixel-ai-modal-header,#pixel-ai-create .pixel-ai-body{padding-left:16px;padding-right:16px}#pixel-ai-create .pixel-ai-actions .pixel-ai-btn{flex:1 1 100%}#pixel-ai-create .pixel-ai-btn.ghost{margin-left:0}}
  `;
  document.head.appendChild(style);
  const launch = document.createElement('button'); launch.id='pixel-ai-create-launch'; launch.type='button'; launch.innerHTML='<i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i><span>AI Create</span>';
  const modal = document.createElement('div'); modal.id='pixel-ai-create'; modal.innerHTML=`<section class="card" role="dialog" aria-modal="true" aria-labelledby="pixel-ai-title"><div class="pixel-ai-modal-header"><div><div class="pixel-ai-kicker"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> Pixel AI</div><h2 id="pixel-ai-title">AI Create</h2></div><button type="button" class="pixel-ai-close" data-ai-close aria-label="Close AI Create">&times;</button></div><div class="pixel-ai-body"><p class="pixel-ai-intro">Describe what you want to make in ${spec[0]}. The generated result is previewed before it changes the editor.</p><label class="pixel-ai-label" for="pixel-ai-prompt">Prompt</label><textarea id="pixel-ai-prompt" placeholder="Describe what you want to create…"></textarea><div class="pixel-ai-actions"><button type="button" class="pixel-ai-btn primary generate"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> Generate preview</button><button type="button" class="pixel-ai-btn apply" disabled><i class="fas fa-check" aria-hidden="true"></i> Apply to editor</button><button type="button" class="pixel-ai-btn ghost close" data-ai-close>Close</button></div><p class="pixel-ai-status status" role="status"></p><div class="pixel-ai-preview-head"><span>Preview</span><span class="pixel-ai-preview-hint">JSON</span></div><pre class="preview">Your preview will appear here.</pre></div></section>`;
  document.body.append(launch,modal);
  const status=modal.querySelector('.status'), preview=modal.querySelector('.preview'), apply=modal.querySelector('.apply');
  let result=null;
  launch.onclick=()=>modal.classList.add('open');
  modal.querySelectorAll('[data-ai-close]').forEach(button=>button.onclick=()=>modal.classList.remove('open'));
  modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')});
  modal.querySelector('.generate').onclick=async()=>{
    try{
      if(!window.PixelAIProvider) throw new Error('AI provider settings are unavailable. Refresh the page and try again.');
      const prompt=modal.querySelector('#pixel-ai-prompt').value.trim();
      if(!prompt) throw new Error('Describe what you want to create first.');
      status.textContent='Generating preview…'; apply.disabled=true;
      let context='';
      if(APP==='pixelPose'&&window.PixelPoseAIContext) context=' Current skeleton nodes: '+JSON.stringify(window.PixelPoseAIContext());
      const text=await window.PixelAIProvider.generateText(`Create ${spec[0]} for this request: ${prompt}.${context} ${spec[1]}`,'You generate safe, valid JSON for a creative editor. Return only one JSON object with no markdown fences.');
      result=JSON.parse(text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
      preview.textContent=JSON.stringify(result,null,2); apply.disabled=false; status.textContent='Preview ready. Review it, then apply it to the current document.';
    }catch(error){result=null;preview.textContent='No result.';status.textContent=error.message||String(error)}
  };
  apply.onclick=()=>{
    if(!result)return;
    try{
      if(['pixelArt','pixelText','pixelTilemap','pixelDualTilemaps'].includes(APP)) applyPixelGrid(result,APP);
      else { const adapter=window['PixelAIApply_'+APP]; if(typeof adapter!=='function')throw new Error('The editor AI adapter is not ready. Refresh the page and try again.'); adapter(result); }
      status.textContent='Applied to the editor.';
    }catch(error){status.textContent=error.message||String(error)}
  };
  function applyPixelGrid(data, appId){
    if(!Array.isArray(data.pixels)||!data.pixels.length||!Array.isArray(data.palette)||!data.palette.length)throw new Error('The generated pixel grid is incomplete. Generate another preview.');
    if(appId==='pixelArt'||appId==='pixelText'){
      const s=typeof State!=='undefined'?State:null, cm=typeof CanvasManager!=='undefined'?CanvasManager:null;
      const layer=s?.frames?.[s.currentFrameIndex]?.layers?.[s.activeLayerIndex];
      if(!layer?.data||!cm?.render)throw new Error('Could not find the active drawing layer.');
      const image=layer.data, w=image.width, h=image.height, pixels=data.pixels, palette=data.palette;
      const sourceH=pixels.length, sourceW=Math.max(...pixels.map(row=>Array.isArray(row)?row.length:0));
      if(!sourceW)throw new Error('The generated pixel grid is empty.');
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const index=pixels[Math.floor(y*sourceH/h)]?.[Math.floor(x*sourceW/w)];
        if(index===-1||index===null||index===undefined)continue;
        const color=palette[Number(index)]; if(!color)continue;
        const hex=String(color).replace('#',''); if(!/^[0-9a-f]{6}$/i.test(hex))continue;
        const p=(y*w+x)*4; image.data[p]=parseInt(hex.slice(0,2),16);image.data[p+1]=parseInt(hex.slice(2,4),16);image.data[p+2]=parseInt(hex.slice(4,6),16);image.data[p+3]=255;
      }
      cm.render(); if(typeof InputHandler!=='undefined')InputHandler.saveState?.();
    }else{
      const s=typeof State!=='undefined'?State:null, layer=s?.layers?.[s.activeLayerIndex], canvas=layer?.canvas;
      if(!canvas)throw new Error('Could not find the active tile layer.');
      const ctx=canvas.getContext('2d'), pixels=data.pixels, palette=data.palette;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
        const index=pixels[Math.floor(y*pixels.length/canvas.height)]?.[Math.floor(x*Math.max(...pixels.map(r=>r.length))/canvas.width)];
        if(index===-1||index===null||index===undefined)continue;
        const color=palette[Number(index)]; if(color){ctx.fillStyle=color;ctx.fillRect(x,y,1,1)}
      }
      if(typeof TilemapCore!=='undefined')TilemapCore.updatePreviews?.(); s.hasUnsavedChanges=true;
    }
  }
})();
