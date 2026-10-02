"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { chapters } from "@/lib/data";
import {
  archiveVisualAsset, deleteVisualAsset, listVisualAssets, saveVisualAsset,
  type VisualAssetCategory, type VisualAssetMeta,
} from "@/lib/visualNotesMedia";

const MAX_FILE_BYTES=480*1024;
const INTERNAL_LIBRARY_BYTES=100*1024*1024;

function prettyBytes(value:number){
  if(value<1024)return value+" B";
  if(value<1024*1024)return (value/1024).toFixed(0)+" KB";
  return (value/1024/1024).toFixed(1)+" MB";
}

function readAsDataUrl(file:File):Promise<string>{
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||""));
    reader.onerror=()=>reject(reader.error||new Error("Fail tidak dapat dibaca"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src:string):Promise<HTMLImageElement>{
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error("Imej tidak dapat diproses"));
    img.src=src;
  });
}

function dataUrlBytes(dataUrl:string){
  const base64=dataUrl.split(",")[1]||"";
  return Math.ceil(base64.length*0.75);
}

async function compressImage(file:File){
  const original=await readAsDataUrl(file);
  const img=await loadImage(original);
  let width=img.naturalWidth;
  let height=img.naturalHeight;
  const maxSide=1800;
  if(Math.max(width,height)>maxSide){
    const scale=maxSide/Math.max(width,height);
    width=Math.max(1,Math.round(width*scale));
    height=Math.max(1,Math.round(height*scale));
  }

  for(let pass=0;pass<5;pass++){
    const canvas=document.createElement("canvas");
    canvas.width=width; canvas.height=height;
    const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("Pelayar tidak menyokong pemampatan imej");
    ctx.fillStyle="#ffffff";ctx.fillRect(0,0,width,height);
    ctx.drawImage(img,0,0,width,height);
    for(const quality of [0.84,0.74,0.64,0.54,0.44]){
      const dataUrl=canvas.toDataURL("image/webp",quality);
      const sizeBytes=dataUrlBytes(dataUrl);
      if(sizeBytes<=MAX_FILE_BYTES){
        return {dataUrl,sizeBytes,width,height,mimeType:"image/webp"};
      }
    }
    width=Math.max(640,Math.round(width*.82));
    height=Math.max(360,Math.round(height*.82));
  }
  throw new Error("Imej masih terlalu besar selepas dimampatkan. Gunakan imej yang lebih kecil.");
}

