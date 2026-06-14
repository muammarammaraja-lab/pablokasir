import{c as C}from"./index-Dze2gga_.js";/**
 * @license lucide-react v0.383.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const U=C("Download",[["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["polyline",{points:"7 10 12 15 17 10",key:"2ggqvy"}],["line",{x1:"12",x2:"12",y1:"15",y2:"3",key:"1vk2je"}]]);/**
 * @license lucide-react v0.383.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const z=C("Printer",[["path",{d:"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2",key:"143wyd"}],["path",{d:"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6",key:"1itne7"}],["rect",{x:"6",y:"14",width:"12",height:"8",rx:"1",key:"1ue0tg"}]]);/**
 * @license lucide-react v0.383.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const G=C("Share2",[["circle",{cx:"18",cy:"5",r:"3",key:"gq8acd"}],["circle",{cx:"6",cy:"12",r:"3",key:"w7nqdw"}],["circle",{cx:"18",cy:"19",r:"3",key:"1xt0gg"}],["line",{x1:"8.59",x2:"15.42",y1:"13.51",y2:"17.49",key:"47mynk"}],["line",{x1:"15.41",x2:"8.59",y1:"6.51",y2:"10.49",key:"1n3mei"}]]),r=l=>"Rp "+Math.round(l).toLocaleString("id-ID"),F=32,I=(l,u)=>{const o=String(u);return`<div class="receipt-line"><span>${String(l).slice(0,F-o.length-1).padEnd(F-o.length)}</span><span>${o}</span></div>`},V=l=>{const{storeName:u,storeAddress:o,receiptFooter:T,items:x,subtotal:S,discount_type:f,discount_value:s,total:n,payment_method:d,cash_given:h,txId:k}=l,p=new Date,w=p.toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}),e=p.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}),c=d==="Tunai"?(h||n)-n:0;let m=`
    <div class="receipt-big">${u||"Kasir FnB"}</div>
    ${o?`<div class="receipt-center" style="font-size:10pt">${o}</div>`:""}
    <div class="receipt-div"></div>
    <div class="receipt-line"><span>${w}</span><span>${e}</span></div>
    <div class="receipt-line"><span>No. Struk</span><span>#${String(k).slice(-4).padStart(4,"0")}</span></div>
    <div class="receipt-div"></div>
  `;for(const a of x)m+=`<div>${a.name||a.product_name}</div>${I(`  ${a.qty} x ${r(a.price)}`,r(a.price*a.qty))}`;if(m+=`<div class="receipt-div"></div>${I("Subtotal",r(S))}`,s>0){const a=f==="percent"?`Diskon (${s}%)`:"Diskon",b=f==="percent"?S*s/100:s;m+=I(a,"- "+r(b))}m+=`
    <div class="receipt-div"></div>
    <div class="receipt-line receipt-bold"><span>TOTAL</span><span>${r(n)}</span></div>
    <div class="receipt-div"></div>
    ${I(`Bayar (${d})`,r(d==="Tunai"&&h||n))}
    ${d==="Tunai"&&c>0?I("Kembalian",r(c)):""}
    <div class="receipt-div"></div>
    <div class="receipt-center">${T||"Terima kasih!"}</div>
  `;const y=document.getElementById("receipt-root");y.innerHTML=m,y.style.display="block",setTimeout(()=>{window.print(),y.style.display="none",y.innerHTML=""},100)},W=l=>{const{storeName:u,storeAddress:o,items:T,subtotal:x,discount_type:S,discount_value:f,total:s,payment_method:n,cash_given:d,txId:h}=l,k=new Date,p=k.toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}),w=k.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});let e=`*${u||"Kasir FnB"}*
`;o&&(e+=`${o}
`),e+=`─────────────────
`,e+=`📅 ${p}  🕐 ${w}
`,e+=`No: #${String(h).slice(-4).padStart(4,"0")}
`,e+=`─────────────────
`;for(const c of T)e+=`${c.name||c.product_name}
`,e+=`  ${c.qty} x ${r(c.price)} = ${r(c.price*c.qty)}
`;if(e+=`─────────────────
`,e+=`Subtotal : ${r(x)}
`,f>0){const c=S==="percent"?x*f/100:f;e+=`Diskon   : - ${r(c)}
`}return e+=`*TOTAL   : ${r(s)}*
`,e+=`─────────────────
`,e+=`Bayar    : ${n}
`,n==="Tunai"&&d>s&&(e+=`Kembali  : ${r(d-s)}
`),e+=`─────────────────
`,e+=`_${l.receiptFooter||"Terima kasih!"}_`,e},J=async l=>{const u=W(l);if(navigator.share)try{await navigator.share({title:"Struk Belanja",text:u});return}catch{}window.open(`https://wa.me/?text=${encodeURIComponent(u)}`,"_blank")},Q=l=>{const{storeName:u,storeAddress:o,receiptFooter:T,items:x,subtotal:S,discount_type:f,discount_value:s,total:n,payment_method:d,cash_given:h,txId:k}=l,p=i=>"Rp "+Math.round(i).toLocaleString("id-ID"),w=new Date,e=w.toLocaleDateString("id-ID",{day:"2-digit",month:"2-digit",year:"numeric"}),c=w.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}),m=320,y=20,a=20,b='13px "Courier New", monospace',H='bold 14px "Courier New", monospace',K='bold 17px "Courier New", monospace',v='11px "Courier New", monospace';let A=9+x.length*2+3;o&&A++,s>0&&A++,d==="Tunai"&&h>n&&A++;const q=A*a+y*3+24,N=document.createElement("canvas"),B=2;N.width=m*B,N.height=q*B;const t=N.getContext("2d");t.scale(B,B),t.fillStyle="#ffffff",t.fillRect(0,0,m,q),t.strokeStyle="#e7e5e4",t.lineWidth=1,t.strokeRect(3,3,m-6,q-6);let g=y+4;const M=(i,L=b,_="#1c1917")=>{t.font=L,t.fillStyle=_,t.textAlign="center",t.fillText(i,m/2,g),g+=a},$=(i,L,_=b,j="#1c1917")=>{t.font=_,t.fillStyle=j,t.textAlign="left",t.fillText(String(i),y,g),t.textAlign="right",t.fillText(String(L),m-y,g),g+=a},O=(i,L=b,_="#1c1917")=>{t.font=L,t.fillStyle=_,t.textAlign="left",t.fillText(i,y,g),g+=a},D=(i=!1)=>{t.beginPath(),t.strokeStyle="#d6d3d1",t.lineWidth=.5,t.setLineDash(i?[4,4]:[]),t.moveTo(y,g),t.lineTo(m-y,g),t.stroke(),t.setLineDash([]),g+=a*.7};M(u||"Kasir FnB",K),o&&M(o,v,"#78716c"),g+=4,D(),$(e,c,v,"#78716c"),$("No. Struk","#"+String(k).slice(-4).padStart(4,"0"),v,"#78716c"),D(!0);for(const i of x)O(i.name||i.product_name),$(`  ${i.qty} x ${p(i.price)}`,p(i.price*i.qty),v,"#57534e");if(D(!0),$("Subtotal",p(S),v,"#57534e"),s>0){const i=f==="percent"?S*s/100:s;$("Diskon","- "+p(i),v,"#f97316")}D(),$("TOTAL",p(n),H),D();const P=d==="Tunai"&&h||n;$(`Bayar (${d})`,p(P),v,"#57534e"),d==="Tunai"&&h>n&&$("Kembalian",p(h-n),v,"#10b981"),g+=6,D(),M(T||"Terima kasih!",v,"#78716c");const R=document.createElement("a");R.download=`struk-${String(k).slice(-4).padStart(4,"0")}.png`,R.href=N.toDataURL("image/png"),R.click()};export{U as D,z as P,G as S,Q as d,V as p,J as s};
