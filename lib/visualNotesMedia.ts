"use client";

import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
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

function metaFromDoc(id:string,data:Record<string,any>):VisualAssetMeta{
  return {
    id,
    chapter:Number(data.chapter||1),
    category:(["poster","slide","diagram"].includes(data.category)?data.category:"poster") as VisualAssetCategory,
    title:String(data.title||"Nota Visual"),
    order:Number(data.order||0),
    mimeType:String(data.mimeType||"image/webp"),
    sizeBytes:Number(data.sizeBytes||0),
    width:Number(data.width||0),
    height:Number(data.height||0),
    active:data.active!==false,
    updatedAt:data.updatedAt?.toMillis?.() ?? data.updatedAt ?? Date.now(),
  };
}

export async function listVisualAssets(chapter?:number, includeArchived=false):Promise<VisualAssetMeta[]>{
  const services=getFirebaseServices();
  if(!services)return [];
  try{
    const snap=await getDocs(collection(services.db,"visualNoteAssets"));
    return snap.docs
      .map(d=>metaFromDoc(d.id,d.data() as Record<string,any>))
      .filter(x=>(chapter?x.chapter===chapter:true) && (includeArchived||x.active))
      .sort((a,b)=>a.chapter-b.chapter || a.category.localeCompare(b.category) || a.order-b.order || a.title.localeCompare(b.title));
  }catch{return []}
}

export async function getVisualAssetPayload(id:string):Promise<string>{
  const services=getFirebaseServices();
  if(!services)return "";
  try{
    const snap=await getDoc(doc(services.db,"visualNotePayloads",id));
    return snap.exists()?String(snap.data().dataUrl||""):"";
  }catch{return ""}
}

export async function saveVisualAsset(input:Omit<VisualAssetMeta,"id"|"updatedAt"> & {id?:string;dataUrl:string}){
  const services=getFirebaseServices();
  if(!services)throw new Error("Firebase belum dikonfigurasi");
  const id=input.id||("VN-"+input.chapter+"-"+input.category+"-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,6).toUpperCase());
  await setDoc(doc(services.db,"visualNoteAssets",id),{
    chapter:input.chapter,
    category:input.category,
    title:input.title.trim()||"Nota Visual",
    order:input.order,
    mimeType:input.mimeType,
    sizeBytes:input.sizeBytes,
    width:input.width,
    height:input.height,
    active:input.active,
    updatedAt:serverTimestamp(),
  },{merge:true});
  await setDoc(doc(services.db,"visualNotePayloads",id),{
    dataUrl:input.dataUrl,
    updatedAt:serverTimestamp(),
  },{merge:true});
  return id;
}

export async function archiveVisualAsset(id:string,active:boolean){
  const services=getFirebaseServices();
  if(!services)throw new Error("Firebase belum dikonfigurasi");
  await setDoc(doc(services.db,"visualNoteAssets",id),{active,updatedAt:serverTimestamp()},{merge:true});
}

export async function deleteVisualAsset(id:string){
  const services=getFirebaseServices();
  if(!services)throw new Error("Firebase belum dikonfigurasi");
  await Promise.all([
    deleteDoc(doc(services.db,"visualNoteAssets",id)),
    deleteDoc(doc(services.db,"visualNotePayloads",id)),
  ]);
}
