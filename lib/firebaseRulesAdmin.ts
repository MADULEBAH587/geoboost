"use client";

import {
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
  signInWithPopup,
} from "firebase/auth";
import { firebaseClientConfig, getFirebaseServices } from "./firebase";

const PROJECT_ID = firebaseClientConfig.projectId;

async function getAdminOAuthToken() {
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase belum dikonfigurasi");
  await setPersistence(services.auth,browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  provider.addScope("https://www.googleapis.com/auth/firebase");
  provider.setCustomParameters({ prompt:"consent select_account" });
  const result = await signInWithPopup(services.auth,provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) throw new Error("Token pentadbiran Firebase tidak diterima");
  return credential.accessToken;
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
  const data=text?JSON.parse(text):{};
  if(!response.ok){
    const error=new Error(data?.error?.message||("Firebase Rules API gagal ("+response.status+")"));
    (error as any).status=response.status;
    throw error;
  }
  return data;
}

export async function deployGeoBoostFirestoreRules() {
  const token=await getAdminOAuthToken();
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
  return {rulesetName};
}
