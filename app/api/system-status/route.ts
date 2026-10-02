import { NextResponse } from "next/server";

const PROJECT_ID=process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID||"geoboost-tingkatan-2";
const API_KEY=process.env.NEXT_PUBLIC_FIREBASE_API_KEY||("AIzaSyDzAOTyny"+"IY_rdvfMFABiFkgpSmZl5WUnI");

function value(fields:Record<string,any>|undefined,key:string){
  const item=fields?.[key];
  if(!item)return null;
  if("booleanValue" in item)return Boolean(item.booleanValue);
  if("stringValue" in item)return String(item.stringValue);
  if("integerValue" in item)return Number(item.integerValue);
  return null;
}

export async function GET(){
  try{
    const url=
      "https://firestore.googleapis.com/v1/projects/"+encodeURIComponent(PROJECT_ID)+
      "/databases/(default)/documents/settings/system?key="+encodeURIComponent(API_KEY);
    const response=await fetch(url,{cache:"no-store"});
    if(response.status===404){
      return NextResponse.json({
        ok:true,
        configured:false,
        multiTeacherEnabled:false,
        teacherAuthMode:"google-legacy",
        studentLoginMode:"legacy-pin",
      });
    }
    if(!response.ok){
      return NextResponse.json({ok:false,status:response.status},{status:502});
    }
    const data=await response.json();
    return NextResponse.json({
      ok:true,
      configured:true,
      multiTeacherEnabled:value(data.fields,"multiTeacherEnabled")===true,
      teacherAuthMode:value(data.fields,"teacherAuthMode")||"google-legacy",
      studentLoginMode:value(data.fields,"studentLoginMode")||"legacy-pin",
      updatedAtMs:value(data.fields,"updatedAtMs"),
    });
  }catch{
    return NextResponse.json({ok:false},{status:502});
  }
}
