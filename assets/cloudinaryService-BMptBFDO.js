import{c as i}from"./index-Cp_sIlzL.js";/**
 * @license lucide-react v0.383.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=i("Upload",[["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["polyline",{points:"17 8 12 3 7 8",key:"t8dd8p"}],["line",{x1:"12",x2:"12",y1:"3",y2:"15",key:"widbto"}]]),n="cloudinary_cloud_name",l="cloudinary_upload_preset",c=()=>localStorage.getItem(n)||"",d=()=>localStorage.getItem(l)||"",m=e=>localStorage.setItem(n,e.trim()),g=e=>localStorage.setItem(l,e.trim()),y=()=>!!(c()&&d()),h=async e=>{const r=c(),s=d();if(!r||!s)throw new Error("Cloudinary belum diatur di Setting");const o=new FormData;o.append("file",e),o.append("upload_preset",s),o.append("folder","nexusbot-kasir");const t=await fetch(`https://api.cloudinary.com/v1_1/${r}/image/upload`,{method:"POST",body:o});if(!t.ok)throw new Error(`Cloudinary error: HTTP ${t.status}`);const a=await t.json();if(a.error)throw new Error("Upload gagal: "+a.error.message);return a.secure_url};export{u as U,d as a,g as b,c as g,y as h,m as s,h as u};
