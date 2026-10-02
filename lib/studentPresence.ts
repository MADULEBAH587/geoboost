"use client";

import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { ensureAnonymousFirebaseUser, getFirebaseServices } from "./firebase";

export type StudentPresence = {
  id:string;
  classCode:string;
  studentId:string;
  studentName:string;
  currentUid:string;
  previousUid:string;
  duplicate:boolean;
  duplicateUntilMs:number;
  loginCount:number;
  lastLoginMs:number;
};

const ACTIVE_WINDOW_MS=2*60*60*1000;
const DUPLICATE_ALERT_MS=30*60*1000;

function presenceId(classCode:string,studentId:string){
  return classCode+"__"+studentId;
}

export async function registerStudentPresence(input:{classCode:string;studentId:string;studentName:string}){
  const services=getFirebaseServices();
  if(!services)return {duplicate:false};
  const user=await ensureAnonymousFirebaseUser();
  if(!user)return {duplicate:false};
  const now=Date.now();
  const ref=doc(services.db,"studentPresence",presenceId(input.classCode,input.studentId));
  const result=await runTransaction(services.db,async tx=>{
    const snap=await tx.get(ref);
    const current=snap.exists()?snap.data() as Record<string,any>:null;
    const otherActive=Boolean(
      current
      && String(current.currentUid||"")!==user.uid
      && now-Number(current.lastLoginMs||0)<ACTIVE_WINDOW_MS
    );
    const duplicateUntilMs=otherActive
      ? now+DUPLICATE_ALERT_MS
      : Math.max(Number(current?.duplicateUntilMs||0),0);
    tx.set(ref,{
      classCode:input.classCode,
      studentId:input.studentId,
      studentName:input.studentName,
      currentUid:user.uid,
      previousUid:otherActive?String(current?.currentUid||""):String(current?.previousUid||""),
      duplicateUntilMs,
      loginCount:Number(current?.loginCount||0)+1,
      lastLoginMs:now,
      lastLoginAt:serverTimestamp(),
    },{merge:true});
    return {duplicate:duplicateUntilMs>now};
  });
  return result;
}

export function watchStudentPresence(
  callback:(items:StudentPresence[])=>void,
  classCodes:string[]=[],
  allowAll=false,
){
  const services=getFirebaseServices();
  if(!services)return ()=>{};
  if(!allowAll&&!classCodes.length){callback([]);return ()=>{}}
  const source=allowAll
    ? collection(services.db,"studentPresence")
    : query(collection(services.db,"studentPresence"),where("classCode","in",classCodes.slice(0,30)));
  return onSnapshot(source,snap=>{
    const now=Date.now();
    const items=snap.docs.map(item=>{
      const data=item.data() as Record<string,any>;
      const duplicateUntilMs=Number(data.duplicateUntilMs||0);
      return {
        id:item.id,
        classCode:String(data.classCode||""),
        studentId:String(data.studentId||""),
        studentName:String(data.studentName||"Murid"),
        currentUid:String(data.currentUid||""),
        previousUid:String(data.previousUid||""),
        duplicate:duplicateUntilMs>now,
        duplicateUntilMs,
        loginCount:Number(data.loginCount||0),
        lastLoginMs:Number(data.lastLoginMs||0),
      } satisfies StudentPresence;
    });
    callback(items.sort((a,b)=>b.lastLoginMs-a.lastLoginMs));
  },()=>callback([]));
}
