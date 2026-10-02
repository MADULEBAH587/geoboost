"use client";

import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseServices } from "./firebase";

export type VisualAssetCategory = "poster" | "slide" | "diagram";

export type VisualAssetMeta = {
  id: string;
  chapter: number;
  category: VisualAssetCategory;
  title: string;
  order: number;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  active: boolean;
  updatedAt?: number;
};

const INDEX_DOC="visualNoteAssetsIndex";

function normalizeMeta(data:Record<string,any>):VisualAssetMeta{
  return {
    id:String(data.id||""),
    chapter:Number(data.chapter||1),
    category:(["poster","slide","diagram"].includes(data.category)?data.category:"poster") as VisualAssetCategory,
    title:String(data.title||"Nota Visual"),
    order:Number(data.order||0),
    mimeType:String(data.mimeType||"image/webp"),
    sizeBytes:Number(data.sizeBytes||0),
    width:Number(data.width||0),
    height:Number(data.height||0),
    active:data.active!==false,
    updatedAt:Number(data.updatedAt||Date.now()),
  };
}

function normalizeIndex(raw:unknown):VisualAssetMeta[]{
  if(!Array.isArray(raw))return [];
  return raw.map(item=>normalizeMeta((item||{}) as Record<string,any>)).filter(item=>item.id);
}

export async function listVisualAssets(chapter?:number, includeArchived=false):Promise<VisualAssetMeta[]>{
  const services=getFirebaseServices();
  if(!services)return [];
  try{
    const snap=await getDoc(doc(services.db,"settings",INDEX_DOC));
    const items=normalizeIndex(snap.exists()?snap.data().items:[]);
    return items
      .filter(x=>(chapter?x.chapter===chapter:true) && (includeArchived||x.active))
      .sort((a,b)=>a.chapter-b.chapter || a.category.localeCompare(b.category) || a.order-b.order || a.title.localeCompare(b.title));
  }catch{return []}
}

export async function getVisualAssetPayload(id:string):Promise<string>{
  const services=getFirebaseServices();
  if(!services)return "";
  try{
    const snap=await getDoc(doc(services.db,"settings","visualNotePayload__"+id));
    return snap.exists()?String(snap.data().dataUrl||""):"";
  }catch{return ""}
}

export async function saveVisualAsset(input:Omit<VisualAssetMeta,"id"|"updatedAt"> & {id?:string;dataUrl:string}){
  const services=getFirebaseServices();
  if(!services)throw new Error("Firebase belum dikonfigurasi");
  const id=input.id||("VN-"+input.chapter+"-"+input.category+"-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,6).toUpperCase());
  const now=Date.now();
  const nextMeta:VisualAssetMeta={
    id,
    chapter:input.chapter,
    category:input.category,
    title:input.title.trim()||"Nota Visual",
    order:input.order,
    mimeType:input.mimeType,
    sizeBytes:input.sizeBytes,
    width:input.width,
    height:input.height,
    active:input.active,
    updatedAt:now,
  };
  const indexRef=doc(services.db,"settings",INDEX_DOC);
  const payloadRef=doc(services.db,"settings","visualNotePayload__"+id);

  await runTransaction(services.db,async tx=>{
    const indexSnap=await tx.get(indexRef);
    const items=normalizeIndex(indexSnap.exists()?indexSnap.data().items:[]);
    const next=[...items.filter(item=>item.id!==id),nextMeta];
    tx.set(indexRef,{items:next,updatedAtMs:now},{merge:true});
    tx.set(payloadRef,{dataUrl:input.dataUrl,mimeType:input.mimeType,updatedAt:serverTimestamp()},{merge:true});
  });
  return id;
}

export async function archiveVisualAsset(id:string,active:boolean){
  const services=getFirebaseServices();
  if(!services)throw new Error("Firebase belum dikonfigurasi");
  const indexRef=doc(services.db,"settings",INDEX_DOC);
  await runTransaction(services.db,async tx=>{
    const snap=await tx.get(indexRef);
    const items=normalizeIndex(snap.exists()?snap.data().items:[]);
    const now=Date.now();
    tx.set(indexRef,{items:items.map(item=>item.id===id?{...item,active,updatedAt:now}:item),updatedAtMs:now},{merge:true});
  });
}

export async function deleteVisualAsset(id:string){
  const services=getFirebaseServices();
  if(!services)throw new Error("Firebase belum dikonfigurasi");
  const indexRef=doc(services.db,"settings",INDEX_DOC);
  const payloadRef=doc(services.db,"settings","visualNotePayload__"+id);
  await runTransaction(services.db,async tx=>{
    const snap=await tx.get(indexRef);
    const items=normalizeIndex(snap.exists()?snap.data().items:[]);
    tx.set(indexRef,{items:items.filter(item=>item.id!==id),updatedAtMs:Date.now()},{merge:true});
    tx.delete(payloadRef);
  });
}

// Lightweight health probe for admin diagnostics.
export async function ensureVisualNotesIndex(){
  const services=getFirebaseServices();
  if(!services)return false;
  const ref=doc(services.db,"settings",INDEX_DOC);
  const snap=await getDoc(ref);
  if(!snap.exists())await setDoc(ref,{items:[],updatedAtMs:Date.now()},{merge:true});
  return true;
}