export function VisualNotesAdmin({canEdit}:{canEdit:boolean}){
  const [items,setItems]=useState<VisualAssetMeta[]>([]);
  const [chapter,setChapter]=useState(1);
  const [category,setCategory]=useState<VisualAssetCategory>("poster");
  const [title,setTitle]=useState("");
  const [files,setFiles]=useState<File[]>([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function refresh(){
    setItems(await listVisualAssets(undefined,true));
  }
  useEffect(()=>{void refresh()},[]);

  const used=useMemo(()=>items.reduce((s,x)=>s+x.sizeBytes,0),[items]);
  const current=items.filter(x=>x.chapter===chapter);

  async function onUpload(){
    if(!canEdit||!files.length)return;
    if(used>=INTERNAL_LIBRARY_BYTES){setMessage("Had dalaman pustaka telah dicapai.");return}
    setBusy(true);setMessage("");
    try{
      let order=current.filter(x=>x.category===category).reduce((m,x)=>Math.max(m,x.order),0)+1;
      let batchUsed=used;
      for(let i=0;i<files.length;i++){
        const prepared=await compressImage(files[i]);
        if(batchUsed+prepared.sizeBytes>INTERNAL_LIBRARY_BYTES)throw new Error("Muat naik dihentikan kerana melebihi had dalaman 100 MB.");
        batchUsed+=prepared.sizeBytes;
        await saveVisualAsset({
          chapter,category,
          title:(title.trim()||files[i].name.replace(/\.[^.]+$/,""))+(files.length>1?" · "+(i+1):""),
          order:order++,
          mimeType:prepared.mimeType,
          sizeBytes:prepared.sizeBytes,
          width:prepared.width,
          height:prepared.height,
          active:true,
          dataUrl:prepared.dataUrl,
        });
      }
      setFiles([]);setTitle("");
      setMessage(files.length+" bahan berjaya dimampatkan dan diterbitkan.");
      await refresh();
    }catch(error:any){
      setMessage(String(error?.message||"Muat naik gagal."));
    }finally{setBusy(false)}
  }

  async function toggle(item:VisualAssetMeta){
    if(!canEdit)return;
    setBusy(true);
    try{await archiveVisualAsset(item.id,!item.active);await refresh()}
    finally{setBusy(false)}
  }

  async function remove(item:VisualAssetMeta){
    if(!canEdit||!window.confirm("Padam bahan ini secara kekal?"))return;
    setBusy(true);
    try{await deleteVisualAsset(item.id);await refresh()}
    finally{setBusy(false)}
  }

  const progress=Math.min(100,Math.round(used/INTERNAL_LIBRARY_BYTES*100));

  return <section className="panel visual-admin">
    <div className="panel-title">
      <div><small>NOTA VISUAL</small><h2>Poster, gambar & slide</h2><p className="class-help">Imej dimampatkan ke WebP dan disimpan dalam Firestore. Tiada Firebase Storage digunakan.</p></div>
      <a className="launch-button active" href={"/nota/"+chapter} target="_blank">Pratonton Bab {chapter} ↗</a>
    </div>

    <div className="visual-storage-meter">
      <div><strong>{prettyBytes(used)}</strong><span>digunakan daripada had dalaman 100 MB</span></div>
      <div className="visual-storage-track"><i style={{width:progress+"%"}}/></div>
      <small>Had setiap imej selepas mampatan: 480 KB. Ini sengaja dibuat rendah untuk kekalkan projek ringan dan percuma.</small>
    </div>

    <div className="visual-admin-toolbar">
      <label>Bab<select value={chapter} onChange={e=>setChapter(Number(e.target.value))}>{chapters.map(ch=><option key={ch.id} value={ch.id}>Bab {ch.id} · {ch.title}</option>)}</select></label>
      <label>Jenis<select value={category} onChange={e=>setCategory(e.target.value as VisualAssetCategory)}><option value="poster">Poster</option><option value="slide">Slide</option><option value="diagram">Peta / Rajah</option></select></label>
      <label className="visual-title-field">Tajuk<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Contoh: Ringkasan Bab 7"/></label>
    </div>

    <div className="visual-upload-box">
      <div><span>🖼️</span><strong>Pilih imej</strong><small>PNG, JPG atau WebP. Untuk slide, pilih beberapa imej serentak mengikut turutan.</small></div>
      <label className={"visual-file-picker "+(!canEdit||busy?"disabled":"")}>
        {files.length?files.length+" fail dipilih":"Pilih Fail"}
        <input type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={!canEdit||busy} onChange={(e:ChangeEvent<HTMLInputElement>)=>setFiles(Array.from(e.target.files||[]))}/>
      </label>
      <button className="primary" onClick={onUpload} disabled={!canEdit||busy||!files.length}>{busy?"Memproses...":"Mampat & Terbitkan"}</button>
    </div>

    {message?<div className="teacher-message">{message}</div>:null}

    <div className="visual-admin-list">
      <div className="visual-admin-list-head"><b>Bab {chapter}</b><span>{current.length} bahan tambahan</span></div>
      {current.length?current.map(item=><div className={"visual-admin-row "+(!item.active?"archived":"")} key={item.id}>
        <span className="visual-kind">{item.category==="poster"?"POSTER":item.category==="slide"?"SLIDE":"RAJAH"}</span>
        <div><strong>{item.title}</strong><small>{prettyBytes(item.sizeBytes)} · {item.width}×{item.height}px · susunan {item.order}</small></div>
        <b>{item.active?"Aktif":"Arkib"}</b>
        <button disabled={!canEdit||busy} onClick={()=>toggle(item)}>{item.active?"Arkib":"Aktifkan"}</button>
        <button className="danger" disabled={!canEdit||busy} onClick={()=>remove(item)}>Padam</button>
      </div>):<div className="panel-empty">Belum ada media tambahan. Nota visual terbina dalam tetap tersedia untuk murid.</div>}
    </div>
  </section>;
}
