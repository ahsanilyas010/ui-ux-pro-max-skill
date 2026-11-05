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
const pages = {
 'hero-desktop': {w:1920,h:823, html:`
  <div style="height:823px;position:relative">
   <div class="sand" style="position:absolute;right:120px;top:60px;width:760px;height:703px;display:grid;place-items:center"><img src="${mark}" style="width:60%"></div>
   <img src="${logo}" style="position:absolute;left:120px;top:56px;height:84px">
  </div>`},
 'hero-mobile': {w:828,h:1104, html:`
  <div style="height:1104px;position:relative">
   <div class="sand" style="position:absolute;left:48px;right:48px;top:48px;height:560px;display:grid;place-items:center"><img src="${mark}" style="width:56%"></div>
  </div>`},
};
const tiles = [['Men','M'],['Women','W'],['Kids','K'],['Accessories','A']];
tiles.forEach(([t,l],i)=>{ pages['tile-'+t.toLowerCase()]={w:900,h:1125,html:`
  <div style="height:1125px;display:grid;place-items:center;background:${i%2?'#F3EEE6':'#E4DACB'};position:relative">
   <span class="h" style="font-size:560px;font-style:italic;font-weight:600;color:#8E1F3D;line-height:1">${l}</span>
   <img src="${mark}" style="position:absolute;left:56px;top:52px;height:84px">
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
