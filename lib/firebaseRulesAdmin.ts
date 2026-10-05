"use client";

import {
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
  signInWithPopup,
  type User,
} from "firebase/auth";
import { firebaseClientConfig, getFirebaseServices } from "./firebase";

const PROJECT_ID = firebaseClientConfig.projectId;

type AdminAuth = {
  token: string;
  user: User;
};

async function getAdminOAuth(): Promise<AdminAuth> {
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase belum dikonfigurasi");
  await setPersistence(services.auth,browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  provider.addScope("https://www.googleapis.com/auth/firebase");
  provider.addScope("https://www.googleapis.com/auth/datastore");
  provider.addScope("https://www.googleapis.com/auth/cloud-platform");
  provider.setCustomParameters({ prompt:"consent select_account" });
  const result = await signInWithPopup(services.auth,provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) throw new Error("Token pentadbiran Firebase tidak diterima");
  return {token:credential.accessToken,user:result.user};
}

async function api(url:string,token:string,init?:RequestInit) {
  const response=await fetch(url,{
    ...init,
    headers:{
      "Authorization":"Bearer "+token,
      "Content-Type":"application/json",
      ...(init?.headers||{}),
    },
  });
  const text=await response.text();
  let data:any={};
  try{data=text?JSON.parse(text):{}}catch{data={message:text}}
  if(!response.ok){
    const error=new Error(data?.error?.message||data?.message||("Google/Firebase API gagal ("+response.status+")"));
    (error as any).status=response.status;
    throw error;
  }
  return data;
}

async function enableEmailPassword(token:string){
  const url=
    "https://identitytoolkit.googleapis.com/admin/v2/projects/"+
    encodeURIComponent(PROJECT_ID)+
    "/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired";
  await api(url,token,{
    method:"PATCH",
    body:JSON.stringify({
      signIn:{
        email:{
          enabled:true,
          passwordRequired:true,
        },
      },
    }),
  });
}

async function enableAnonymousStudentAuth(token:string){
  const url=
    "https://identitytoolkit.googleapis.com/admin/v2/projects/"+
    encodeURIComponent(PROJECT_ID)+
    "/config?updateMask=signIn.anonymous.enabled";
  await api(url,token,{
    method:"PATCH",
    body:JSON.stringify({
      signIn:{
        anonymous:{enabled:true},
      },
    }),
  });
}

async function publishRules(token:string) {
  const rulesResponse=await fetch("/firestore.rules.txt",{cache:"no-store"});
  if(!rulesResponse.ok)throw new Error("Fail Firestore Rules tidak dapat dimuat");
  const content=await rulesResponse.text();
  const project="projects/"+PROJECT_ID;

  const ruleset=await api(
    "https://firebaserules.googleapis.com/v1/"+project+"/rulesets",
    token,
    {
      method:"POST",
      body:JSON.stringify({
        source:{files:[{name:"firestore.rules",content}]}
      }),
    },
  );
  const rulesetName=String(ruleset.name||"");
  if(!rulesetName)throw new Error("Ruleset baharu tidak mempunyai ID");

  const releaseName=project+"/releases/cloud.firestore";
  let exists=false;
  try{
    await api("https://firebaserules.googleapis.com/v1/"+releaseName,token,{method:"GET"});
    exists=true;
  }catch(error:any){
    if(error?.status!==404)throw error;
  }

  if(exists){
    await api(
      "https://firebaserules.googleapis.com/v1/"+releaseName,
      token,
      {
        method:"PATCH",
        body:JSON.stringify({
          release:{name:releaseName,rulesetName},
          updateMask:"rulesetName",
        }),
      },
    );
  }else{
    await api(
      "https://firebaserules.googleapis.com/v1/"+project+"/releases",
      token,
      {
        method:"POST",
        body:JSON.stringify({name:releaseName,rulesetName}),
      },
    );
  }
  return rulesetName;
}

async function setMultiTeacherConfig(token:string){
  const params=new URLSearchParams();
  ["multiTeacherEnabled","studentLoginMode","teacherAuthMode","updatedAtMs"].forEach(field=>params.append("updateMask.fieldPaths",field));
  const url=
    "https://firestore.googleapis.com/v1/projects/"+encodeURIComponent(PROJECT_ID)+
    "/databases/(default)/documents/settings/system?"+params.toString();
  await api(url,token,{
    method:"PATCH",
    body:JSON.stringify({
      fields:{
        multiTeacherEnabled:{booleanValue:true},
        studentLoginMode:{stringValue:"double-confirm"},
        teacherAuthMode:{stringValue:"email-password"},
        updatedAtMs:{integerValue:String(Date.now())},
      },
    }),
  });
}

async function upsertAdminTeacher(token:string,user:User) {
  const uid=user.uid;
  const params=new URLSearchParams();
  ["name","email","role","status","active"].forEach(field=>params.append("updateMask.fieldPaths",field));
  const url=
    "https://firestore.googleapis.com/v1/projects/"+encodeURIComponent(PROJECT_ID)+
    "/databases/(default)/documents/teachers/"+encodeURIComponent(uid)+"?"+params.toString();
  await api(url,token,{
    method:"PATCH",
    body:JSON.stringify({
      fields:{
        name:{stringValue:user.displayName||user.email||"Admin GeoBoost"},
        email:{stringValue:user.email||""},
        role:{stringValue:"admin"},
        status:{stringValue:"active"},
        active:{booleanValue:true},
      },
    }),
  });
  return uid;
}

export async function deployGeoBoostFirestoreRules() {
  const {token}=await getAdminOAuth();
  const rulesetName=await publishRules(token);
  return {rulesetName};
}

export async function deployGeoBoostMultiTeacher() {
  const {token,user}=await getAdminOAuth();
  await enableEmailPassword(token);
  await enableAnonymousStudentAuth(token);
  const rulesetName=await publishRules(token);
  const uid=await upsertAdminTeacher(token,user);
  await setMultiTeacherConfig(token);
  return {
    uid,
    email:user.email||"",
    name:user.displayName||user.email||"Admin GeoBoost",
    rulesetName,
    emailPasswordEnabled:true,
    anonymousStudentAuthEnabled:true,
  };
}

export async function bootstrapGeoBoostAdmin() {
  const {token,user}=await getAdminOAuth();
  await enableEmailPassword(token);
  await enableAnonymousStudentAuth(token);
  const rulesetName=await publishRules(token);
  const uid=await upsertAdminTeacher(token,user);
  await setMultiTeacherConfig(token);
  return {
    uid,
    email:user.email||"",
    name:user.displayName||user.email||"Admin GeoBoost",
    rulesetName,
    emailPasswordEnabled:true,
    anonymousStudentAuthEnabled:true,
  };
}
