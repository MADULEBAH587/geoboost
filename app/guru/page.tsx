"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { chapters } from "@/lib/data";
import { questions, type Difficulty, type QuestionType } from "@/lib/questions";
import {
  AttemptRecord, RegisteredStudent, LiveProgress, deleteRemoteAttempt, getLocalAttempts,
  getRemoteAttempts, getRemoteStudents, watchLiveProgress,
} from "@/lib/repository";
import {
  firebaseConfigured, linkCurrentTeacherPassword, reauthenticateTeacher, registerTeacherWithEmail,
  sendTeacherPasswordReset, signInTeacherWithEmail, signInTeacherWithGoogle,
  signOutFirebaseUser, watchFirebaseAuth,
} from "@/lib/firebase";
import {
  ClassRecord, ClassStudent, addRosterStudent, deleteAssignment, listClasses, normalizeStudentName,
  removeClass, removeRosterStudent, saveAssignment, saveClass, saveClassRoster,
  setClassArchived, setOpenChapters, transferClassOwner,
} from "@/lib/classroom";
import {
  CustomQuestion, archiveCustomQuestion, deleteCustomQuestion, getCustomQuestions, saveCustomQuestion,
} from "@/lib/customQuestions";
import {
  AuditEntry, TeacherProfile, getAuditLogs, getTeacherProfile, listTeacherProfiles,
  registerTeacherRequest, saveTeacherProfile, touchTeacherLastSeen, writeAudit,
} from "@/lib/teacherAdmin";
import { bootstrapGeoBoostAdmin, deployGeoBoostFirestoreRules, deployGeoBoostMultiTeacher } from "@/lib/firebaseRulesAdmin";
import { StudentPresence, watchStudentPresence } from "@/lib/studentPresence";

type Source = "local"|"firebase";
type TeacherSection = "dashboard"|"classes"|"students"|"assignments"|"live"|"interventions"|"analytics"|"reports"|"bank"|"teachers"|"settings";

const NAV:{id:TeacherSection;icon:string;label:string}[]=[
  {id:"dashboard",icon:"▦",label:"Ringkasan"},{id:"classes",icon:"🏫",label:"Kelas"},
  {id:"students",icon:"👥",label:"Murid"},{id:"assignments",icon:"📝",label:"Tugasan"},
  {id:"live",icon:"🟢",label:"Live Monitoring"},{id:"interventions",icon:"🎯",label:"Intervensi"},
  {id:"analytics",icon:"📊",label:"Analitik"},{id:"reports",icon:"🖨️",label:"Laporan"},
  {id:"bank",icon:"🗂️",label:"Bank Soalan"},{id:"teachers",icon:"🧑‍🏫",label:"Pengurusan Guru"},
  {id:"settings",icon:"⚙️",label:"Tetapan"},
];

function downloadText(filename:string,text:string,type="application/json"){
  const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
}
function downloadCsv(attempts:AttemptRecord[]){
  const esc=(v:unknown)=>'"'+String(v??"").replaceAll('"','""')+'"';
  const rows=[["Nama","Kelas","Bab/Mod","Markah","Jumlah","Peratus","Tempoh(s)","Subtopik lemah","Tarikh"],...attempts.map(a=>[
    a.studentName,a.className,a.chapter?"Bab "+a.chapter:(a.label||a.mode||"Campuran"),a.score,a.total,a.percentage,a.durationSeconds,a.wrongSubtopics.join(" | "),new Date(a.completedAt).toLocaleString("ms-MY")
  ])];
  downloadText("geoboost-laporan-"+new Date().toISOString().slice(0,10)+".csv","\ufeff"+rows.map(r=>r.map(esc).join(",")).join("\n"),"text/csv;charset=utf-8");
}
function pct(list:number[]){return list.length?Math.round(list.reduce((s,v)=>s+v,0)/list.length):0}

