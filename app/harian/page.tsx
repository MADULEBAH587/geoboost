"use client";

import { PracticeRunner } from "@/components/PracticeRunner";
import { questions } from "@/lib/questions";

export default function DailyMissionPage(){
  const today=new Date();
  const seed=Number(today.toISOString().slice(0,10).replaceAll("-",""));
  const bank=[...questions].sort((a,b)=>{
    const ha=(a.id.split("").reduce((s,c)=>s+c.charCodeAt(0),0)+seed)%997;
    const hb=(b.id.split("").reduce((s,c)=>s+c.charCodeAt(0),0)+seed)%997;
    return ha-hb;
  }).slice(0,40);
  return <PracticeRunner bank={bank} requested={5} title={"Misi Harian · "+today.toLocaleDateString("ms-MY")} eyebrow="MISI HARI INI" mode="Harian" returnHref="/murid/utama" mix={{easy:2,medium:2,kbat:1}}/>;
}
