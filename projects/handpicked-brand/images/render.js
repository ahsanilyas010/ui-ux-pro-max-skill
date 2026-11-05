const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const F = (n) => 'file://' + path.resolve('node_modules/@fontsource', n);
const B = '/home/user/ui-ux-pro-max-skill/projects/handpicked-brand/';
const logo = 'file://' + B + 'handpicked-logo-transparent.png', mark = 'file://' + B + 'handpicked-mark.png';
const css = `
@font-face{font-family:CG;font-weight:500;font-style:normal;src:url(${F('cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2')})}
@font-face{font-family:CG;font-weight:500;font-style:italic;src:url(${F('cormorant-garamond/files/cormorant-garamond-latin-500-italic.woff2')})}
@font-face{font-family:CG;font-weight:600;font-style:italic;src:url(${F('cormorant-garamond/files/cormorant-garamond-latin-600-italic.woff2')})}
@font-face{font-family:Jost;font-weight:400;src:url(${F('jost/files/jost-latin-400-normal.woff2')})}
@font-face{font-family:Jost;font-weight:500;src:url(${F('jost/files/jost-latin-500-normal.woff2')})}
*{box-sizing:border-box;margin:0}
body{background:#F3EEE6;color:#1C1A17;font-family:Jost,sans-serif}
.eyebrow{font-weight:500;letter-spacing:.22em;text-transform:uppercase;color:#546B78}
.h{font-family:CG,serif;font-weight:500;line-height:1.02;letter-spacing:-.01em}
.h i{font-style:italic;font-weight:600;color:#8E1F3D}
.muted{color:#6B645B}
.sand{background:#E4DACB;border-radius:6px}
`;
const pill=(t,dark=true,fs=26)=>`<span style="display:inline-block;padding:${fs*.62}px ${fs*1.6}px;border-radius:35px;font-weight:500;font-size:${fs}px;letter-spacing:.04em;${dark?'background:#1C1A17;color:#F3EEE6':'border:1.5px solid #1C1A17;color:#1C1A17'}">${t}</span>`;
const pages = {
 'hero-desktop': {w:1920,h:823, html:`
  <div style="height:823px;position:relative">
   <img src="${logo}" style="position:absolute;left:120px;top:56px;height:70px">
   <div style="position:absolute;left:120px;top:210px;width:900px">
    <p class="eyebrow" style="font-size:20px">Export surplus &middot; outlet prices</p>
    <h1 class="h" style="font-size:104px;margin-top:26px">Original brands. <i>Outlet</i> prices.</h1>
    <p class="muted" style="font-size:28px;line-height:1.5;margin-top:28px;max-width:720px">Boss, Ralph Lauren, Lacoste, Pepe Jeans and 60+ labels. Delivered across Pakistan, cash on delivery.</p>
    <div style="display:flex;gap:18px;margin-top:44px">${pill('Shop new arrivals')}${pill('Shop by brand',false)}</div>
   </div>
   <div class="sand" style="position:absolute;right:120px;top:60px;width:560px;height:703px;display:grid;place-items:center"><img src="${mark}" style="width:60%"></div>
  </div>`},
 'hero-mobile': {w:828,h:960, html:`
  <div style="height:960px;position:relative">
   <div class="sand" style="position:absolute;left:48px;right:48px;top:48px;height:380px;display:grid;place-items:center"><img src="${mark}" style="width:38%"></div>
   <div style="position:absolute;left:48px;right:48px;top:470px">
    <p class="eyebrow" style="font-size:20px">Export surplus &middot; outlet prices</p>
    <h1 class="h" style="font-size:88px;margin-top:20px">Original brands. <i>Outlet</i> prices.</h1>
    <p class="muted" style="font-size:27px;line-height:1.45;margin-top:22px">100% original brands, delivered across Pakistan. Cash on delivery.</p>
    <div style="display:flex;gap:16px;margin-top:36px">${pill('Shop new arrivals',true,26)}${pill('By brand',false,26)}</div>
   </div>
  </div>`},
 'story-desktop': {w:1920,h:760, html:`
  <div style="height:760px;position:relative;background:#E4DACB">
   <div style="position:absolute;left:120px;top:130px;width:1120px">
    <p class="eyebrow" style="font-size:20px">Where the labels come from</p>
    <h2 class="h" style="font-size:80px;margin-top:24px">Export-surplus stock. <i>Original</i> labels. Honest prices.</h2>
    <p style="font-size:26px;line-height:1.55;margin-top:26px;max-width:760px" class="muted">We buy outlet stock from international labels, so every piece is 100% original, never a replica. Sizes are limited, and if it does not fit you get a 7-day free size exchange.</p>
    <div style="margin-top:38px">${pill('Read our story')}</div>
   </div>
   <div style="position:absolute;right:140px;top:110px;width:540px;height:540px;background:#F3EEE6;border-radius:6px;display:grid;place-items:center"><img src="${mark}" style="width:58%"></div>
  </div>`},
 'story-mobile': {w:828,h:1000, html:`
  <div style="height:1000px;position:relative;background:#E4DACB">
   <img src="${mark}" style="position:absolute;left:48px;top:48px;height:84px">
   <div style="position:absolute;left:48px;right:48px;top:190px">
    <p class="eyebrow" style="font-size:19px">Where the labels come from</p>
    <h2 class="h" style="font-size:74px;margin-top:18px">Export-surplus stock. <i>Original</i> labels. Honest prices.</h2>
    <p style="font-size:26px;line-height:1.5;margin-top:22px" class="muted">100% original, never a replica. 7-day free size exchange.</p>
    <div style="margin-top:34px">${pill('Read our story')}</div>
   </div>
  </div>`},
};
const tiles = [['Men','Polos, tees, shirts, jackets'],['Women','Tops, dresses, outerwear'],['Kids','Everyday brands, smaller sizes'],['Accessories','Watches, caps, bags, shoes']];
tiles.forEach(([t,sub],i)=>{ pages['tile-'+t.toLowerCase()]={w:900,h:1125,html:`
  <div style="height:1125px;position:relative;background:${i%2?'#F3EEE6':'#E4DACB'}">
   <img src="${mark}" style="position:absolute;left:56px;top:52px;height:84px">
   <div style="position:absolute;left:56px;right:56px;bottom:64px">
    <p class="eyebrow" style="font-size:19px">Shop</p>
    <h3 class="h" style="font-size:${t.length>7?118:150}px;margin-top:12px"><i>${t}</i></h3>
    <p class="muted" style="font-size:28px;margin-top:14px">${sub}</p>
    <div style="margin-top:30px">${pill('Shop now &rarr;',true,24)}</div>
   </div>
  </div>`}; });
(async()=>{
  const b = await chromium.launch(); 
  for (const [name,p] of Object.entries(pages)) {
    const pg = await b.newPage({viewport:{width:p.w,height:p.h}});
    fs.writeFileSync(name+'.html',`<html><head><meta charset=utf-8><style>${css}</style></head><body>${p.html}</body></html>`); await pg.goto('file://'+path.resolve(name+'.html'));
    await pg.waitForTimeout(400); await pg.evaluate(()=>document.fonts.ready);
    await pg.screenshot({path:name+'.png'}); await pg.close();
  }
  await b.close();
})();