export default function TeacherPage(){
  const [activeSection,setActiveSection]=useState<TeacherSection>("dashboard");
  const [attempts,setAttempts]=useState<AttemptRecord[]>([]);
  const [registeredStudents,setRegisteredStudents]=useState<RegisteredStudent[]>([]);
  const [managedClasses,setManagedClasses]=useState<ClassRecord[]>([]);
  const [customQuestions,setCustomQuestions]=useState<CustomQuestion[]>([]);
  const [liveItems,setLiveItems]=useState<LiveProgress[]>([]);
  const [auditLogs,setAuditLogs]=useState<AuditEntry[]>([]);
  const [teacherProfiles,setTeacherProfiles]=useState<TeacherProfile[]>([]);
  const [teacherProfile,setTeacherProfile]=useState<TeacherProfile|null>(null);
  const [studentPresence,setStudentPresence]=useState<StudentPresence[]>([]);
  const [source,setSource]=useState<Source>("local");
  const [message,setMessage]=useState("");
  const [teacherEmail,setTeacherEmail]=useState("");
  const [teacherUid,setTeacherUid]=useState("");
  const [authReady,setAuthReady]=useState(false);
  const [authBusy,setAuthBusy]=useState(false);
  const [authUser,setAuthUser]=useState<{uid:string;email:string|null}|null>(null);
  const [authError,setAuthError]=useState("");
  const [authMode,setAuthMode]=useState<"login"|"register">("login");
  const [loginEmail,setLoginEmail]=useState("");
  const [loginPassword,setLoginPassword]=useState("");
  const [registerName,setRegisterName]=useState("");
  const [registerEmail,setRegisterEmail]=useState("");
  const [registerPassword,setRegisterPassword]=useState("");
  const [registerConfirm,setRegisterConfirm]=useState("");
  const [firebaseRulesReady,setFirebaseRulesReady]=useState<boolean|null>(null);
  const [deployingRules,setDeployingRules]=useState(false);
  const [adminTeacherUid,setAdminTeacherUid]=useState("");
  const [adminEditUntil,setAdminEditUntil]=useState(0);
  const [adminEditPassword,setAdminEditPassword]=useState("");
  const [adminNewPassword,setAdminNewPassword]=useState("");
  const [adminTransferTarget,setAdminTransferTarget]=useState<Record<string,string>>({});
  const [classFilter,setClassFilter]=useState("SEMUA");
  const [chapterFilter,setChapterFilter]=useState(0);
  const [newClassName,setNewClassName]=useState("");
  const [newClassCode,setNewClassCode]=useState("");
  const [newClassYear,setNewClassYear]=useState(String(new Date().getFullYear()));
  const [rosterClassCode,setRosterClassCode]=useState("");
  const [manualStudentName,setManualStudentName]=useState("");
  const [importing,setImporting]=useState(false);
  const [selectedStudentKey,setSelectedStudentKey]=useState("");
  const [assignmentClassCode,setAssignmentClassCode]=useState("");
  const [assignmentTitle,setAssignmentTitle]=useState("");
  const [assignmentChapter,setAssignmentChapter]=useState(1);
  const [assignmentCount,setAssignmentCount]=useState(20);
  const [assignmentDue,setAssignmentDue]=useState("");
  const [assignmentMax,setAssignmentMax]=useState(3);
  const [bankChapter,setBankChapter]=useState(1);
  const [bankSelection,setBankSelection]=useState<string[]>([]);
  const [qrData,setQrData]=useState<{code:string;name:string;url:string;image:string}|null>(null);
  const [teacherForm,setTeacherForm]=useState({uid:"",name:"",role:"guru" as "admin"|"guru"|"viewer"});
  const [questionForm,setQuestionForm]=useState({
    id:"",chapter:1,subtopic:"1.1",difficulty:"medium" as Difficulty,type:"mcq" as QuestionType,
    prompt:"",a:"",b:"",c:"",d:"",answer:"A",explanation:"",
  });

  const isAdmin=teacherProfile?.role==="admin";
  const adminEditActive=Boolean(adminTeacherUid&&Date.now()<adminEditUntil);
  const canEdit=teacherProfile?.role!=="viewer";
  const navItems=isAdmin?NAV:NAV.filter(item=>item.id!=="teachers");

  function patchClass(code:string,patch:Partial<ClassRecord>){
    setManagedClasses(current=>current.map(item=>item.code===code?{...item,...patch}:item));
  }
  async function log(action:string,detail:string){
    await writeAudit(action,detail,teacherEmail||teacherUid||"Guru");
    setAuditLogs(await getAuditLogs());
  }

  function clearTeacherData(){
    setTeacherProfile(null);setManagedClasses([]);setRegisteredStudents([]);setAttempts([]);
    setCustomQuestions([]);setAuditLogs([]);setTeacherProfiles([]);setStudentPresence([]);setLiveItems([]);setFirebaseRulesReady(null);setSource("local");
    setAdminTeacherUid("");setAdminEditUntil(0);setAdminEditPassword("");
  }

  async function loadTeacherData(user:{email:string|null;uid:string}){
    setTeacherEmail(user.email||"Guru");setTeacherUid(user.uid);setAuthError("");
    const profile=await getTeacherProfile(user.uid);
    setTeacherProfile(profile);

    if(!profile||!profile.active){
      setManagedClasses([]);setRegisteredStudents([]);setAttempts([]);setCustomQuestions([]);
      setAuditLogs([]);setTeacherProfiles([]);setStudentPresence([]);setLiveItems([]);setSource("local");
      const status=profile?.status||"pending";
      setMessage(!profile
        ?"Akaun Auth berjaya tetapi profil guru belum tersedia."
        :status==="pending"
          ?"Pendaftaran berjaya. Akaun sedang menunggu pengesahan admin."
          :status==="rejected"
            ?"Permohonan akaun guru ini telah ditolak oleh admin."
            :"Akses akaun guru ini telah dinyahaktifkan oleh admin.");
      return;
    }

    const classes=await listClasses(profile.role);
    const classCodes=classes.map(item=>item.code);
    const allowAll=profile.role==="admin";
    const [remote,students,custom,audit,profiles]=await Promise.all([
      getRemoteAttempts(classCodes,allowAll),getRemoteStudents(classCodes,allowAll),getCustomQuestions(true),getAuditLogs(),allowAll?listTeacherProfiles():Promise.resolve([]),
    ]);
    setManagedClasses(classes);setRegisteredStudents(students);setAttempts(remote);
    setCustomQuestions(custom);setAuditLogs(audit);setTeacherProfiles(profiles);setSource("firebase");setFirebaseRulesReady(true);
    void touchTeacherLastSeen(user.uid);
    const first=classes.find(c=>!c.archived)?.code||classes[0]?.code||"";
    setRosterClassCode(current=>current||first);setAssignmentClassCode(current=>current||first);
    setMessage("Berjaya memuat "+remote.length+" rekod, "+students.length+" profil murid dan "+classes.length+" kelas.");
  }

  useEffect(()=>{
    if(!firebaseConfigured){setAuthReady(true);return;}
    const stop=watchFirebaseAuth(user=>{
      setAuthReady(false);setAuthError("");
      if(user&&!user.isAnonymous){
        setAuthUser({uid:user.uid,email:user.email});
        loadTeacherData(user).catch((error:any)=>{
          console.error(error);clearTeacherData();setTeacherEmail(user.email||"Guru");setTeacherUid(user.uid);
          setAuthError("Akaun guru dikesan tetapi data pusat gagal dimuat."+(error?.code?" ("+error.code+")":""));
        }).finally(()=>setAuthReady(true));
      }else{
        setAuthUser(null);setTeacherEmail("");setTeacherUid("");clearTeacherData();setMessage("");setAuthReady(true);
      }
    });
    return stop;
  },[]);

  useEffect(()=>{
    if(source!=="firebase"||!teacherProfile)return;
    const classCodes=managedClasses.map(item=>item.code);
    const stopLive=watchLiveProgress(setLiveItems,classCodes,teacherProfile.role==="admin");
    const stopPresence=watchStudentPresence(setStudentPresence,classCodes,teacherProfile.role==="admin");
    return ()=>{stopLive();stopPresence()};
  },[source,teacherProfile,managedClasses]);

  async function connectTeacher(){
    if(!loginEmail.trim()||!loginPassword)return;
    setAuthBusy(true);setAuthError("");setMessage("");
    try{
      await signInTeacherWithEmail(loginEmail,loginPassword);
    }catch(error:any){
      console.error(error);
      const code=String(error?.code||"");
      setAuthError(code.includes("invalid-credential")||code.includes("wrong-password")||code.includes("user-not-found")
        ?"Email atau kata laluan tidak betul."
        :code.includes("operation-not-allowed")
          ?"Login Email + Password belum diaktifkan pada Firebase. Admin perlu aktifkan Sistem Multi-Guru sekali."
          :"Log masuk gagal. "+String(error?.message||"Cuba semula."));
      setAuthReady(true);
    }finally{setAuthBusy(false)}
  }

  async function registerTeacher(){
    if(!registerName.trim()||!registerEmail.trim()||registerPassword.length<6)return;
    if(registerPassword!==registerConfirm){setAuthError("Pengesahan kata laluan tidak sepadan.");return}
    setAuthBusy(true);setAuthError("");setMessage("");
    try{
      const user=await registerTeacherWithEmail(registerEmail,registerPassword,registerName);
      await registerTeacherRequest({uid:user.uid,name:registerName,email:registerEmail});
      setAuthUser({uid:user.uid,email:user.email});
      await loadTeacherData(user);
      setMessage("Pendaftaran berjaya. Tunggu admin meluluskan akaun anda.");
    }catch(error:any){
      console.error(error);
      const code=String(error?.code||"");
      setAuthError(code.includes("email-already-in-use")
        ?"Email ini sudah mempunyai akaun. Gunakan Log Masuk atau Lupa Password."
        :code.includes("operation-not-allowed")
          ?"Pendaftaran Email + Password belum diaktifkan. Admin perlu aktifkan Sistem Multi-Guru sekali."
          :"Pendaftaran gagal. "+String(error?.message||"Cuba semula."));
      setAuthReady(true);
    }finally{setAuthBusy(false)}
  }

  async function resetTeacherPassword(){
    if(!loginEmail.trim()){setAuthError("Masukkan email guru dahulu.");return}
    setAuthBusy(true);setAuthError("");
    try{await sendTeacherPasswordReset(loginEmail);setMessage("Link reset kata laluan telah dihantar ke "+loginEmail+".");}
    catch(error:any){setAuthError("Reset kata laluan gagal. "+String(error?.message||""))}
    finally{setAuthBusy(false)}
  }

  async function connectLegacyAdmin(){
    setAuthBusy(true);setAuthError("");setMessage("");
    try{
      const user=await signInTeacherWithGoogle();
      if(!user){setAuthError("Migrasi admin Google tidak selesai.");setAuthReady(true);}
    }catch(error:any){
      setAuthError("Migrasi admin Google gagal. "+String(error?.message||""));
      setAuthReady(true);
    }finally{setAuthBusy(false)}
  }
  async function disconnectTeacher(){
    setAuthReady(false);
    await signOutFirebaseUser();
    setAuthUser(null);setTeacherEmail("");setTeacherUid("");clearTeacherData();setMessage("");setAuthReady(true);
  }

  async function addClass(){
    if(!canEdit||!newClassName.trim()||!newClassCode.trim())return;
    try{
      const saved=await saveClass({name:newClassName,code:newClassCode,academicYear:newClassYear});
      setManagedClasses(current=>[...current.filter(x=>x.code!==saved.code),saved].sort((a,b)=>a.name.localeCompare(b.name)));
      setRosterClassCode(c=>c||saved.code);setAssignmentClassCode(c=>c||saved.code);
      await log("KELAS_TAMBAH",saved.name+" ("+saved.code+")");
      setNewClassName("");setNewClassCode("");setMessage("Kelas berjaya disimpan.");
    }catch(e){console.error(e);setMessage("Kelas tidak dapat disimpan.")}
  }
  async function archiveClass(code:string,archived:boolean){
    if(!canEdit)return;
    try{await setClassArchived(code,archived);patchClass(code,{archived,active:!archived});await log(archived?"KELAS_ARKIB":"KELAS_AKTIF",code);setMessage(archived?"Kelas diarkib.":"Kelas diaktifkan semula.");}catch{setMessage("Status kelas tidak dapat dikemas kini.")}
  }
  async function deleteClass(code:string){
    if(!canEdit||!confirm("Padam kelas "+code+"? Gunakan Arkib jika data lama masih diperlukan."))return;
    try{await removeClass(code);setManagedClasses(c=>c.filter(x=>x.code!==code));await log("KELAS_PADAM",code);setMessage("Kelas dipadam.");}catch{setMessage("Kelas tidak dapat dipadam.")}
  }
  async function toggleChapter(code:string,chapter:number){
    if(!canEdit)return;
    const item=managedClasses.find(c=>c.code===code);if(!item)return;
    const next=item.openChapters.includes(chapter)?item.openChapters.filter(id=>id!==chapter):[...item.openChapters,chapter].sort((a,b)=>a-b);
    try{patchClass(code,{openChapters:await setOpenChapters(code,next)});await log("AKSES_BAB",code+" Bab "+chapter);setMessage("Akses bab dikemas kini.");}catch{setMessage("Akses bab gagal dikemas kini.")}
  }
  async function showQr(item:ClassRecord){
    try{
      const url=window.location.origin+"/murid?class="+encodeURIComponent(item.code);
      const {toDataURL}=await import("qrcode");
      const image=await toDataURL(url,{width:420,margin:2});
      setQrData({code:item.code,name:item.name,url,image});
    }catch{setMessage("QR tidak dapat dijana.")}
  }
  async function copyStudentLink(code:string){
    const link=window.location.origin+"/murid?class="+encodeURIComponent(code);await navigator.clipboard.writeText(link);setMessage("Link kelas "+code+" disalin.");
  }

  async function updateRosterState(code:string,studentRoster:ClassStudent[]){
    patchClass(code,{studentRoster,studentNames:studentRoster.map(student=>student.name)});
  }
  async function addStudentToRoster(name=manualStudentName){
    if(!canEdit||!rosterClassCode||!name.trim())return;
    try{
      const roster=await addRosterStudent(rosterClassCode,name);
      await updateRosterState(rosterClassCode,roster);setManualStudentName("");
      await log("MURID_TAMBAH",normalizeStudentName(name)+" · "+rosterClassCode);setMessage("Murid ditambah ke senarai kelas.");
    }catch{setMessage("Nama murid tidak dapat ditambah.")}
  }
  async function removeStudentFromRoster(student:ClassStudent){
    if(!canEdit||!confirm("Buang "+student.name+" daripada senarai login?"))return;
    try{
      const roster=await removeRosterStudent(rosterClassCode,student.id);
      await updateRosterState(rosterClassCode,roster);
      await log("MURID_BUANG",student.name+" · "+rosterClassCode);
    }catch{setMessage("Nama murid tidak dapat dibuang.")}
  }
  async function importStudents(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];event.target.value="";if(!file||!rosterClassCode||!canEdit)return;
    setImporting(true);
    try{
      const XLSX=await import("xlsx");const data=await file.arrayBuffer();const wb=XLSX.read(data,{type:"array"});const sheet=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json<any[]>(sheet,{header:1,defval:""});const first=rows.findIndex(row=>row.some(cell=>String(cell).trim()));if(first<0)throw new Error("kosong");
      const header=rows[first].map(cell=>String(cell).trim().toLowerCase());let col=header.findIndex(cell=>["nama","nama murid","nama pelajar","name","student","student name"].includes(cell));let start=first;
      if(col>=0)start=first+1;else col=0;
      const imported=rows.slice(start).map(row=>normalizeStudentName(String(row[col]||""))).filter(name=>name.length>=2);
      const current=[...(managedClasses.find(x=>x.code===rosterClassCode)?.studentNames||[])];
      const baseline=new Map<string,number>();current.forEach(name=>baseline.set(name,(baseline.get(name)||0)+1));
      const seen=new Map<string,number>();
      imported.forEach(name=>{
        const n=(seen.get(name)||0)+1;seen.set(name,n);
        if(n>(baseline.get(name)||0)){current.push(name);baseline.set(name,(baseline.get(name)||0)+1)}
      });
      const saved=await saveClassRoster(rosterClassCode,current);
      await updateRosterState(rosterClassCode,saved);await log("MURID_IMPORT",imported.length+" nama · "+rosterClassCode);setMessage("Import selesai: "+saved.length+" rekod murid dengan ID unik.");
    }catch(e){console.error(e);setMessage("Import gagal. Gunakan Excel/CSV dengan kolum Nama.");}finally{setImporting(false)}
  }

  async function createAssignment(extra?:{questionIds?:string[];targetStudentIds?:string[];title?:string;chapter?:number;count?:number}){
    if(!canEdit||!assignmentClassCode)return;
    const title=extra?.title||assignmentTitle;if(!title.trim())return;
    try{
      const ids=extra?.questionIds||[];
      const next=await saveAssignment(assignmentClassCode,{
        title,chapter:extra?.chapter||assignmentChapter,questionCount:extra?.count||Math.max(1,ids.length||assignmentCount),
        dueDate:assignmentDue,active:true,questionIds:ids,maxAttempts:assignmentMax,targetStudentIds:extra?.targetStudentIds||[],
      });
      patchClass(assignmentClassCode,{assignments:next});await log("TUGASAN_TAMBAH",title+" · "+assignmentClassCode);
      setAssignmentTitle("");setAssignmentDue("");setMessage("Tugasan diterbitkan.");
    }catch(e){console.error(e);setMessage("Tugasan tidak dapat disimpan.")}
  }
  async function removeAssignmentItem(classCode:string,id:string){
    if(!canEdit||!confirm("Padam tugasan ini?"))return;
    try{patchClass(classCode,{assignments:await deleteAssignment(classCode,id)});await log("TUGASAN_PADAM",id);}catch{setMessage("Tugasan gagal dipadam.")}
  }
  async function toggleAssignmentActive(classCode:string,id:string){
    if(!canEdit)return;const item=managedClasses.find(c=>c.code===classCode)?.assignments.find(a=>a.id===id);if(!item)return;
    try{patchClass(classCode,{assignments:await saveAssignment(classCode,{...item,active:!item.active})});await log("TUGASAN_STATUS",item.title+" -> "+(!item.active));}catch{setMessage("Status tugasan gagal.")}
  }

  async function resetAttempt(id:string){
    if(!canEdit||!confirm("Reset rekod percubaan ini daripada data pusat?"))return;
    try{await deleteRemoteAttempt(id);setAttempts(a=>a.filter(x=>x.id!==id));await log("PERCUBAAN_RESET",id);setMessage("Rekod pusat dipadam. Murid boleh membuat percubaan baharu.");}catch{setMessage("Rekod tidak dapat direset.")}
  }

  async function saveQuestion(){
    if(!canEdit)return;
    const opts=[questionForm.a,questionForm.b,questionForm.c,questionForm.d].map(x=>x.trim()).filter(Boolean);
    const answer=({A:questionForm.a,B:questionForm.b,C:questionForm.c,D:questionForm.d} as Record<string,string>)[questionForm.answer]?.trim()||"";
    try{
      await saveCustomQuestion({id:questionForm.id||undefined,chapter:questionForm.chapter,subtopic:questionForm.subtopic,difficulty:questionForm.difficulty,type:questionForm.type,prompt:questionForm.prompt,options:opts,answer,explanation:questionForm.explanation,custom:true,active:true});
      setCustomQuestions(await getCustomQuestions(true));setQuestionForm({id:"",chapter:bankChapter,subtopic:bankChapter+".1",difficulty:"medium",type:"mcq",prompt:"",a:"",b:"",c:"",d:"",answer:"A",explanation:""});
      await log("SOALAN_SIMPAN",questionForm.id||"Soalan custom baharu");setMessage("Soalan custom disimpan.");
    }catch(e:any){setMessage(e?.message||"Soalan gagal disimpan.")}
  }
  function editQuestion(q:CustomQuestion){
    setQuestionForm({id:q.id,chapter:q.chapter,subtopic:q.subtopic,difficulty:q.difficulty,type:q.type,prompt:q.prompt,a:q.options[0]||"",b:q.options[1]||"",c:q.options[2]||"",d:q.options[3]||"",answer:["A","B","C","D"][Math.max(0,q.options.indexOf(q.answer))]||"A",explanation:q.explanation});
  }
  async function archiveQuestion(id:string,active:boolean){
    if(!canEdit)return;await archiveCustomQuestion(id,active);setCustomQuestions(await getCustomQuestions(true));await log("SOALAN_STATUS",id+" -> "+active);
  }
  async function removeQuestion(id:string){
    if(!canEdit||!confirm("Padam soalan custom "+id+"?"))return;await deleteCustomQuestion(id);setCustomQuestions(await getCustomQuestions(true));setBankSelection(s=>s.filter(x=>x!==id));await log("SOALAN_PADAM",id);
  }
  function makeWorksheet(){
    if(!bankSelection.length){setMessage("Pilih sekurang-kurangnya satu soalan.");return}
    window.open("/guru/worksheet?ids="+encodeURIComponent(bankSelection.join(","))+"&title="+encodeURIComponent("Latihan Geografi"),"_blank");
  }

  async function createIntervention(student:RegisteredStudent){
    if(!canEdit)return;
    const own=attempts.filter(a=>a.studentId===student.localStudentId||(a.studentName===student.name&&a.className===student.className));
    const groups=new Map<number,number[]>();own.filter(a=>a.chapter>0).forEach(a=>groups.set(a.chapter,[...(groups.get(a.chapter)||[]),a.percentage]));
    const weak=[...groups.entries()].sort((a,b)=>pct(a[1])-pct(b[1]))[0]?.[0]||1;
    const cls=managedClasses.find(c=>c.code===student.classCode);if(!cls)return;
    setAssignmentClassCode(cls.code);
    try{
      const due=new Date();due.setDate(due.getDate()+7);
      const next=await saveAssignment(cls.code,{title:"Pemulihan · "+student.name,chapter:weak,questionCount:10,dueDate:due.toISOString().slice(0,10),active:true,questionIds:[],maxAttempts:3,targetStudentIds:[student.localStudentId]});
      patchClass(cls.code,{assignments:next});await log("INTERVENSI_ASSIGN",student.name+" · Bab "+weak);setMessage("Pemulihan Bab "+weak+" ditetapkan kepada "+student.name+".");
    }catch{setMessage("Intervensi gagal ditetapkan.")}
  }

  async function bootstrapFirstAdmin(){
    if(deployingRules)return;
    setDeployingRules(true);setAuthError("");setMessage("Menyediakan Admin GeoBoost dan Firebase P1...");
    try{
      const result=await bootstrapGeoBoostAdmin();
      const user={uid:result.uid,email:result.email||null};
      setAuthUser(user);setTeacherUid(result.uid);setTeacherEmail(result.email||"Admin GeoBoost");
      setFirebaseRulesReady(true);
      setMessage("Admin dan Firestore Rules P1 berjaya diaktifkan. Memuat Control Center...");
      await loadTeacherData(user);
    }catch(error:any){
      console.error(error);
      setFirebaseRulesReady(false);
      setAuthError("Aktivasi admin belum selesai: "+String(error?.message||"akaun Google ini memerlukan kebenaran pemilik projek Firebase."));
    }finally{setDeployingRules(false)}
  }

  async function activateFirebaseP1(){
    if(!isAdmin||deployingRules)return;
    setDeployingRules(true);setMessage("Menerbitkan semula Firestore Rules...");
    try{
      const result=await deployGeoBoostFirestoreRules();
      setFirebaseRulesReady(true);
      await log("FIREBASE_RULES",result.rulesetName);
      setMessage("Firestore Rules berjaya diterbitkan.");
      if(authUser)await loadTeacherData(authUser);
    }catch(error:any){
      console.error(error);setFirebaseRulesReady(false);
      setMessage("Rules belum dapat diterbitkan: "+String(error?.message||"kebenaran Google/Firebase diperlukan."));
    }finally{setDeployingRules(false)}
  }

  async function activateMultiTeacher(){
    if(!isAdmin||deployingRules)return;
    setDeployingRules(true);setMessage("Mengaktifkan Email + Password, multi-guru dan Firestore Rules...");
    try{
      const result=await deployGeoBoostMultiTeacher();
      setFirebaseRulesReady(true);
      await log("MULTI_GURU_AKTIF",result.rulesetName);
      setMessage("Sistem Multi-Guru aktif. Pendaftaran Email + Password dan Rules baharu telah diterbitkan.");
      if(authUser)await loadTeacherData(authUser);
    }catch(error:any){
      console.error(error);setFirebaseRulesReady(false);
      setMessage("Aktivasi Multi-Guru belum selesai: "+String(error?.message||"kebenaran pemilik projek Firebase diperlukan."));
    }finally{setDeployingRules(false)}
  }

  async function setAdminPassword(){
    if(!isAdmin||adminNewPassword.length<6){setMessage("Kata laluan admin mesti sekurang-kurangnya 6 aksara.");return}
    try{
      await linkCurrentTeacherPassword(adminNewPassword);
      setAdminNewPassword("");
      await log("ADMIN_PASSWORD","Email + Password dipautkan pada akaun admin.");
      setMessage("Kata laluan admin siap. Selepas ini Bos boleh login menggunakan email + password.");
    }catch(error:any){
      setMessage("Kata laluan belum dapat ditetapkan: "+String(error?.message||""));
    }
  }

  async function beginAdminEdit(){
    if(!isAdmin||!adminTeacherUid||!adminEditPassword)return;
    try{
      await reauthenticateTeacher(adminEditPassword);
      setAdminEditUntil(Date.now()+15*60*1000);setAdminEditPassword("");
      const target=teacherProfiles.find(t=>t.uid===adminTeacherUid);
      await log("ADMIN_EDIT_MULA",(target?.name||adminTeacherUid)+" · 15 minit");
      setMessage("Mode Edit Admin aktif selama 15 minit untuk "+(target?.name||"guru dipilih")+".");
    }catch(error:any){
      setMessage("Pengesahan admin gagal. Semak kata laluan.");
    }
  }

  function leaveAdminEdit(){
    setAdminEditUntil(0);setAdminEditPassword("");
    setMessage("Mode Edit Admin ditutup. Kembali ke Mode Lihat.");
  }

  async function updateTeacherAccess(target:TeacherProfile,patch:Partial<TeacherProfile>,action:string){
    if(!isAdmin||adminTeacherUid!==target.uid||!adminEditActive||Date.now()>=adminEditUntil){
      setMessage("Aktifkan Mode Edit dan sahkan kata laluan admin dahulu.");return;
    }
    const next={...target,...patch};
    try{
      await saveTeacherProfile(next);
      setTeacherProfiles(await listTeacherProfiles());
      await log(action,target.name+" · "+String(next.status||"active")+" · "+next.role);
      setMessage("Akaun "+target.name+" berjaya dikemas kini.");
    }catch(error:any){setMessage("Akaun guru gagal dikemas kini: "+String(error?.message||""))}
  }

  async function moveClassOwner(classCode:string,newOwnerUid:string){
    if(!isAdmin||!adminTeacherUid||!adminEditActive||Date.now()>=adminEditUntil){
      setMessage("Aktifkan Mode Edit guru dahulu.");return;
    }
    const target=teacherProfiles.find(t=>t.uid===newOwnerUid);
    if(!target||target.status!=="active"){setMessage("Pilih guru aktif sebagai pemilik baharu.");return}
    try{
      await transferClassOwner(classCode,newOwnerUid);
      patchClass(classCode,{ownerTeacherId:newOwnerUid});
      await log("KELAS_TUKAR_GURU",classCode+" → "+target.name);
      setMessage("Kelas "+classCode+" kini di bawah "+target.name+".");
    }catch(error:any){setMessage("Pemilik kelas gagal ditukar: "+String(error?.message||""))}
  }

  function backup(){
    const payload={exportedAt:new Date().toISOString(),version:"2.0",classes:managedClasses,students:registeredStudents,attempts,customQuestions,auditLogs};
    downloadText("geoboost-backup-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify(payload,null,2));
  }

  const activeClasses=managedClasses.filter(c=>!c.archived);
  const classes=useMemo(()=>["SEMUA",...Array.from(new Set([...attempts.map(a=>a.className),...activeClasses.map(c=>c.name)].filter(Boolean))).sort()],[attempts,managedClasses]);
  const filtered=useMemo(()=>attempts.filter(a=>(classFilter==="SEMUA"||a.className===classFilter)&&(!chapterFilter||a.chapter===chapterFilter)),[attempts,classFilter,chapterFilter]);
  const stats=useMemo(()=>{
    const avg=filtered.length?Math.round(filtered.reduce((s,a)=>s+a.percentage,0)/filtered.length):0;
    const students=new Set(filtered.map(a=>a.studentId||a.studentName+"|"+a.className)).size;
    const passed=filtered.filter(a=>a.percentage>=60).length;
    return{avg,students,completed:filtered.length,passRate:filtered.length?Math.round(passed/filtered.length*100):0};
  },[filtered]);
  const weak=useMemo(()=>{
    const counts=new Map<string,number>();filtered.forEach(a=>a.wrongSubtopics.forEach(s=>counts.set(s,(counts.get(s)||0)+1)));
    return[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
  },[filtered]);
  const missedItems=useMemo(()=>{
    const counts=new Map<string,{wrong:number,total:number,unsure:number}>();
    filtered.forEach(a=>a.responses?.forEach(r=>{const cur=counts.get(r.questionId)||{wrong:0,total:0,unsure:0};cur.total++;if(!r.correct)cur.wrong++;if(r.unsure)cur.unsure++;counts.set(r.questionId,cur)}));
    return[...counts.entries()].map(([id,v])=>({id,...v,rate:v.total?Math.round(v.wrong/v.total*100):0})).sort((a,b)=>b.rate-a.rate).slice(0,12);
  },[filtered]);
  const classComparison=useMemo(()=>activeClasses.map(c=>{
    const list=attempts.filter(a=>a.className===c.name||a.classCode===c.code);
    return{name:c.name,code:c.code,attempts:list.length,students:new Set(list.map(a=>a.studentId)).size,avg:pct(list.map(a=>a.percentage)),pass:list.length?Math.round(list.filter(a=>a.percentage>=60).length/list.length*100):0};
  }).sort((a,b)=>b.avg-a.avg),[attempts,managedClasses]);

  const rosterClass=managedClasses.find(c=>c.code===rosterClassCode)||null;
  const selfRegistered=registeredStudents.filter(s=>s.classCode===rosterClassCode);
  const selfAddedNotRoster=selfRegistered.filter(student=>!rosterClass?.studentRoster.some(item=>item.id===student.localStudentId));
  const studentDirectory=useMemo(()=>{
    const map=new Map<string,RegisteredStudent>();registeredStudents.forEach(s=>{const key=s.localStudentId||s.name+"|"+s.classCode;if(!map.has(key))map.set(key,s)});
    return[...map.entries()].sort((a,b)=>a[1].name.localeCompare(b[1].name,"ms"));
  },[registeredStudents]);
  const selectedStudent=studentDirectory.find(([key])=>key===selectedStudentKey)?.[1]||null;
  const selectedStudentAttempts=selectedStudent?attempts.filter(a=>(selectedStudent.localStudentId&&a.studentId===selectedStudent.localStudentId)||(a.studentName===selectedStudent.name&&a.className===selectedStudent.className)):[];
  const assignmentClass=managedClasses.find(c=>c.code===assignmentClassCode)||null;

  const interventionRows=useMemo(()=>registeredStudents.map(student=>{
    const own=attempts.filter(a=>a.studentId===student.localStudentId||(a.studentName===student.name&&a.className===student.className));
    const average=pct(own.map(a=>a.percentage));
    const cls=managedClasses.find(c=>c.code===student.classCode);
    const missing=(cls?.assignments||[]).filter(t=>t.active&&(!t.targetStudentIds?.length||t.targetStudentIds.includes(student.localStudentId))&&!own.some(a=>a.mode==="tugasan:"+t.id)).length;
    const topicCounts=new Map<string,number>();own.forEach(a=>a.wrongSubtopics.forEach(t=>topicCounts.set(t,(topicCounts.get(t)||0)+1)));
    const weakTopic=[...topicCounts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||"-";
    return{student,average,attempts:own.length,missing,weakTopic,needs:(own.length>0&&average<60)||missing>0};
  }).filter(x=>x.needs).sort((a,b)=>b.missing-a.missing||a.average-b.average),[registeredStudents,attempts,managedClasses]);

  const now=Date.now();
  const currentLive=liveItems.filter(x=>now-x.updatedAt<30*60*1000);
  const bankItems=[...questions,...customQuestions.filter(q=>q.active)].filter(q=>q.chapter===bankChapter);
  const assignmentRows=(assignmentClass?.assignments||[]).map(item=>{
    const roster=assignmentClass?.studentRoster||[];
    const related=attempts.filter(a=>(a.classCode===assignmentClass?.code||a.className===assignmentClass?.name)&&a.mode==="tugasan:"+item.id);
    const completedIds=new Set(related.map(a=>a.studentId));
    const completed=roster.filter(student=>completedIds.has(student.id)).length;
    const avg=pct(related.map(a=>a.percentage));
    return{item,completed,total:roster.length,avg,missing:roster.filter(student=>!completedIds.has(student.id)).map(student=>student.name)};
  });

  const filterBar=<div className="filter-bar"><label>Kelas<select value={classFilter} onChange={e=>setClassFilter(e.target.value)}>{classes.map(c=><option key={c}>{c}</option>)}</select></label><label>Bab<select value={chapterFilter} onChange={e=>setChapterFilter(Number(e.target.value))}><option value={0}>Semua Bab</option>{chapters.map(c=><option key={c.id} value={c.id}>Bab {c.id}</option>)}</select></label></div>;

  const gateBrand=<div className="mini-brand"><span className="brand-mark">G</span><span><b>GEOBOOST</b><small>PANEL GURU</small></span></div>;

  if(!firebaseConfigured){
    return <main className="auth-shell"><section className="auth-card">{gateBrand}<span className="eyebrow dark">PANEL GURU</span><h1>Konfigurasi diperlukan</h1><p>Sambungan Firebase untuk log masuk guru belum tersedia. Semak konfigurasi projek sebelum menggunakan Control Center.</p><a className="launch-button active full center" href="/">← Paparan utama</a></section></main>;
  }

  if(!authReady){
    return <main className="auth-shell"><section className="auth-card">{gateBrand}<span className="eyebrow dark">KESELAMATAN</span><h1>Menyemak sesi guru…</h1><p>GeoBoost sedang mengesahkan akaun dan akses guru.</p></section></main>;
  }

  if(!authUser){
    return <main className="auth-shell"><section className="auth-card teacher-auth-card">
      {gateBrand}
      <span className="eyebrow dark">{authMode==="login"?"AKSES GURU":"DAFTAR GURU"}</span>
      <h1>{authMode==="login"?"Log masuk guru":"Daftar akaun guru"}</h1>
      <p>{authMode==="login"
        ?"Masuk menggunakan email dan kata laluan GeoBoost."
        :"Guru boleh daftar sendiri. Akaun hanya boleh digunakan selepas diluluskan oleh admin."}</p>
      {authError?<div className="teacher-message">{authError}</div>:null}
      {message?<div className="teacher-message">{message}</div>:null}
      {authMode==="login"?<form className="student-form" onSubmit={e=>{e.preventDefault();void connectTeacher()}}>
        <label>Email<input type="email" autoComplete="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="nama@email.com" required/></label>
        <label>Kata laluan<input type="password" autoComplete="current-password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="••••••••" required/></label>
        <button className="primary full" type="submit" disabled={authBusy||!loginEmail.trim()||!loginPassword}>{authBusy?"Mengesahkan...":"Masuk →"}</button>
        <button className="auth-text-button" type="button" onClick={resetTeacherPassword} disabled={authBusy}>Lupa kata laluan?</button>
      </form>:<form className="student-form" onSubmit={e=>{e.preventDefault();void registerTeacher()}}>
        <label>Nama penuh<input value={registerName} onChange={e=>setRegisterName(e.target.value)} placeholder="Contoh: Cikgu Benno" required/></label>
        <label>Email<input type="email" autoComplete="email" value={registerEmail} onChange={e=>setRegisterEmail(e.target.value)} placeholder="nama@email.com" required/></label>
        <label>Kata laluan<input type="password" autoComplete="new-password" minLength={6} value={registerPassword} onChange={e=>setRegisterPassword(e.target.value)} placeholder="Minimum 6 aksara" required/></label>
        <label>Sahkan kata laluan<input type="password" autoComplete="new-password" minLength={6} value={registerConfirm} onChange={e=>setRegisterConfirm(e.target.value)} placeholder="Taip semula kata laluan" required/></label>
        <button className="primary full" type="submit" disabled={authBusy||registerPassword.length<6}>{authBusy?"Mendaftar...":"Daftar & Hantar Untuk Kelulusan →"}</button>
      </form>}
      <div className="teacher-auth-switch"><span>{authMode==="login"?"Belum ada akaun?":"Sudah ada akaun?"}</span><button onClick={()=>{setAuthMode(authMode==="login"?"register":"login");setAuthError("");setMessage("")}}>{authMode==="login"?"Daftar guru":"Log masuk"}</button></div>
      <small className="auth-note">Akaun guru baharu berstatus <b>PENDING</b> sehingga diluluskan admin. Guru yang telah diluluskan boleh mencipta dan mengurus kelas sendiri.</small>
      <button className="legacy-admin-link" type="button" onClick={connectLegacyAdmin} disabled={authBusy}>Admin lama Google? Migrasi sekali sahaja</button>
      <a className="launch-button full center" href="/">← Paparan utama</a>
    </section></main>;
  }

  if(!teacherProfile||!teacherProfile.active){
    const status=teacherProfile?.status||"pending";
    const title=!teacherProfile?"Profil belum tersedia":status==="pending"?"Menunggu pengesahan admin":status==="rejected"?"Permohonan ditolak":"Akses dinyahaktifkan";
    return <main className="auth-shell"><section className="auth-card">
      {gateBrand}<span className="eyebrow dark">STATUS AKAUN GURU</span><h1>{title}</h1>
      <p>{authError||message||(!teacherProfile
        ?"Profil GeoBoost belum dijumpai untuk akaun ini."
        :status==="pending"
          ?"Pendaftaran telah diterima. Admin akan melihat permohonan anda di Pengurusan Guru."
          :status==="rejected"
            ?"Permohonan ini telah ditolak. Hubungi admin jika perlu semakan semula."
            :"Akaun ini dinyahaktifkan sementara oleh admin.")}</p>
      <div className="teacher-bootstrap"><div><small>AKAUN</small><b>{teacherProfile?.name||"Guru"}</b><span>{teacherEmail||authUser.email||""}</span></div><span className={"teacher-status "+status}>{status.toUpperCase()}</span></div>
      {!teacherProfile?<button className="legacy-admin-link full" onClick={bootstrapFirstAdmin} disabled={deployingRules}>{deployingRules?"Menyediakan admin...":"Pemilik projek? Pulihkan Admin GeoBoost"}</button>:null}
      <small className="auth-note">Selepas admin meluluskan akaun, log masuk semula atau refresh halaman ini untuk membuka Control Center.</small>
      <button className="launch-button full" onClick={disconnectTeacher}>Log keluar / guna akaun lain</button>
    </section></main>;
  }

  return <main className="teacher-app">
    <aside className="teacher-sidebar">
      <a className="teacher-side-brand" href="/"><span className="brand-mark">G</span><span><b>GEOBOOST</b><small>CONTROL CENTER</small></span></a>
      <nav>{navItems.map(item=><button key={item.id} className={activeSection===item.id?"active":""} onClick={()=>setActiveSection(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
      <div className="teacher-side-account"><span className={"source-pill "+source}>{source==="firebase"?"☁️ Firebase":"📱 Peranti"}</span><small>{teacherEmail||"Belum login"}{teacherProfile?" · "+teacherProfile.role.toUpperCase():""}</small>{firebaseConfigured?<button onClick={disconnectTeacher}>Log keluar</button>:null}<a href="/">← Paparan utama</a></div>
    </aside>

    <div className="teacher-main">
      <header className="teacher-mobile-nav"><a className="brand" href="/"><span className="brand-mark">G</span><span><b>GEOBOOST</b><small>GURU</small></span></a><select value={activeSection} onChange={e=>setActiveSection(e.target.value as TeacherSection)}>{navItems.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></header>
      <section className="teacher-head"><span className="eyebrow dark">PANEL GURU · v2.0</span><h1>{navItems.find(x=>x.id===activeSection)?.label||"GeoBoost Guru"}</h1><p>Control Center GeoBoost untuk kelas, tugasan, live monitoring, intervensi, analitik, laporan dan bank soalan.</p>{!canEdit&&source==="firebase"?<div className="teacher-message">👁️ Role VIEWER aktif — paparan sahaja, fungsi edit disekat pada UI.</div>:null}{message?<div className="teacher-message">{message}</div>:null}{teacherUid&&source!=="firebase"?<div className="teacher-bootstrap"><div><small>UID UNTUK AKTIFKAN ADMIN</small><code>{teacherUid}</code><span>{teacherEmail}</span></div><button onClick={async()=>{await navigator.clipboard.writeText(teacherUid);setMessage("UID disalin.")}}>Salin UID</button></div>:null}</section>

      <section className="teacher-content">
        {activeSection==="dashboard"?<>
          <div className="teacher-stats"><div><small>Murid</small><b>{stats.students}</b></div><div><small>Latihan selesai</small><b>{stats.completed}</b></div><div><small>Purata</small><b>{stats.avg}%</b></div><div><small>Kadar ≥60%</small><b>{stats.passRate}%</b></div><div><small>Live sekarang</small><b>{currentLive.filter(x=>x.status==="active").length}</b></div></div>
          <div className="teacher-grid"><section className="panel"><div className="panel-title"><div><small>TERKINI</small><h2>Percubaan murid</h2></div><span>{attempts.length}</span></div>{attempts.length?<div className="attempt-table">{attempts.slice(0,12).map(a=><div className="attempt-row" key={a.id}><div><strong>{a.studentName}</strong><small>{a.className} · {a.chapter?"Bab "+a.chapter:(a.label||a.mode)}</small></div><b>{a.percentage}%</b><span>{new Date(a.completedAt).toLocaleDateString("ms-MY")}</span></div>)}</div>:<div className="panel-empty">Belum ada rekod.</div>}</section><section className="panel"><div className="panel-title"><div><small>PERLU TINDAKAN</small><h2>Intervensi</h2></div><span>{interventionRows.length}</span></div>{interventionRows.slice(0,6).map(x=><div className="intervention-mini" key={x.student.uid}><div><b>{x.student.name}</b><small>{x.student.className} · {x.weakTopic}</small></div><span>{x.average}%</span></div>)}</section></div>
        </>:null}

        {activeSection==="classes"?<section className="panel class-manager">
          <div className="panel-title"><div><small>PENGURUSAN KELAS</small><h2>Kelas, QR, arkib & akses bab</h2></div><span>{managedClasses.length}</span></div>
          <div className="class-create"><input value={newClassName} onChange={e=>setNewClassName(e.target.value)} placeholder="Nama kelas · 2E"/><input value={newClassCode} onChange={e=>setNewClassCode(e.target.value)} placeholder="Kod · 2E26"/><input value={newClassYear} onChange={e=>setNewClassYear(e.target.value)} placeholder="Tahun"/><button onClick={addClass} disabled={!canEdit||!newClassName.trim()||!newClassCode.trim()}>Tambah kelas</button></div>
          <div className="class-cards">{managedClasses.map(item=><article key={item.code} className={"class-admin-card "+(item.archived?"archived":"")}><div className="class-admin-head"><div><strong>{item.name}</strong><small>{item.code} · {item.academicYear} · {item.studentNames.length} murid · {item.openChapters.length}/10 bab</small></div><div className="class-actions"><button onClick={()=>showQr(item)}>QR</button><button onClick={()=>copyStudentLink(item.code)}>Salin link</button><button onClick={()=>archiveClass(item.code,!item.archived)} disabled={!canEdit}>{item.archived?"Aktifkan":"Arkib"}</button><button className="danger" onClick={()=>deleteClass(item.code)} disabled={!canEdit}>Padam</button></div></div>{!item.archived?<div className="chapter-access-grid">{chapters.map(ch=><button key={ch.id} className={item.openChapters.includes(ch.id)?"open":"closed"} disabled={!canEdit} onClick={()=>toggleChapter(item.code,ch.id)}><span>Bab {ch.id}</span><b>{item.openChapters.includes(ch.id)?"Dibuka":"Ditutup"}</b></button>)}</div>:<div className="archive-banner">📦 Kelas ini diarkib dan tidak boleh digunakan untuk login murid.</div>}</article>)}</div>
        </section>:null}

        {activeSection==="students"?<section className="panel roster-manager">
          <div className="panel-title"><div><small>PENGURUSAN MURID</small><h2>Senarai & profil murid</h2></div><span>{studentDirectory.length}</span></div>
          {!activeClasses.length?<div className="panel-empty">Cipta atau aktifkan kelas dahulu.</div>:<><div className="roster-toolbar"><label>Kelas<select value={rosterClassCode} onChange={e=>setRosterClassCode(e.target.value)}>{activeClasses.map(c=><option key={c.code} value={c.code}>{c.name} · {c.code}</option>)}</select></label><div className="roster-add"><input value={manualStudentName} onChange={e=>setManualStudentName(e.target.value)} placeholder="Nama penuh murid"/><button onClick={()=>addStudentToRoster()} disabled={!canEdit||!manualStudentName.trim()}>Tambah manual</button></div><label className="import-button">{importing?"Mengimport...":"Import Excel / CSV"}<input type="file" accept=".xlsx,.xls,.csv,.txt" disabled={!canEdit||importing} onChange={importStudents}/></label></div>
          {selfAddedNotRoster.length?<div className="self-added-box"><strong>Nama ditambah sendiri oleh murid</strong><p>Semak dan masukkan ke dropdown rasmi kelas.</p>{selfAddedNotRoster.map(s=><div key={s.uid}><span>{s.name}</span><button disabled={!canEdit} onClick={()=>addStudentToRoster(s.name)}>Masuk Senarai</button></div>)}</div>:null}
          <div className="student-admin-layout"><div>{rosterClass?.studentRoster.length?<div className="roster-list">{rosterClass.studentRoster.map((student,index)=>{const profile=selfRegistered.find(s=>s.localStudentId===student.id);const presence=studentPresence.find(item=>item.classCode===rosterClassCode&&item.studentId===student.id);const key=profile?.localStudentId||student.id;return <div key={student.id} className={selectedStudentKey===key?"selected":""}><span>{index+1}</span><strong onClick={()=>profile&&setSelectedStudentKey(key)}>{student.name}</strong><small>{presence?.duplicate?"⚠️ Sesi berganda · ":""}{profile?"Pernah masuk":"Belum masuk"}</small><button disabled={!canEdit} onClick={()=>removeStudentFromRoster(student)}>Buang</button></div>})}</div>:<div className="panel-empty">Belum ada nama.</div>}</div><div className="student-profile-card">{selectedStudent?<><small>PROFIL MURID</small><h3>{selectedStudent.name}</h3><p>{selectedStudent.className} · {selectedStudentAttempts.length} percubaan</p><div className="profile-metrics"><div><span>Purata</span><b>{pct(selectedStudentAttempts.map(a=>a.percentage))}%</b></div><div><span>Terbaik</span><b>{selectedStudentAttempts.length?Math.max(...selectedStudentAttempts.map(a=>a.percentage)):0}%</b></div></div>{selectedStudentAttempts.slice(0,7).map(a=><div className="profile-attempt" key={a.id}><span>{a.chapter?"Bab "+a.chapter:a.mode}</span><b>{a.percentage}%</b></div>)}<button className="intervention-button" disabled={!canEdit} onClick={()=>createIntervention(selectedStudent)}>🎯 Assign Pemulihan</button></>:<><small>PROFIL MURID</small><h3>Pilih murid</h3><p>Klik nama murid yang pernah masuk GeoBoost.</p></>}</div></div></>}
        </section>:null}

        {activeSection==="assignments"?<section className="panel assignment-manager">
          <div className="panel-title"><div><small>TUGASAN KELAS</small><h2>Cipta, had percubaan & completion</h2></div><span>{managedClasses.reduce((s,c)=>s+c.assignments.length,0)}</span></div>
          {!activeClasses.length?<div className="panel-empty">Cipta kelas dahulu.</div>:<><div className="assignment-create"><label>Kelas<select value={assignmentClassCode} onChange={e=>setAssignmentClassCode(e.target.value)}>{activeClasses.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label><label>Tajuk<input value={assignmentTitle} onChange={e=>setAssignmentTitle(e.target.value)} placeholder="Pengukuhan Bab 7"/></label><label>Bab<select value={assignmentChapter} onChange={e=>setAssignmentChapter(Number(e.target.value))}>{chapters.map(ch=><option key={ch.id} value={ch.id}>Bab {ch.id}</option>)}</select></label><label>Soalan<select value={assignmentCount} onChange={e=>setAssignmentCount(Number(e.target.value))}>{[5,10,15,20,30].map(n=><option key={n}>{n}</option>)}</select></label><label>Had cubaan<select value={assignmentMax} onChange={e=>setAssignmentMax(Number(e.target.value))}>{[1,2,3,5,10].map(n=><option key={n}>{n}</option>)}</select></label><label>Tarikh akhir<input type="date" value={assignmentDue} onChange={e=>setAssignmentDue(e.target.value)}/></label><button onClick={()=>createAssignment()} disabled={!canEdit||!assignmentTitle.trim()}>Terbitkan</button></div>
          {bankSelection.length?<div className="selected-bank-banner">🗂️ {bankSelection.length} soalan dipilih daripada Bank Soalan. <button onClick={()=>createAssignment({questionIds:bankSelection,count:bankSelection.length})} disabled={!canEdit||!assignmentTitle.trim()}>Guna sebagai set tugasan</button></div>:null}
          <div className="assignment-list">{assignmentRows.length?assignmentRows.map(({item,completed,total,avg,missing})=><div key={item.id} className="assignment-row-rich"><div><strong>{item.title}</strong><small>Bab {item.chapter} · {item.questionIds?.length?item.questionIds.length+" soalan dipilih":item.questionCount+" soalan"} · maks {item.maxAttempts||3} cubaan{item.dueDate?" · akhir "+new Date(item.dueDate+"T00:00:00").toLocaleDateString("ms-MY"):""}</small><em>{completed}/{total} selesai · purata {avg}%{missing.length?" · belum: "+missing.slice(0,4).join(", ")+(missing.length>4?"…":""):""}</em></div><span className={item.active?"active":"inactive"}>{item.active?"Aktif":"Ditutup"}</span><button disabled={!canEdit} onClick={()=>toggleAssignmentActive(assignmentClass!.code,item.id)}>{item.active?"Tutup":"Buka"}</button><button className="danger" disabled={!canEdit} onClick={()=>removeAssignmentItem(assignmentClass!.code,item.id)}>Padam</button></div>):<div className="panel-empty">Belum ada tugasan.</div>}</div></>}
        </section>:null}

        {activeSection==="live"?<section className="panel live-panel">
          <div className="panel-title"><div><small>LIVE MONITORING</small><h2>Aktiviti kelas sekarang</h2></div><span>{currentLive.length}</span></div>
          <p className="class-help">Status berubah apabila murid bergerak ke soalan seterusnya. Rekod lebih 30 minit tidak dianggap aktif.</p>
          {currentLive.length?<div className="live-grid">{currentLive.map(item=><div key={item.uid}><span className={"live-dot "+item.status}/><div><strong>{item.studentName}</strong><small>{item.className} · {item.title}</small></div><b>{item.status==="complete"?"Selesai":item.current+"/"+item.total}</b><em>{item.total?Math.round(item.current/item.total*100):0}%</em></div>)}</div>:<div className="panel-empty">Tiada murid aktif dalam 30 minit terakhir.</div>}
        </section>:null}

        {activeSection==="interventions"?<section className="panel intervention-panel">
          <div className="panel-title"><div><small>INTERVENSI AUTOMATIK</small><h2>Murid perlu perhatian</h2></div><span>{interventionRows.length}</span></div>
          {interventionRows.length?<div className="intervention-table">{interventionRows.map(x=><div key={x.student.uid}><div><strong>{x.student.name}</strong><small>{x.student.className} · {x.attempts} percubaan</small></div><span>Purata <b>{x.average}%</b></span><span>Tugasan belum siap <b>{x.missing}</b></span><span>Fokus <b>{x.weakTopic}</b></span><button disabled={!canEdit} onClick={()=>createIntervention(x.student)}>Assign Pemulihan</button></div>)}</div>:<div className="panel-empty">Tiada murid dikesan memerlukan intervensi berdasarkan rekod semasa.</div>}
        </section>:null}

        {activeSection==="analytics"?<>{filterBar}<div className="teacher-grid"><section className="panel"><div className="panel-title"><div><small>SUBTOPIK</small><h2>Perlu perhatian</h2></div></div>{weak.length?weak.map(([topic,count],i)=><div className="weak-row detailed" key={topic}><span>#{i+1}</span><div><i style={{width:Math.min(100,count*12)+"%"}}/></div><b>{count}</b><small>{topic}</small></div>):<div className="panel-empty">Belum ada data.</div>}</section><section className="panel"><div className="panel-title"><div><small>PERBANDINGAN</small><h2>Prestasi kelas</h2></div></div><div className="class-compare">{classComparison.map(c=><div key={c.code}><div><b>{c.name}</b><small>{c.students} murid · {c.attempts} percubaan</small></div><span>{c.avg}%</span><em>≥60%: {c.pass}%</em></div>)}</div></section></div>
          <section className="panel"><div className="panel-title"><div><small>ANALISIS ITEM</small><h2>Soalan paling kerap salah / tidak pasti</h2></div></div>{missedItems.length?<div className="item-analysis">{missedItems.map(x=>{const q=[...questions,...customQuestions].find(q=>q.id===x.id);return <div key={x.id}><span>{x.id}</span><div><strong>{q?.prompt||"Soalan"}</strong><small>{x.wrong}/{x.total} salah · {x.unsure} tidak pasti</small></div><b>{x.rate}%</b></div>})}</div>:<div className="panel-empty">Belum ada data.</div>}</section>
        </>:null}

        {activeSection==="reports"?<section className="panel report-panel">
          <div className="report-print-header"><b>GEOBOOST TINGKATAN 2</b><h2>Laporan Prestasi Murid</h2><span>By Cikgu Zulhasif · {new Date().toLocaleDateString("ms-MY")}</span></div>
          <div className="panel-title"><div><small>LAPORAN</small><h2>Prestasi kelas / bab</h2></div><div className="report-actions"><button onClick={()=>downloadCsv(filtered)} disabled={!filtered.length}>Eksport CSV</button><button onClick={()=>window.print()} disabled={!filtered.length}>Cetak / PDF</button></div></div>{filterBar}
          <div className="report-summary"><div><span>Murid</span><b>{stats.students}</b></div><div><span>Percubaan</span><b>{stats.completed}</b></div><div><span>Purata</span><b>{stats.avg}%</b></div><div><span>≥60%</span><b>{stats.passRate}%</b></div></div>
          {filtered.length?<table className="report-table"><thead><tr><th>Nama</th><th>Kelas</th><th>Bab/Mod</th><th>Markah</th><th>%</th><th>Tarikh</th><th className="no-print">Tindakan</th></tr></thead><tbody>{filtered.map(a=><tr key={a.id}><td>{a.studentName}</td><td>{a.className}</td><td>{a.chapter?"Bab "+a.chapter:a.mode}</td><td>{a.score}/{a.total}</td><td>{a.percentage}%</td><td>{new Date(a.completedAt).toLocaleDateString("ms-MY")}</td><td className="no-print"><button className="reset-attempt" disabled={!canEdit} onClick={()=>resetAttempt(a.id)}>Reset</button></td></tr>)}</tbody></table>:<div className="panel-empty">Tiada rekod.</div>}
        </section>:null}

        {activeSection==="bank"?<section className="panel bank-manager">
          <div className="panel-title"><div><small>BANK SOALAN</small><h2>{questions.length} soalan teras + {customQuestions.filter(q=>q.active).length} custom</h2></div><span>{bankSelection.length} dipilih</span></div>
          <div className="bank-toolbar"><label>Bab<select value={bankChapter} onChange={e=>{setBankChapter(Number(e.target.value));setQuestionForm(f=>({...f,chapter:Number(e.target.value),subtopic:e.target.value+".1"}))}}>{chapters.map(ch=><option key={ch.id} value={ch.id}>Bab {ch.id} · {ch.title}</option>)}</select></label><div><button onClick={makeWorksheet} disabled={!bankSelection.length}>Worksheet / PDF</button><button onClick={()=>setBankSelection([])} disabled={!bankSelection.length}>Kosongkan pilihan</button></div></div>
          {canEdit?<div className="question-editor"><div className="question-editor-title"><b>{questionForm.id?"Edit "+questionForm.id:"Tambah Soalan Custom"}</b>{questionForm.id?<button onClick={()=>setQuestionForm({id:"",chapter:bankChapter,subtopic:bankChapter+".1",difficulty:"medium",type:"mcq",prompt:"",a:"",b:"",c:"",d:"",answer:"A",explanation:""})}>Batal edit</button>:null}</div><div className="question-editor-grid"><label>Bab<input type="number" min="1" max="10" value={questionForm.chapter} onChange={e=>setQuestionForm(f=>({...f,chapter:Number(e.target.value)}))}/></label><label>Subtopik<input value={questionForm.subtopic} onChange={e=>setQuestionForm(f=>({...f,subtopic:e.target.value}))}/></label><label>Aras<select value={questionForm.difficulty} onChange={e=>setQuestionForm(f=>({...f,difficulty:e.target.value as Difficulty}))}><option value="easy">Mudah</option><option value="medium">Sederhana</option><option value="kbat">KBAT</option></select></label><label>Jawapan<select value={questionForm.answer} onChange={e=>setQuestionForm(f=>({...f,answer:e.target.value}))}>{["A","B","C","D"].map(x=><option key={x}>{x}</option>)}</select></label></div><label>Soalan<textarea value={questionForm.prompt} onChange={e=>setQuestionForm(f=>({...f,prompt:e.target.value}))}/></label><div className="question-options-edit">{(["a","b","c","d"] as const).map((key,i)=><label key={key}>{String.fromCharCode(65+i)}<input value={questionForm[key]} onChange={e=>setQuestionForm(f=>({...f,[key]:e.target.value}))}/></label>)}</div><label>Penerangan<textarea value={questionForm.explanation} onChange={e=>setQuestionForm(f=>({...f,explanation:e.target.value}))}/></label><button className="primary" onClick={saveQuestion}>Simpan Soalan</button></div>:null}
          <div className="bank-list selectable">{bankItems.map(q=>{const custom=(q as any).custom===true;return <div key={q.id} className={bankSelection.includes(q.id)?"selected":""}><input type="checkbox" checked={bankSelection.includes(q.id)} onChange={e=>setBankSelection(s=>e.target.checked?[...new Set([...s,q.id])]:s.filter(id=>id!==q.id))}/><span>{q.id}</span><div><strong>{q.prompt}</strong><small>{q.subtopic} · {custom?"CUSTOM":"TERAS"}</small></div><b className={"difficulty "+q.difficulty}>{q.difficulty==="easy"?"MUDAH":q.difficulty==="medium"?"SEDERHANA":"KBAT"}</b>{custom?<div className="bank-actions"><button onClick={()=>editQuestion(q as CustomQuestion)}>Edit</button><button onClick={()=>archiveQuestion(q.id,false)}>Arkib</button><button className="danger" onClick={()=>removeQuestion(q.id)}>Padam</button></div>:null}</div>})}</div>
        </section>:null}

        {activeSection==="settings"?<section className="settings-stack">
          <section className="panel settings-panel"><div className="panel-title"><div><small>SISTEM</small><h2>GeoBoost v2.0</h2></div><button onClick={backup}>Backup JSON</button></div><div className="settings-grid"><div><span>Sumber data</span><b>{source==="firebase"?"Firebase pusat":"Peranti"}</b></div><div><span>Role</span><b>{teacherProfile?.role?.toUpperCase()||"-"}</b></div><div><span>Kelas aktif</span><b>{activeClasses.length}</b></div><div><span>Bank</span><b>{questions.length+customQuestions.filter(q=>q.active).length}</b></div></div><div className="settings-note"><strong>Backup</strong><p>Backup JSON merangkumi kelas, murid, rekod percubaan, soalan custom dan audit yang boleh dibaca semula jika diperlukan.</p></div></section>
          {isAdmin?<section className="panel"><div className="panel-title"><div><small>FIREBASE P1</small><h2>Keselamatan Guru ↔ Murid</h2></div><span>{firebaseRulesReady===true?"AKTIF":firebaseRulesReady===false?"PERLU AKTIF":"SEMAK"}</span></div><p className="class-help">Menerbitkan Firestore Rules untuk pemilikan kelas, ID murid unik, kod akses 6 digit dan pengesahan keputusan. Google mungkin meminta kebenaran Firebase sekali sahaja.</p><button className="primary" onClick={activateFirebaseP1} disabled={deployingRules}>{deployingRules?"Mengaktifkan...":firebaseRulesReady===true?"Terbitkan semula Rules P1":"Aktifkan Firebase P1"}</button></section>:null}
          {isAdmin?<section className="panel"><div className="panel-title"><div><small>ROLE GURU</small><h2>Admin / Guru / Viewer</h2></div></div><div className="teacher-role-form"><input value={teacherForm.uid} onChange={e=>setTeacherForm(f=>({...f,uid:e.target.value}))} placeholder="UID Firebase guru"/><input value={teacherForm.name} onChange={e=>setTeacherForm(f=>({...f,name:e.target.value}))} placeholder="Nama guru"/><select value={teacherForm.role} onChange={e=>setTeacherForm(f=>({...f,role:e.target.value as any}))}><option value="admin">Admin</option><option value="guru">Guru</option><option value="viewer">Viewer</option></select><button onClick={saveRole}>Simpan akses</button></div><div className="teacher-role-list">{teacherProfiles.map(t=><div key={t.uid}><b>{t.name}</b><span>{t.role}</span><small>{t.uid}</small></div>)}</div></section>:null}
          <section className="panel"><div className="panel-title"><div><small>AUDIT LOG</small><h2>Aktiviti pentadbiran</h2></div><span>{auditLogs.length}</span></div><div className="audit-list">{auditLogs.slice(0,40).map(a=><div key={a.id}><b>{a.action}</b><span>{a.detail}</span><small>{a.by} · {new Date(a.createdAt).toLocaleString("ms-MY")}</small></div>)}</div></section>
        </section>:null}
      </section>
    </div>

    {qrData?<div className="qr-modal" onClick={()=>setQrData(null)}><div onClick={e=>e.stopPropagation()}><button className="qr-close" onClick={()=>setQrData(null)}>×</button><small>QR KELAS</small><h2>{qrData.name}</h2><img src={qrData.image} alt={"QR "+qrData.code}/><b>{qrData.code}</b><p>Scan QR → pilih nama → masuk GeoBoost.</p><div><button onClick={()=>navigator.clipboard.writeText(qrData.url)}>Salin Link</button><button onClick={()=>window.print()}>Cetak QR</button></div></div></div>:null}
  </main>;
}
