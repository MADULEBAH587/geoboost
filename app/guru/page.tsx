"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { chapters } from "@/lib/data";
import { questions, type Difficulty, type QuestionType } from "@/lib/questions";
import {
  AttemptRecord, RegisteredStudent, LiveProgress, deleteRemoteAttempt, getLocalAttempts,
  getRemoteAttempts, getRemoteStudents, watchLiveProgress, watchRemoteAttempts,
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
  registerTeacherRequest, saveTeacherProfile, touchTeacherLastSeen, watchTeacherProfiles, writeAudit,
} from "@/lib/teacherAdmin";
import { bootstrapGeoBoostAdmin, deployGeoBoostFirestoreRules, deployGeoBoostMultiTeacher } from "@/lib/firebaseRulesAdmin";
import { StudentPresence, resetStudentPresence, watchStudentPresence } from "@/lib/studentPresence";
import { StudentAccessRecord, ensureStudentAccessCodes, removeStudentAccessCode } from "@/lib/studentAccess";
import { getStudentLoginMode, type StudentLoginMode } from "@/lib/systemConfig";
import { VisualNotesAdmin } from "@/components/VisualNotesAdmin";
import { endAdminEditSession, startAdminEditSession } from "@/lib/adminDelegation";

type Source = "local"|"firebase";
type TeacherSection = "dashboard"|"classes"|"students"|"assignments"|"live"|"interventions"|"analytics"|"reports"|"notes"|"bank"|"teachers"|"settings";

const NAV:{id:TeacherSection;icon:string;label:string}[]=[
  {id:"dashboard",icon:"▦",label:"Ringkasan"},{id:"classes",icon:"🏫",label:"Kelas"},
  {id:"students",icon:"👥",label:"Murid"},{id:"assignments",icon:"📝",label:"Tugasan"},
  {id:"analytics",icon:"📊",label:"Analitik & Laporan"},{id:"bank",icon:"🗂️",label:"Kandungan"},
  {id:"settings",icon:"⚙️",label:"Tetapan"},
];

function downloadText(filename:string,text:string,type="application/json"){
  const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
}
function downloadCsv(attempts:AttemptRecord[]){
  const esc=(v:unknown)=>'"'+String(v??"").replaceAll('"','""')+'"';
  const rows=[["Nama","Kelas","Bab / Aktiviti","Markah","Jumlah","Peratus","Tempoh (s)","Subtopik lemah","Tarikh"],...attempts.map(a=>[
    a.studentName,a.className,a.chapter?"Bab "+a.chapter:(a.label||a.mode||"Campuran"),a.score,a.total,a.percentage,a.durationSeconds,a.wrongSubtopics.join(" | "),new Date(a.completedAt).toLocaleString("ms-MY")
  ])];
  downloadText("geoboost-laporan-"+new Date().toISOString().slice(0,10)+".csv","\ufeff"+rows.map(r=>r.map(esc).join(",")).join("\n"),"text/csv;charset=utf-8");
}
function pct(list:number[]){return list.length?Math.round(list.reduce((s,v)=>s+v,0)/list.length):0}

function teacherRoleLabel(role?:string){
  if(role==="admin")return "Pentadbir";
  if(role==="viewer")return "Paparan Sahaja";
  return "Guru";
}
function teacherStatusLabel(status?:string){
  if(status==="pending")return "Menunggu Kelulusan";
  if(status==="suspended")return "Digantung";
  if(status==="rejected")return "Ditolak";
  return "Aktif";
}

function auditActionLabel(action:string){
  const labels:Record<string,string>={
    KELAS_TAMBAH:"Kelas ditambah",KELAS_ARKIB:"Kelas diarkibkan",KELAS_AKTIF:"Kelas diaktifkan",
    KELAS_PADAM:"Kelas dipadam",KELAS_TUKAR_GURU:"Guru kelas ditukar",AKSES_BAB:"Akses bab dikemas kini",
    MURID_TAMBAH:"Murid ditambah",MURID_BUANG:"Murid dibuang",MURID_IMPORT:"Senarai murid dimasukkan",
    MURID_RESET_SESI:"Akses peranti murid dikosongkan",TUGASAN_TAMBAH:"Tugasan ditambah",
    TUGASAN_PADAM:"Tugasan dipadam",TUGASAN_STATUS:"Status tugasan diubah",PERCUBAAN_RESET:"Rekod percubaan dipadam",
    SOALAN_SIMPAN:"Soalan disimpan",SOALAN_STATUS:"Status soalan diubah",SOALAN_PADAM:"Soalan dipadam",
    INTERVENSI_ASSIGN:"Latihan pemulihan diberikan",GURU_LULUS:"Guru diluluskan",GURU_GANTUNG:"Akaun guru digantung",
    GURU_TOLAK:"Permohonan guru ditolak",GURU_ROLE:"Jenis akses guru diubah",GURU_NAMA:"Nama guru diubah",
    ADMIN_EDIT_MULA:"Suntingan pentadbir dibenarkan",ADMIN_PASSWORD:"Kata laluan pentadbir ditetapkan",
    MULTI_GURU_AKTIF:"Tetapan akaun guru disemak",FIREBASE_RULES:"Tetapan sistem disemak",
  };
  return labels[action]||"Aktiviti pentadbiran";
}
function auditDetailLabel(detail:string){
  const raw=String(detail||"");
  if(/firebase|firestore|ruleset|projects\//i.test(raw))return "Semakan berjaya";
  return raw
    .replace(/\badmin\b/gi,"Pentadbir")
    .replace(/\bviewer\b/gi,"Paparan Sahaja")
    .replace(/\bguru\b/gi,"Guru")
    .replace(/\bactive\b/gi,"Aktif")
    .replace(/\bpending\b/gi,"Menunggu Kelulusan")
    .replace(/\bsuspended\b/gi,"Digantung")
    .replace(/\brejected\b/gi,"Ditolak");
}

export default function TeacherPage(){
  const [activeSection,setActiveSection]=useState<TeacherSection>("dashboard");
  const [mobileSidebarOpen,setMobileSidebarOpen]=useState(false);
  const [attempts,setAttempts]=useState<AttemptRecord[]>([]);
  const [registeredStudents,setRegisteredStudents]=useState<RegisteredStudent[]>([]);
  const [managedClasses,setManagedClasses]=useState<ClassRecord[]>([]);
  const [customQuestions,setCustomQuestions]=useState<CustomQuestion[]>([]);
  const [liveItems,setLiveItems]=useState<LiveProgress[]>([]);
  const [auditLogs,setAuditLogs]=useState<AuditEntry[]>([]);
  const [teacherProfiles,setTeacherProfiles]=useState<TeacherProfile[]>([]);
  const [teacherProfile,setTeacherProfile]=useState<TeacherProfile|null>(null);
  const [studentPresence,setStudentPresence]=useState<StudentPresence[]>([]);
  const [studentAccessCodes,setStudentAccessCodes]=useState<StudentAccessRecord[]>([]);
  const [studentLoginMode,setStudentLoginMode]=useState<StudentLoginMode>("legacy-pin");
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
  const [studentSearch,setStudentSearch]=useState("");
  const [studentStatusFilter,setStudentStatusFilter]=useState<"all"|"logged"|"new"|"intervention"|"duplicate">("all");
  const [studentAddOpen,setStudentAddOpen]=useState(false);
  const [mobileStudentProfile,setMobileStudentProfile]=useState(false);
  const [assignmentClassCode,setAssignmentClassCode]=useState("");
  const [assignmentTitle,setAssignmentTitle]=useState("");
  const [assignmentChapter,setAssignmentChapter]=useState(1);
  const [assignmentCount,setAssignmentCount]=useState(20);
  const [assignmentDue,setAssignmentDue]=useState("");
  const [assignmentMax,setAssignmentMax]=useState(3);
  const [bankChapter,setBankChapter]=useState(1);
  const [bankSelection,setBankSelection]=useState<string[]>([]);
  const [qrData,setQrData]=useState<{code:string;name:string;url:string;image:string}|null>(null);
  const [questionForm,setQuestionForm]=useState({
    id:"",chapter:1,subtopic:"1.1",difficulty:"medium" as Difficulty,type:"mcq" as QuestionType,
    prompt:"",a:"",b:"",c:"",d:"",answer:"A",explanation:"",
  });

  const isAdmin=teacherProfile?.role==="admin";
  const adminEditActive=Boolean(adminTeacherUid&&Date.now()<adminEditUntil);
  const canEdit=teacherProfile?.role!=="viewer";
  const navItems=isAdmin?NAV:NAV.filter(item=>item.id!=="teachers");

  function canManageClassCode(code:string){
    if(!teacherProfile||teacherProfile.role==="viewer")return false;
    const item=managedClasses.find(cls=>cls.code===code);
    if(!item)return false;
    if(!isAdmin)return item.ownerTeacherId===teacherUid;
    if(!item.ownerTeacherId||item.ownerTeacherId===teacherUid)return true;
    return adminEditActive&&adminTeacherUid===item.ownerTeacherId&&Date.now()<adminEditUntil;
  }

  function patchClass(code:string,patch:Partial<ClassRecord>){
    setManagedClasses(current=>current.map(item=>item.code===code?{...item,...patch}:item));
  }
  async function log(action:string,detail:string){
    await writeAudit(action,detail,teacherEmail||teacherUid||"Guru");
    setAuditLogs(await getAuditLogs());
  }

  function clearTeacherData(){
    setTeacherProfile(null);setManagedClasses([]);setRegisteredStudents([]);setAttempts([]);
    setCustomQuestions([]);setAuditLogs([]);setTeacherProfiles([]);setStudentPresence([]);setStudentAccessCodes([]);setLiveItems([]);setFirebaseRulesReady(null);setSource("local");
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
        ?"Profil guru belum tersedia."
        :status==="pending"
          ?"Pendaftaran berjaya. Akaun sedang menunggu kelulusan pentadbir."
          :status==="rejected"
            ?"Permohonan akaun guru ini telah ditolak oleh pentadbir."
            :"Akses akaun guru ini telah dinyahaktifkan oleh pentadbir.");
      return;
    }

    const classes=await listClasses(profile.role);
    const classCodes=classes.map(item=>item.code);
    const allowAll=profile.role==="admin";
    const loginMode=await getStudentLoginMode();
    setStudentLoginMode(loginMode);
    if(loginMode==="legacy-pin"&&profile.role!=="viewer"){
      try{
        const access=(await Promise.all(classes.map(item=>ensureStudentAccessCodes(item)))).flat();
        setStudentAccessCodes(access);
      }catch{setStudentAccessCodes([])}
    }else setStudentAccessCodes([]);
    const [remote,students,custom,audit,profiles]=await Promise.all([
      getRemoteAttempts(classCodes,allowAll),getRemoteStudents(classCodes,allowAll),getCustomQuestions(true),getAuditLogs(),allowAll?listTeacherProfiles():Promise.resolve([]),
    ]);
    setManagedClasses(classes);setRegisteredStudents(students);setAttempts(remote);
    setCustomQuestions(custom);setAuditLogs(audit);setTeacherProfiles(profiles);setSource("firebase");setFirebaseRulesReady(true);
    void touchTeacherLastSeen(user.uid);
    const first=classes.find(c=>!c.archived)?.code||classes[0]?.code||"";
    setRosterClassCode(current=>current||first);setAssignmentClassCode(current=>current||first);
    setMessage("");
  }

  useEffect(()=>{
    if(!firebaseConfigured){setAuthReady(true);return;}
    const stop=watchFirebaseAuth(user=>{
      setAuthReady(false);setAuthError("");
      if(user&&!user.isAnonymous){
        setAuthUser({uid:user.uid,email:user.email});
        loadTeacherData(user).catch((error:any)=>{
          console.error(error);clearTeacherData();setTeacherEmail(user.email||"Guru");setTeacherUid(user.uid);
          setAuthError("Maklumat akaun belum dapat dimuat. Cuba semula.");
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

  useEffect(()=>{
    if(source!=="firebase"||!teacherProfile)return;
    const classCodes=managedClasses.map(item=>item.code);
    return watchRemoteAttempts(setAttempts,classCodes,teacherProfile.role==="admin");
  },[source,teacherProfile,managedClasses]);

  useEffect(()=>{
    if(source!=="firebase"||teacherProfile?.role!=="admin")return;
    return watchTeacherProfiles(setTeacherProfiles);
  },[source,teacherProfile?.role]);

  useEffect(()=>{
    if(!adminEditUntil)return;
    const delay=Math.max(0,adminEditUntil-Date.now());
    const timer=window.setTimeout(()=>{
      void endAdminEditSession();
      setAdminEditUntil(0);
      setAdminEditPassword("");
      setMessage("Tempoh suntingan tamat. Kembali ke paparan sahaja.");
    },delay);
    return ()=>window.clearTimeout(timer);
  },[adminEditUntil]);

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
          ?"Log masuk belum tersedia. Hubungi pentadbir."
          :"Log masuk gagal. Cuba semula.");
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
      setMessage("Pendaftaran berjaya. Tunggu pentadbir meluluskan akaun anda.");
    }catch(error:any){
      console.error(error);
      const code=String(error?.code||"");
      setAuthError(code.includes("email-already-in-use")
        ?"Email ini sudah mempunyai akaun. Gunakan Log Masuk atau Lupa Kata Laluan."
        :code.includes("operation-not-allowed")
          ?"Pendaftaran belum tersedia. Hubungi pentadbir."
          :"Pendaftaran gagal. Cuba semula.");
      setAuthReady(true);
    }finally{setAuthBusy(false)}
  }

  async function resetTeacherPassword(){
    if(!loginEmail.trim()){setAuthError("Masukkan email guru dahulu.");return}
    setAuthBusy(true);setAuthError("");
    try{await sendTeacherPasswordReset(loginEmail);setMessage("Pautan tetapkan semula kata laluan telah dihantar ke "+loginEmail+".");}
    catch(error:any){console.error(error);setAuthError("Kata laluan belum dapat ditetapkan semula. Cuba semula.")}
    finally{setAuthBusy(false)}
  }

  async function submitMissingTeacherProfile(){
    if(!authUser||!registerName.trim())return;
    setAuthBusy(true);setAuthError("");
    try{
      await registerTeacherRequest({uid:authUser.uid,name:registerName,email:authUser.email||teacherEmail||""});
      await loadTeacherData(authUser);
      setMessage("Permohonan guru dihantar. Tunggu kelulusan pentadbir.");
    }catch(error:any){
      console.error(error);setAuthError("Permohonan belum dapat dihantar. Cuba semula.");
    }finally{setAuthBusy(false)}
  }

  async function connectLegacyAdmin(){
    setAuthBusy(true);setAuthError("");setMessage("");
    try{
      const user=await signInTeacherWithGoogle();
      if(!user){setAuthError("Pengesahan pentadbir tidak selesai.");setAuthReady(true);}
    }catch(error:any){
      console.error(error);setAuthError("Pengesahan pentadbir gagal. Cuba semula.");
      setAuthReady(true);
    }finally{setAuthBusy(false)}
  }
  async function disconnectTeacher(){
    setAuthReady(false);
    await endAdminEditSession();
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
    if(!canManageClassCode(code)){setMessage("Kelas guru lain memerlukan kebenaran suntingan pentadbir.");return;}
    try{await setClassArchived(code,archived);patchClass(code,{archived,active:!archived});await log(archived?"KELAS_ARKIB":"KELAS_AKTIF",code);setMessage(archived?"Kelas diarkib.":"Kelas diaktifkan semula.");}catch{setMessage("Status kelas tidak dapat dikemas kini.")}
  }
  async function deleteClass(code:string){
    if(!canManageClassCode(code)){setMessage("Kelas guru lain memerlukan kebenaran suntingan pentadbir.");return;}
    if(!confirm("Padam kelas "+code+"? Gunakan Arkib jika data lama masih diperlukan."))return;
    try{await removeClass(code);setManagedClasses(c=>c.filter(x=>x.code!==code));await log("KELAS_PADAM",code);setMessage("Kelas dipadam.");}catch{setMessage("Kelas tidak dapat dipadam.")}
  }
  async function toggleChapter(code:string,chapter:number){
    if(!canManageClassCode(code)){setMessage("Kelas guru lain memerlukan kebenaran suntingan pentadbir.");return;}
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
    const link=window.location.origin+"/murid?class="+encodeURIComponent(code);await navigator.clipboard.writeText(link);setMessage("Pautan kelas "+code+" disalin.");
  }

  async function updateRosterState(code:string,studentRoster:ClassStudent[]){
    patchClass(code,{studentRoster,studentNames:studentRoster.map(student=>student.name)});
    if(studentLoginMode==="legacy-pin"){
      const current=managedClasses.find(item=>item.code===code);
      if(current){
        try{
          const access=await ensureStudentAccessCodes({...current,studentRoster,studentNames:studentRoster.map(student=>student.name)});
          setStudentAccessCodes(all=>[...all.filter(item=>item.classCode!==code),...access]);
        }catch{}
      }
    }
  }
  async function addStudentToRoster(name=manualStudentName){
    if(!rosterClassCode||!name.trim())return;
    if(!canManageClassCode(rosterClassCode)){setMessage("Senarai murid guru lain memerlukan kebenaran suntingan pentadbir.");return;}
    try{
      const roster=await addRosterStudent(rosterClassCode,name);
      await updateRosterState(rosterClassCode,roster);setManualStudentName("");
      await log("MURID_TAMBAH",normalizeStudentName(name)+" · "+rosterClassCode);setMessage("Murid ditambah ke senarai kelas.");
    }catch{setMessage("Nama murid tidak dapat ditambah.")}
  }
  async function removeStudentFromRoster(student:ClassStudent){
    if(!canManageClassCode(rosterClassCode)){setMessage("Senarai murid guru lain memerlukan kebenaran suntingan pentadbir.");return;}
    if(!confirm("Buang "+student.name+" daripada senarai kelas?"))return;
    try{
      const roster=await removeRosterStudent(rosterClassCode,student.id);
      if(studentLoginMode==="legacy-pin"){
        try{await removeStudentAccessCode(rosterClassCode,student.id)}catch{}
      }
      await updateRosterState(rosterClassCode,roster);
      await log("MURID_BUANG",student.name+" · "+rosterClassCode);
    }catch{setMessage("Nama murid tidak dapat dibuang.")}
  }
  async function clearStudentSession(student:ClassStudent){
    if(!rosterClassCode||!canManageClassCode(rosterClassCode)){setMessage("Tindakan ini memerlukan kebenaran mengubah kelas.");return}
    try{
      await resetStudentPresence(rosterClassCode,student.id);
      setStudentPresence(current=>current.filter(item=>!(item.classCode===rosterClassCode&&item.studentId===student.id)));
      await log("MURID_RESET_SESI",student.name+" · "+rosterClassCode);
      setMessage("Akses peranti "+student.name+" telah dikosongkan.");
    }catch(error){console.error(error);setMessage("Akses peranti murid tidak dapat dikosongkan.")}
  }

  async function copyLegacyAccessCodes(){
    if(!rosterClass||studentLoginMode!=="legacy-pin")return;
    const rows=rosterClass.studentRoster.map((student,index)=>{
      const access=studentAccessCodes.find(item=>item.classCode===rosterClass.code&&item.studentId===student.id);
      return (index+1)+". "+student.name+" — "+(access?.pin||"BELUM DIJANA");
    });
    await navigator.clipboard.writeText("GeoBoost "+rosterClass.name+" ("+rosterClass.code+")\n"+rows.join("\n"));
    setMessage("Senarai kod akses sementara "+rosterClass.code+" disalin.");
  }

  async function importStudents(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];event.target.value="";if(!file||!rosterClassCode)return;
    if(!canManageClassCode(rosterClassCode)){setMessage("Memasukkan senarai ke kelas guru lain memerlukan kebenaran suntingan pentadbir.");return;}
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
      await updateRosterState(rosterClassCode,saved);await log("MURID_IMPORT",imported.length+" nama · "+rosterClassCode);setMessage("Senarai murid berjaya dimasukkan: "+saved.length+" murid.");
    }catch(e){console.error(e);setMessage("Import gagal. Gunakan Excel/CSV dengan kolum Nama.");}finally{setImporting(false)}
  }

  async function createAssignment(extra?:{questionIds?:string[];targetStudentIds?:string[];title?:string;chapter?:number;count?:number}){
    if(!assignmentClassCode)return;
    if(!canManageClassCode(assignmentClassCode)){setMessage("Tugasan kelas guru lain memerlukan kebenaran suntingan pentadbir.");return;}
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
    if(!canManageClassCode(classCode)){setMessage("Tugasan guru lain memerlukan kebenaran suntingan pentadbir.");return;}
    if(!confirm("Padam tugasan ini?"))return;
    try{patchClass(classCode,{assignments:await deleteAssignment(classCode,id)});await log("TUGASAN_PADAM",id);}catch{setMessage("Tugasan gagal dipadam.")}
  }
  async function toggleAssignmentActive(classCode:string,id:string){
    if(!canManageClassCode(classCode)){setMessage("Tugasan guru lain memerlukan kebenaran suntingan pentadbir.");return;}
    const item=managedClasses.find(c=>c.code===classCode)?.assignments.find(a=>a.id===id);if(!item)return;
    try{patchClass(classCode,{assignments:await saveAssignment(classCode,{...item,active:!item.active})});await log("TUGASAN_STATUS",item.title+" -> "+(!item.active));}catch{setMessage("Status tugasan gagal.")}
  }

  async function resetAttempt(id:string){
    const record=attempts.find(item=>item.id===id);
    if(record?.classCode&&!canManageClassCode(record.classCode)){setMessage("Rekod kelas guru lain memerlukan kebenaran suntingan pentadbir.");return;}
    if(!canEdit||!confirm("Padam rekod percubaan ini? Murid boleh membuat percubaan baharu selepas rekod dipadam."))return;
    try{await deleteRemoteAttempt(id);setAttempts(a=>a.filter(x=>x.id!==id));await log("PERCUBAAN_RESET",id);setMessage("Rekod dipadam. Murid boleh membuat percubaan baharu.");}catch{setMessage("Rekod tidak dapat dipadam.")}
  }

  async function saveQuestion(){
    if(!canEdit)return;
    const opts=[questionForm.a,questionForm.b,questionForm.c,questionForm.d].map(x=>x.trim()).filter(Boolean);
    const answer=({A:questionForm.a,B:questionForm.b,C:questionForm.c,D:questionForm.d} as Record<string,string>)[questionForm.answer]?.trim()||"";
    try{
      await saveCustomQuestion({id:questionForm.id||undefined,chapter:questionForm.chapter,subtopic:questionForm.subtopic,difficulty:questionForm.difficulty,type:questionForm.type,prompt:questionForm.prompt,options:opts,answer,explanation:questionForm.explanation,custom:true,active:true});
      setCustomQuestions(await getCustomQuestions(true));setQuestionForm({id:"",chapter:bankChapter,subtopic:bankChapter+".1",difficulty:"medium",type:"mcq",prompt:"",a:"",b:"",c:"",d:"",answer:"A",explanation:""});
      await log("SOALAN_SIMPAN",questionForm.id||"Soalan tambahan baharu");setMessage("Soalan tambahan disimpan.");
    }catch(e:any){setMessage(e?.message||"Soalan gagal disimpan.")}
  }
  function editQuestion(q:CustomQuestion){
    setQuestionForm({id:q.id,chapter:q.chapter,subtopic:q.subtopic,difficulty:q.difficulty,type:q.type,prompt:q.prompt,a:q.options[0]||"",b:q.options[1]||"",c:q.options[2]||"",d:q.options[3]||"",answer:["A","B","C","D"][Math.max(0,q.options.indexOf(q.answer))]||"A",explanation:q.explanation});
  }
  async function archiveQuestion(id:string,active:boolean){
    if(!canEdit)return;await archiveCustomQuestion(id,active);setCustomQuestions(await getCustomQuestions(true));await log("SOALAN_STATUS",id+" -> "+active);
  }
  async function removeQuestion(id:string){
    if(!canEdit||!confirm("Padam soalan tambahan "+id+"?"))return;await deleteCustomQuestion(id);setCustomQuestions(await getCustomQuestions(true));setBankSelection(s=>s.filter(x=>x!==id));await log("SOALAN_PADAM",id);
  }
  function makeWorksheet(){
    if(!bankSelection.length){setMessage("Pilih sekurang-kurangnya satu soalan.");return}
    window.open("/guru/worksheet?ids="+encodeURIComponent(bankSelection.join(","))+"&title="+encodeURIComponent("Latihan Geografi"),"_blank");
  }

  async function createIntervention(student:RegisteredStudent){
    if(!canManageClassCode(student.classCode)){setMessage("Pemulihan kelas guru lain memerlukan kebenaran suntingan pentadbir.");return;}
    const own=attempts.filter(a=>a.studentId===student.localStudentId||(a.studentName===student.name&&a.className===student.className));
    const groups=new Map<number,number[]>();own.filter(a=>a.chapter>0).forEach(a=>groups.set(a.chapter,[...(groups.get(a.chapter)||[]),a.percentage]));
    const weak=[...groups.entries()].sort((a,b)=>pct(a[1])-pct(b[1]))[0]?.[0]||1;
    const cls=managedClasses.find(c=>c.code===student.classCode);if(!cls)return;
    setAssignmentClassCode(cls.code);
    try{
      const due=new Date();due.setDate(due.getDate()+7);
      const next=await saveAssignment(cls.code,{title:"Pemulihan · "+student.name,chapter:weak,questionCount:10,dueDate:due.toISOString().slice(0,10),active:true,questionIds:[],maxAttempts:3,targetStudentIds:[student.localStudentId]});
      patchClass(cls.code,{assignments:next});await log("INTERVENSI_ASSIGN",student.name+" · Bab "+weak);setMessage("Pemulihan Bab "+weak+" ditetapkan kepada "+student.name+".");
    }catch{setMessage("Latihan pemulihan gagal ditetapkan.")}
  }

  async function bootstrapFirstAdmin(){
    if(deployingRules)return;
    setDeployingRules(true);setAuthError("");setMessage("Menyediakan akses pentadbir...");
    try{
      const result=await bootstrapGeoBoostAdmin();
      const user={uid:result.uid,email:result.email||null};
      setAuthUser(user);setTeacherUid(result.uid);setTeacherEmail(result.email||"Pentadbir GeoBoost");
      setFirebaseRulesReady(true);
      setMessage("Akses pentadbir berjaya disediakan. Memuatkan halaman guru...");
      await loadTeacherData(user);
    }catch(error:any){
      console.error(error);
      setFirebaseRulesReady(false);
      setAuthError("Penyediaan akses pentadbir belum selesai. Sila semak kebenaran akaun dan cuba semula.");
    }finally{setDeployingRules(false)}
  }

  async function activateFirebaseP1(){
    if(!isAdmin||deployingRules)return;
    setDeployingRules(true);setMessage("Menyemak semula sistem...");
    try{
      const result=await deployGeoBoostFirestoreRules();
      setFirebaseRulesReady(true);
      await log("FIREBASE_RULES",result.rulesetName);
      setMessage("Semakan sistem selesai.");
      if(authUser)await loadTeacherData(authUser);
    }catch(error:any){
      console.error(error);setFirebaseRulesReady(false);
      setMessage("Semakan sistem belum dapat diselesaikan. Cuba semula.");
    }finally{setDeployingRules(false)}
  }

  async function activateMultiTeacher(){
    if(!isAdmin||deployingRules)return;
    setDeployingRules(true);setMessage("Menyediakan fungsi akaun guru...");
    try{
      const result=await deployGeoBoostMultiTeacher();
      setFirebaseRulesReady(true);
      await log("MULTI_GURU_AKTIF",result.rulesetName);
      setMessage("Fungsi akaun guru sudah tersedia.");
      if(authUser)await loadTeacherData(authUser);
    }catch(error:any){
      console.error(error);setFirebaseRulesReady(false);
      setMessage("Penyediaan fungsi akaun guru belum selesai. Cuba semula.");
    }finally{setDeployingRules(false)}
  }

  async function setAdminPassword(){
    if(!isAdmin||adminNewPassword.length<6){setMessage("Kata laluan pentadbir mesti sekurang-kurangnya 6 aksara.");return}
    try{
      await linkCurrentTeacherPassword(adminNewPassword);
      setAdminNewPassword("");
      await log("ADMIN_PASSWORD","Kata laluan dipautkan pada akaun pentadbir.");
      setMessage("Kata laluan pentadbir berjaya ditetapkan.");
    }catch(error:any){
      console.error(error);setMessage("Kata laluan belum dapat ditetapkan. Cuba semula.");
    }
  }

  async function beginAdminEdit(){
    if(!isAdmin||!adminTeacherUid||!adminEditPassword)return;
    try{
      await reauthenticateTeacher(adminEditPassword);
      const expiresAt=await startAdminEditSession(adminTeacherUid,15);
      setAdminEditUntil(expiresAt);setAdminEditPassword("");
      const target=teacherProfiles.find(t=>t.uid===adminTeacherUid);
      await log("ADMIN_EDIT_MULA",(target?.name||adminTeacherUid)+" · 15 minit");
      setMessage("Suntingan pentadbir dibenarkan selama 15 minit untuk "+(target?.name||"guru dipilih")+".");
    }catch(error:any){
      setMessage("Pengesahan pentadbir gagal. Semak kata laluan.");
    }
  }

  async function leaveAdminEdit(){
    await endAdminEditSession();
    setAdminEditUntil(0);setAdminEditPassword("");
    setMessage("Suntingan pentadbir ditutup. Kembali ke paparan sahaja.");
  }

  async function updateTeacherAccess(target:TeacherProfile,patch:Partial<TeacherProfile>,action:string){
    if(!isAdmin||adminTeacherUid!==target.uid||!adminEditActive||Date.now()>=adminEditUntil){
      setMessage("Benarkan suntingan dan sahkan kata laluan pentadbir dahulu.");return;
    }
    const next={...target,...patch};
    try{
      await saveTeacherProfile(next);
      setTeacherProfiles(await listTeacherProfiles());
      await log(action,target.name+" · "+String(next.status||"active")+" · "+next.role);
      setMessage("Akaun "+target.name+" berjaya dikemas kini.");
    }catch(error:any){console.error(error);setMessage("Akaun guru gagal dikemas kini. Cuba semula.")}
  }

  async function moveClassOwner(classCode:string,newOwnerUid:string){
    if(!isAdmin||!adminTeacherUid||!adminEditActive||Date.now()>=adminEditUntil){
      setMessage("Benarkan suntingan guru dahulu.");return;
    }
    const target=teacherProfiles.find(t=>t.uid===newOwnerUid);
    if(!target||target.status!=="active"){setMessage("Pilih guru aktif sebagai pemilik baharu.");return}
    try{
      await transferClassOwner(classCode,newOwnerUid);
      patchClass(classCode,{ownerTeacherId:newOwnerUid});
      await log("KELAS_TUKAR_GURU",classCode+" → "+target.name);
      setMessage("Kelas "+classCode+" kini di bawah "+target.name+".");
    }catch(error:any){console.error(error);setMessage("Guru kelas gagal ditukar. Cuba semula.")}
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
    const rosterStudents=activeClasses.reduce((sum,item)=>sum+item.studentRoster.length,0);
    const attemptStudents=new Set(filtered.map(a=>a.studentId||a.studentName+"|"+a.className)).size;
    const passed=filtered.filter(a=>a.percentage>=60).length;
    return{avg,students:classFilter==="SEMUA" ? rosterStudents : Math.max(attemptStudents,activeClasses.filter(c=>c.name===classFilter).reduce((sum,item)=>sum+item.studentRoster.length,0)),completed:filtered.length,passRate:filtered.length?Math.round(passed/filtered.length*100):0};
  },[filtered,classFilter,managedClasses]);
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
  const studentRosterRows=useMemo(()=>{
    if(!rosterClass)return[];
    return rosterClass.studentRoster.map((student,index)=>{
      const profile=selfRegistered.find(item=>item.localStudentId===student.id)
        || selfRegistered.find(item=>item.name===student.name);
      const presence=studentPresence.find(item=>item.classCode===rosterClass.code&&item.studentId===student.id);
      const own=attempts.filter(a=>
        a.studentId===student.id
        || (a.studentName===student.name&&(a.classCode===rosterClass.code||a.className===rosterClass.name))
      );
      const average=pct(own.map(a=>a.percentage));
      const best=own.length?Math.max(...own.map(a=>a.percentage)):0;
      const missingActive=(rosterClass.assignments||[]).filter(task=>
        task.active
        && (!task.targetStudentIds?.length||task.targetStudentIds.includes(student.id))
        && !own.some(a=>a.mode==="tugasan:"+task.id)
      ).length;
      const lastActivity=Math.max(profile?.updatedAt||0,presence?.lastLoginMs||0,...own.map(a=>a.completedAt||0));
      return{
        index,student,profile,presence,attempts:own,average,best,missingActive,lastActivity,
        logged:Boolean(profile),
        duplicate:Boolean(presence?.duplicate&&presence.duplicateUntilMs>Date.now()),
        needsIntervention:(own.length>0&&average<60)||missingActive>0,
      };
    });
  },[rosterClass,selfRegistered,studentPresence,attempts]);

  const visibleStudentRows=useMemo(()=>{
    const q=normalizeStudentName(studentSearch);
    return studentRosterRows.filter(row=>{
      if(q&&!row.student.name.includes(q))return false;
      if(studentStatusFilter==="logged"&&!row.logged)return false;
      if(studentStatusFilter==="new"&&row.logged)return false;
      if(studentStatusFilter==="intervention"&&!row.needsIntervention)return false;
      if(studentStatusFilter==="duplicate"&&!row.duplicate)return false;
      return true;
    });
  },[studentRosterRows,studentSearch,studentStatusFilter]);

  const studentClassStats={
    total:studentRosterRows.length,
    logged:studentRosterRows.filter(row=>row.logged).length,
    new:studentRosterRows.filter(row=>!row.logged).length,
    duplicate:studentRosterRows.filter(row=>row.duplicate).length,
  };
  const selectedStudentRow=studentRosterRows.find(row=>row.student.id===selectedStudentKey)||null;
  const selectedStudent:RegisteredStudent|null=selectedStudentRow&&rosterClass?{
    uid:selectedStudentRow.profile?.uid||("roster:"+selectedStudentRow.student.id),
    localStudentId:selectedStudentRow.student.id,
    name:selectedStudentRow.student.name,
    className:rosterClass.name,
    classCode:rosterClass.code,
    updatedAt:selectedStudentRow.profile?.updatedAt||selectedStudentRow.lastActivity||0,
  }:null;
  const selectedStudentAttempts=selectedStudentRow?.attempts||[];
  const selectedChapterPerformance=chapters.map(ch=>{
    const own=selectedStudentAttempts.filter(a=>a.chapter===ch.id);
    return{id:ch.id,avg:pct(own.map(a=>a.percentage)),count:own.length};
  }).filter(item=>item.count>0);
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
  const currentLive=liveItems.filter(x=>x.status==="active"&&now-x.updatedAt<5*60*1000);
  const duplicateSessions=studentPresence.filter(item=>item.duplicate&&item.duplicateUntilMs>now);
  const pendingTeachers=teacherProfiles.filter(item=>item.status==="pending");
  const adminTeacher=teacherProfiles.find(item=>item.uid===adminTeacherUid)||null;
  const adminTeacherClasses=adminTeacher?managedClasses.filter(item=>item.ownerTeacherId===adminTeacher.uid):[];
  const activeTeacherOptions=teacherProfiles.filter(item=>item.status==="active"&&item.active&&item.role!=="viewer");
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
    return <main className="auth-shell"><section className="auth-card">{gateBrand}<span className="eyebrow dark">PANEL GURU</span><h1>Log masuk belum tersedia</h1><p>Perkhidmatan log masuk belum tersedia. Cuba semula kemudian atau hubungi pentadbir.</p><a className="launch-button active full center" href="/">← Paparan utama</a></section></main>;
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
        :"Guru boleh daftar sendiri. Akaun hanya boleh digunakan selepas diluluskan oleh pentadbir."}</p>
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
      <small className="auth-note">Akaun guru baharu akan menunggu kelulusan pentadbir sebelum boleh digunakan.</small>
      <button className="legacy-admin-link" type="button" onClick={connectLegacyAdmin} disabled={authBusy}>Pentadbir lama? Pulihkan akses</button>
      <a className="launch-button full center" href="/">← Paparan utama</a>
    </section></main>;
  }

  if(!teacherProfile||!teacherProfile.active){
    const status=teacherProfile?.status||"pending";
    const title=!teacherProfile?"Profil belum tersedia":status==="pending"?"Menunggu kelulusan pentadbir":status==="rejected"?"Permohonan ditolak":"Akses dinyahaktifkan";
    return <main className="auth-shell"><section className="auth-card">
      {gateBrand}<span className="eyebrow dark">STATUS AKAUN GURU</span><h1>{title}</h1>
      <p>{authError||message||(!teacherProfile
        ?"Profil GeoBoost belum dijumpai untuk akaun ini."
        :status==="pending"
          ?"Pendaftaran telah diterima. Pentadbir akan menyemak permohonan anda."
          :status==="rejected"
            ?"Permohonan ini telah ditolak. Hubungi pentadbir jika perlu semakan semula."
            :"Akaun ini dinyahaktifkan sementara oleh pentadbir.")}</p>
      <div className="teacher-bootstrap"><div><small>AKAUN</small><b>{teacherProfile?.name||"Guru"}</b><span>{teacherEmail||authUser.email||""}</span></div><span className={"teacher-status "+status}>{teacherStatusLabel(status)}</span></div>
      {!teacherProfile?<div className="missing-profile-actions"><label>Nama penuh<input value={registerName} onChange={e=>setRegisterName(e.target.value)} placeholder="Nama untuk permohonan guru"/></label><button className="primary" onClick={submitMissingTeacherProfile} disabled={authBusy||!registerName.trim()}>Hantar Permohonan Guru</button><button className="legacy-admin-link full" onClick={bootstrapFirstAdmin} disabled={deployingRules}>{deployingRules?"Menyediakan akses...":"Pulihkan Akses Pentadbir"}</button></div>:null}
      <small className="auth-note">Selepas diluluskan, log masuk semula atau muat semula halaman ini.</small>
      <button className="launch-button full" onClick={disconnectTeacher}>Log keluar / guna akaun lain</button>
    </section></main>;
  }

  return <main className="teacher-app">
    <aside className={"teacher-sidebar "+(mobileSidebarOpen?"mobile-open":"")}>
      <div className="teacher-side-top"><a className="teacher-side-brand" href="/"><span className="brand-mark">G</span><span><b>GEOBOOST</b><small>PANEL GURU</small></span></a><button className="teacher-sidebar-close" onClick={()=>setMobileSidebarOpen(false)} aria-label="Tutup menu">×</button></div>
      <nav>{navItems.map(item=><button key={item.id} className={activeSection===item.id?"active":""} onClick={()=>{setActiveSection(item.id);setMobileSidebarOpen(false)}}><span>{item.icon}</span>{item.label}{item.id==="students"&&studentClassStats.duplicate>0?<i>{studentClassStats.duplicate}</i>:null}{item.id==="teachers"&&pendingTeachers.length>0?<i>{pendingTeachers.length}</i>:null}</button>)}</nav>
      <div className="teacher-side-account"><b>{teacherProfile?.name||"Guru"}</b><small>{teacherRoleLabel(teacherProfile?.role)} · {teacherEmail||""}</small>{firebaseConfigured?<button onClick={disconnectTeacher}>Log keluar</button>:null}<a href="/">← Paparan utama</a></div>
    </aside>
    {mobileSidebarOpen?<button className="teacher-sidebar-backdrop" aria-label="Tutup menu" onClick={()=>setMobileSidebarOpen(false)}/>:null}

    <div className="teacher-main">
      <header className="teacher-mobile-nav"><button className="teacher-menu-button" onClick={()=>setMobileSidebarOpen(true)} aria-label="Buka menu">☰</button><a className="brand" href="/"><span className="brand-mark">G</span><span><b>GEOBOOST</b><small>{navItems.find(item=>item.id===activeSection)?.label||"GURU"}</small></span></a><span className="teacher-mobile-role">{teacherRoleLabel(teacherProfile?.role)}</span></header>
      <section className="teacher-head"><span className="eyebrow dark">PANEL GURU</span><h1>{navItems.find(x=>x.id===activeSection)?.label||"GeoBoost Guru"}</h1><p>Urus kelas, murid, tugasan dan prestasi dalam satu tempat.</p>{isAdmin&&studentLoginMode!=="double-confirm"?<div className="multi-teacher-activation-banner"><div><strong>⚡ Tetapan akaun guru perlu dilengkapkan</strong><span>Lengkapkan tetapan sekali supaya pendaftaran dan kelulusan guru dapat digunakan.</span></div><button onClick={activateMultiTeacher} disabled={deployingRules}>{deployingRules?"Menyediakan...":"Lengkapkan Tetapan"}</button></div>:null}{!canEdit&&source==="firebase"?<div className="teacher-message">👁️ Paparan sahaja aktif — perubahan tidak dibenarkan.</div>:null}{message?<div className="teacher-message">{message}</div>:null}</section>

      <section className="teacher-content">
        {activeSection==="dashboard"?<>
          <div className="teacher-stats"><div><small>Murid</small><b>{stats.students}</b></div><div><small>Latihan selesai</small><b>{stats.completed}</b></div><div><small>Purata</small><b>{stats.avg}%</b></div><div><small>Kadar ≥60%</small><b>{stats.passRate}%</b></div><div><small>Aktif sekarang</small><b>{currentLive.filter(x=>x.status==="active").length}</b></div></div>
          <div className="teacher-grid"><section className="panel"><div className="panel-title"><div><small>TERKINI</small><h2>Percubaan murid</h2></div><span>{attempts.length}</span></div>{attempts.length?<div className="attempt-table">{attempts.slice(0,12).map(a=><div className="attempt-row" key={a.id}><div><strong>{a.studentName}</strong><small>{a.className} · {a.chapter?"Bab "+a.chapter:(a.label||a.mode)}</small></div><b>{a.percentage}%</b><span>{new Date(a.completedAt).toLocaleDateString("ms-MY")}</span></div>)}</div>:<div className="panel-empty">Belum ada rekod.</div>}</section><section className="panel"><div className="panel-title"><div><small>PERLU TINDAKAN</small><h2>Cadangan Pemulihan</h2></div><span>{interventionRows.length}</span></div>{interventionRows.slice(0,6).map(x=><div className="intervention-mini" key={x.student.uid}><div><b>{x.student.name}</b><small>{x.student.className} · {x.weakTopic}</small></div><span>{x.average}%</span></div>)}</section></div>
        </>:null}

        {activeSection==="classes"?<section className="panel class-manager">
          <div className="panel-title"><div><small>PENGURUSAN KELAS</small><h2>Urus Kelas</h2><p className="class-help">Tambah kelas, buka bab dan kongsi akses kepada murid.</p></div><span>{managedClasses.length}</span></div>
          <div className="class-create"><input value={newClassName} onChange={e=>setNewClassName(e.target.value)} placeholder="Nama kelas · 2E"/><input value={newClassCode} onChange={e=>setNewClassCode(e.target.value)} placeholder="Kod · 2E26"/><input value={newClassYear} onChange={e=>setNewClassYear(e.target.value)} placeholder="Tahun"/><button onClick={addClass} disabled={!canEdit||!newClassName.trim()||!newClassCode.trim()}>Tambah kelas</button></div>
          <div className="class-cards">{managedClasses.map(item=><article key={item.code} className={"class-admin-card "+(item.archived?"archived":"")}><div className="class-admin-head"><div><strong>{item.name}</strong><small>{item.code} · {item.academicYear} · {item.studentNames.length} murid · {item.openChapters.length}/10 bab</small></div><div className="class-actions"><button onClick={()=>showQr(item)}>QR</button><button onClick={()=>copyStudentLink(item.code)}>Salin Pautan</button><button onClick={()=>archiveClass(item.code,!item.archived)} disabled={!canManageClassCode(item.code)}>{item.archived?"Aktifkan":"Arkib"}</button><button className="danger" onClick={()=>deleteClass(item.code)} disabled={!canManageClassCode(item.code)}>Padam</button></div></div>{!item.archived?<div className="chapter-access-grid">{chapters.map(ch=><button key={ch.id} className={item.openChapters.includes(ch.id)?"open":"closed"} disabled={!canManageClassCode(item.code)} onClick={()=>toggleChapter(item.code,ch.id)}><span>Bab {ch.id}</span><b>{item.openChapters.includes(ch.id)?"Dibuka":"Ditutup"}</b></button>)}</div>:<div className="archive-banner">📦 Kelas ini telah diarkibkan dan tidak boleh digunakan oleh murid.</div>}</article>)}</div>
        </section>:null}

        {activeSection==="students"?<section className="panel roster-manager student-manager-v2">
          <div className="student-manager-head">
            <div><small>PENGURUSAN MURID</small><h2>Senarai & profil murid</h2><p>Pilih kelas, cari murid dan klik nama untuk lihat prestasi lengkap.</p></div>
            <label>Kelas<select value={rosterClassCode} onChange={e=>{setRosterClassCode(e.target.value);setSelectedStudentKey("");setMobileStudentProfile(false)}}>{activeClasses.map(c=><option key={c.code} value={c.code}>{c.name} · {c.code}</option>)}</select></label>
          </div>

          {!activeClasses.length?<div className="panel-empty">Cipta atau aktifkan kelas dahulu.</div>:<>
            <div className="student-class-stats">
              <div><span>Jumlah Murid</span><b>{studentClassStats.total}</b></div>
              <div><span>Pernah Masuk</span><b>{studentClassStats.logged}</b></div>
              <div><span>Belum Masuk</span><b>{studentClassStats.new}</b></div>
              <div className={studentClassStats.duplicate?"warn":""}><span>2+ Peranti</span><b>{studentClassStats.duplicate}</b></div>
            </div>

            <div className="student-toolbar-v2">
              <div className="student-search-box"><span>⌕</span><input value={studentSearch} onChange={e=>setStudentSearch(e.target.value)} placeholder="Cari nama murid..."/></div>
              <button className="student-add-button" onClick={()=>setStudentAddOpen(true)} disabled={!canManageClassCode(rosterClassCode)}>+ Tambah Murid</button>
              <label className="student-import-button">{importing?"Memasukkan senarai...":"⇧ Import Excel / CSV"}<input type="file" accept=".xlsx,.xls,.csv,.txt" disabled={!canManageClassCode(rosterClassCode)||importing} onChange={importStudents}/></label>
            </div>

            <div className="student-filter-pills">
              {[
                ["all","Semua",studentClassStats.total],
                ["logged","Pernah Masuk",studentClassStats.logged],
                ["new","Belum Masuk",studentClassStats.new],
                ["intervention","Perlu Pemulihan",studentRosterRows.filter(row=>row.needsIntervention).length],
                ["duplicate","2+ Peranti",studentClassStats.duplicate],
              ].map(([id,label,count])=><button key={String(id)} className={studentStatusFilter===id?"active":""} onClick={()=>setStudentStatusFilter(id as typeof studentStatusFilter)}>{label}<b>{count}</b></button>)}
            </div>

            <div className={"student-admin-layout modern "+(mobileStudentProfile?"show-profile":"")}>
              <div className="student-roster-pane">
                <div className="student-list-head"><span>#</span><span>Nama Murid</span><span>Status</span><span>Prestasi</span><span>Aktiviti</span><span/></div>
                <div className="student-roster-modern">
                  {visibleStudentRows.length?visibleStudentRows.map(row=><div key={row.student.id} className={"student-row-modern "+(selectedStudentKey===row.student.id?"selected":"")} onClick={()=>{setSelectedStudentKey(row.student.id);setMobileStudentProfile(true)}}>
                    <span className="student-index">{row.index+1}</span>
                    <div className="student-name-cell"><strong>{row.student.name}</strong><small>{rosterClass?.name} · {rosterClass?.code}</small></div>
                    <div className="student-status-cell">{row.duplicate?<span className="status-chip duplicate">⚠ 2+ peranti</span>:row.logged?<span className="status-chip logged">● Pernah masuk</span>:<span className="status-chip new">○ Belum masuk</span>}</div>
                    <div className="student-performance-cell"><b>{row.attempts.length?row.average+"%":"—"}</b><small>{row.attempts.length} percubaan</small></div>
                    <div className="student-activity-cell">{row.lastActivity?<><b>{new Date(row.lastActivity).toLocaleDateString("ms-MY")}</b><small>{new Date(row.lastActivity).toLocaleTimeString("ms-MY",{hour:"2-digit",minute:"2-digit"})}</small></>:<span>—</span>}</div>
                    <button className="student-row-arrow" aria-label={"Buka profil "+row.student.name}>›</button>
                  </div>):<div className="panel-empty">Tiada murid sepadan dengan carian atau penapis ini.</div>}
                </div>
              </div>

              <aside className="student-profile-card student-profile-v2">
                {selectedStudentRow&&selectedStudent?<>
                  <button className="student-profile-back" onClick={()=>setMobileStudentProfile(false)}>← Senarai murid</button>
                  <div className="student-profile-identity"><span>{selectedStudent.name.slice(0,1)}</span><div><small>PROFIL MURID</small><h3>{selectedStudent.name}</h3><p>{selectedStudent.className} · {selectedStudent.classCode}</p></div></div>
                  <div className="student-profile-status">{selectedStudentRow.duplicate?<span className="status-chip duplicate">⚠ Digunakan pada lebih daripada satu peranti</span>:selectedStudentRow.logged?<span className="status-chip logged">● Pernah masuk GeoBoost</span>:<span className="status-chip new">○ Belum pernah masuk</span>}</div>

                  <div className="profile-metrics profile-metrics-v2">
                    <div><span>Purata</span><b>{selectedStudentRow.attempts.length?selectedStudentRow.average+"%":"—"}</b></div>
                    <div><span>Terbaik</span><b>{selectedStudentRow.attempts.length?selectedStudentRow.best+"%":"—"}</b></div>
                    <div><span>Percubaan</span><b>{selectedStudentRow.attempts.length}</b></div>
                  </div>

                  <div className="student-profile-section"><div className="subsection-title"><strong>Prestasi Mengikut Bab</strong><span>{selectedChapterPerformance.length}</span></div>
                    {selectedChapterPerformance.length?<div className="student-chapter-performance">{selectedChapterPerformance.map(item=><div key={item.id}><span>Bab {item.id}</span><div><i style={{width:item.avg+"%"}}/></div><b>{item.avg}%</b></div>)}</div>:<div className="student-empty-mini">Belum ada latihan bab direkodkan.</div>}
                  </div>

                  <div className="student-profile-section"><div className="subsection-title"><strong>Aktiviti Terkini</strong><span>{selectedStudentAttempts.length}</span></div>
                    {selectedStudentAttempts.length?<div className="student-recent-attempts">{selectedStudentAttempts.slice(0,6).map(a=><div key={a.id}><div><b>{a.chapter?"Bab "+a.chapter:(a.label||"Latihan")}</b><small>{new Date(a.completedAt).toLocaleDateString("ms-MY")}</small></div><strong>{a.percentage}%</strong></div>)}</div>:<div className="student-empty-mini">Murid ini belum mempunyai rekod latihan.</div>}
                  </div>

                  {selectedStudentRow.duplicate?<div className="student-duplicate-action"><div><strong>⚠️ Lebih daripada satu peranti</strong><small>Kosongkan akses jika penggunaan pada beberapa peranti perlu dihentikan.</small></div><button onClick={()=>clearStudentSession(selectedStudentRow.student)} disabled={!canManageClassCode(rosterClassCode)}>Kosongkan Akses Peranti</button></div>:null}

                  <div className="student-profile-actions">
                    <button className="intervention-button" disabled={!canManageClassCode(selectedStudent.classCode)} onClick={()=>createIntervention(selectedStudent)}>🎯 Beri Latihan Pemulihan</button>
                    <button className="student-remove-button" disabled={!canManageClassCode(rosterClassCode)} onClick={()=>removeStudentFromRoster(selectedStudentRow.student)}>Buang dari kelas</button>
                  </div>
                </>:<div className="student-profile-empty"><span>👤</span><h3>Pilih murid</h3><p>Klik mana-mana murid untuk melihat status penggunaan, prestasi dan aktiviti.</p></div>}
              </aside>
            </div>

            {studentAddOpen?<div className="student-modal-backdrop" onMouseDown={()=>setStudentAddOpen(false)}><div className="student-modal" onMouseDown={e=>e.stopPropagation()}>
              <div><small>TAMBAH MURID</small><h3>{rosterClass?.name}</h3><p>Nama akan terus dimasukkan ke senarai kelas ini.</p></div>
              <label>Nama penuh murid<input autoFocus value={manualStudentName} onChange={e=>setManualStudentName(e.target.value)} placeholder="Contoh: AHMAD BIN ALI" onKeyDown={async e=>{if(e.key==="Enter"&&manualStudentName.trim()){await addStudentToRoster();setStudentAddOpen(false)}}}/></label>
              <div className="student-modal-actions"><button onClick={()=>{setStudentAddOpen(false);setManualStudentName("")}}>Batal</button><button className="primary" disabled={!manualStudentName.trim()} onClick={async()=>{await addStudentToRoster();setStudentAddOpen(false)}}>Tambah Murid</button></div>
            </div></div>:null}
          </>}
        </section>:null}

        {activeSection==="assignments"?<section className="panel assignment-manager">
          <div className="panel-title"><div><small>TUGASAN KELAS</small><h2>Cipta & Pantau Tugasan</h2></div><span>{managedClasses.reduce((s,c)=>s+c.assignments.length,0)}</span></div>
          {!activeClasses.length?<div className="panel-empty">Cipta kelas dahulu.</div>:<><div className="assignment-create"><label>Kelas<select value={assignmentClassCode} onChange={e=>setAssignmentClassCode(e.target.value)}>{activeClasses.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label><label>Tajuk<input value={assignmentTitle} onChange={e=>setAssignmentTitle(e.target.value)} placeholder="Pengukuhan Bab 7"/></label><label>Bab<select value={assignmentChapter} onChange={e=>setAssignmentChapter(Number(e.target.value))}>{chapters.map(ch=><option key={ch.id} value={ch.id}>Bab {ch.id}</option>)}</select></label><label>Soalan<select value={assignmentCount} onChange={e=>setAssignmentCount(Number(e.target.value))}>{[5,10,15,20,30].map(n=><option key={n}>{n}</option>)}</select></label><label>Had cubaan<select value={assignmentMax} onChange={e=>setAssignmentMax(Number(e.target.value))}>{[1,2,3,5,10].map(n=><option key={n}>{n}</option>)}</select></label><label>Tarikh akhir<input type="date" value={assignmentDue} onChange={e=>setAssignmentDue(e.target.value)}/></label><button onClick={()=>createAssignment()} disabled={!canManageClassCode(assignmentClassCode)||!assignmentTitle.trim()}>Terbitkan</button></div>
          {bankSelection.length?<div className="selected-bank-banner">🗂️ {bankSelection.length} soalan dipilih daripada Bank Soalan. <button onClick={()=>createAssignment({questionIds:bankSelection,count:bankSelection.length})} disabled={!canManageClassCode(assignmentClassCode)||!assignmentTitle.trim()}>Guna sebagai set tugasan</button></div>:null}
          <div className="assignment-list">{assignmentRows.length?assignmentRows.map(({item,completed,total,avg,missing})=><div key={item.id} className="assignment-row-rich"><div><strong>{item.title}</strong><small>Bab {item.chapter} · {item.questionIds?.length?item.questionIds.length+" soalan dipilih":item.questionCount+" soalan"} · maks {item.maxAttempts||3} cubaan{item.dueDate?" · akhir "+new Date(item.dueDate+"T00:00:00").toLocaleDateString("ms-MY"):""}</small><em>{completed}/{total} selesai · purata {avg}%{missing.length?" · belum: "+missing.slice(0,4).join(", ")+(missing.length>4?"…":""):""}</em></div><span className={item.active?"active":"inactive"}>{item.active?"Aktif":"Ditutup"}</span><button disabled={!assignmentClass||!canManageClassCode(assignmentClass.code)} onClick={()=>toggleAssignmentActive(assignmentClass!.code,item.id)}>{item.active?"Tutup":"Buka"}</button><button className="danger" disabled={!assignmentClass||!canManageClassCode(assignmentClass.code)} onClick={()=>removeAssignmentItem(assignmentClass!.code,item.id)}>Padam</button></div>):<div className="panel-empty">Belum ada tugasan.</div>}</div></>}
        </section>:null}

        {activeSection==="live"?<section className="panel live-panel">
          <div className="panel-title"><div><small>AKTIVITI MURID</small><h2>Aktiviti Semasa</h2></div><span>{currentLive.length}</span></div>
          <p className="class-help">Status berubah apabila murid bergerak ke soalan seterusnya. Hanya aktiviti dalam 5 minit terakhir dianggap aktif.</p>
          {currentLive.length?<div className="live-grid">{currentLive.map(item=><div key={item.uid}><span className={"live-dot "+item.status}/><div><strong>{item.studentName}</strong><small>{item.className} · {item.title}</small></div><b>{item.status==="complete"?"Selesai":item.current+"/"+item.total}</b><em>{item.total?Math.round(item.current/item.total*100):0}%</em></div>)}</div>:<div className="panel-empty">Tiada murid aktif dalam 5 minit terakhir.</div>}
          {duplicateSessions.length?<div className="duplicate-session-box"><strong>⚠️ Nama digunakan pada beberapa peranti</strong><p>Nama berikut baru digunakan pada lebih daripada satu peranti. Semak jika perlu.</p>{duplicateSessions.slice(0,12).map(item=><div key={item.id}><span>{item.studentName}</span><small>{managedClasses.find(c=>c.code===item.classCode)?.name||item.classCode}</small><b>2+ peranti</b></div>)}</div>:null}
        </section>:null}

        {activeSection==="interventions"?<section className="panel intervention-panel">
          <div className="panel-title"><div><small>CADANGAN PEMULIHAN</small><h2>Murid Perlu Perhatian</h2></div><span>{interventionRows.length}</span></div>
          {interventionRows.length?<div className="intervention-table">{interventionRows.map(x=><div key={x.student.uid}><div><strong>{x.student.name}</strong><small>{x.student.className} · {x.attempts} percubaan</small></div><span>Purata <b>{x.average}%</b></span><span>Tugasan belum siap <b>{x.missing}</b></span><span>Fokus <b>{x.weakTopic}</b></span><button disabled={!canManageClassCode(x.student.classCode)} onClick={()=>createIntervention(x.student)}>Beri Pemulihan</button></div>)}</div>:<div className="panel-empty">Tiada murid dikesan memerlukan pemulihan berdasarkan rekod semasa.</div>}
        </section>:null}

        {activeSection==="analytics"?<>{filterBar}<div className="report-actions"><button onClick={()=>downloadCsv(filtered)} disabled={!filtered.length}>Eksport CSV</button><button onClick={()=>window.print()} disabled={!filtered.length}>Cetak / Simpan PDF</button></div><div className="teacher-grid"><section className="panel"><div className="panel-title"><div><small>SUBTOPIK</small><h2>Perlu perhatian</h2></div></div>{weak.length?weak.map(([topic,count],i)=><div className="weak-row detailed" key={topic}><span>#{i+1}</span><div><i style={{width:Math.min(100,count*12)+"%"}}/></div><b>{count}</b><small>{topic}</small></div>):<div className="panel-empty">Belum ada data.</div>}</section><section className="panel"><div className="panel-title"><div><small>PERBANDINGAN</small><h2>Prestasi kelas</h2></div></div><div className="class-compare">{classComparison.map(c=><div key={c.code}><div><b>{c.name}</b><small>{c.students} murid · {c.attempts} percubaan</small></div><span>{c.avg}%</span><em>≥60%: {c.pass}%</em></div>)}</div></section></div>
          <section className="panel"><div className="panel-title"><div><small>ANALISIS ITEM</small><h2>Soalan paling kerap salah / tidak pasti</h2></div></div>{missedItems.length?<div className="item-analysis">{missedItems.map(x=>{const q=[...questions,...customQuestions].find(q=>q.id===x.id);return <div key={x.id}><span>{x.id}</span><div><strong>{q?.prompt||"Soalan"}</strong><small>{x.wrong}/{x.total} salah · {x.unsure} tidak pasti</small></div><b>{x.rate}%</b></div>})}</div>:<div className="panel-empty">Belum ada data.</div>}</section>
        </>:null}

        {activeSection==="reports"?<section className="panel report-panel">
          <div className="report-print-header"><b>GEOBOOST TINGKATAN 2</b><h2>Laporan Prestasi Murid</h2><span>By Cikgu Zulhasif · {new Date().toLocaleDateString("ms-MY")}</span></div>
          <div className="panel-title"><div><small>LAPORAN</small><h2>Prestasi kelas / bab</h2></div><div className="report-actions"><button onClick={()=>downloadCsv(filtered)} disabled={!filtered.length}>Eksport CSV</button><button onClick={()=>window.print()} disabled={!filtered.length}>Cetak / Simpan PDF</button></div></div>{filterBar}
          <div className="report-summary"><div><span>Murid</span><b>{stats.students}</b></div><div><span>Percubaan</span><b>{stats.completed}</b></div><div><span>Purata</span><b>{stats.avg}%</b></div><div><span>≥60%</span><b>{stats.passRate}%</b></div></div>
          {filtered.length?<table className="report-table"><thead><tr><th>Nama</th><th>Kelas</th><th>Bab / Aktiviti</th><th>Markah</th><th>%</th><th>Tarikh</th><th className="no-print">Tindakan</th></tr></thead><tbody>{filtered.map(a=><tr key={a.id}><td>{a.studentName}</td><td>{a.className}</td><td>{a.chapter?"Bab "+a.chapter:a.mode}</td><td>{a.score}/{a.total}</td><td>{a.percentage}%</td><td>{new Date(a.completedAt).toLocaleDateString("ms-MY")}</td><td className="no-print"><button className="reset-attempt" disabled={!canEdit} onClick={()=>resetAttempt(a.id)}>Padam Rekod</button></td></tr>)}</tbody></table>:<div className="panel-empty">Tiada rekod.</div>}
        </section>:null}

        {activeSection==="notes"?<VisualNotesAdmin canEdit={canEdit}/>:null}

        {activeSection==="bank"?<><VisualNotesAdmin canEdit={canEdit}/><section className="panel bank-manager">
          <div className="panel-title"><div><small>BANK SOALAN</small><h2>{questions.length} soalan asal + {customQuestions.filter(q=>q.active).length} soalan tambahan</h2></div><span>{bankSelection.length} dipilih</span></div>
          <div className="bank-toolbar"><label>Bab<select value={bankChapter} onChange={e=>{setBankChapter(Number(e.target.value));setQuestionForm(f=>({...f,chapter:Number(e.target.value),subtopic:e.target.value+".1"}))}}>{chapters.map(ch=><option key={ch.id} value={ch.id}>Bab {ch.id} · {ch.title}</option>)}</select></label><div><button onClick={makeWorksheet} disabled={!bankSelection.length}>Jana Lembaran Kerja</button><button onClick={()=>setBankSelection([])} disabled={!bankSelection.length}>Kosongkan pilihan</button></div></div>
          {canEdit?<div className="question-editor"><div className="question-editor-title"><b>{questionForm.id?"Edit "+questionForm.id:"Tambah Soalan Baharu"}</b>{questionForm.id?<button onClick={()=>setQuestionForm({id:"",chapter:bankChapter,subtopic:bankChapter+".1",difficulty:"medium",type:"mcq",prompt:"",a:"",b:"",c:"",d:"",answer:"A",explanation:""})}>Batal edit</button>:null}</div><div className="question-editor-grid"><label>Bab<input type="number" min="1" max="10" value={questionForm.chapter} onChange={e=>setQuestionForm(f=>({...f,chapter:Number(e.target.value)}))}/></label><label>Subtopik<input value={questionForm.subtopic} onChange={e=>setQuestionForm(f=>({...f,subtopic:e.target.value}))}/></label><label>Aras<select value={questionForm.difficulty} onChange={e=>setQuestionForm(f=>({...f,difficulty:e.target.value as Difficulty}))}><option value="easy">Mudah</option><option value="medium">Sederhana</option><option value="kbat">KBAT</option></select></label><label>Jawapan<select value={questionForm.answer} onChange={e=>setQuestionForm(f=>({...f,answer:e.target.value}))}>{["A","B","C","D"].map(x=><option key={x}>{x}</option>)}</select></label></div><label>Soalan<textarea value={questionForm.prompt} onChange={e=>setQuestionForm(f=>({...f,prompt:e.target.value}))}/></label><div className="question-options-edit">{(["a","b","c","d"] as const).map((key,i)=><label key={key}>{String.fromCharCode(65+i)}<input value={questionForm[key]} onChange={e=>setQuestionForm(f=>({...f,[key]:e.target.value}))}/></label>)}</div><label>Penerangan<textarea value={questionForm.explanation} onChange={e=>setQuestionForm(f=>({...f,explanation:e.target.value}))}/></label><button className="primary" onClick={saveQuestion}>Simpan Soalan</button></div>:null}
          <div className="bank-list selectable">{bankItems.map(q=>{const custom=(q as any).custom===true;return <div key={q.id} className={bankSelection.includes(q.id)?"selected":""}><input type="checkbox" checked={bankSelection.includes(q.id)} onChange={e=>setBankSelection(s=>e.target.checked?[...new Set([...s,q.id])]:s.filter(id=>id!==q.id))}/><span>{q.id}</span><div><strong>{q.prompt}</strong><small>{q.subtopic} · {custom?"TAMBAHAN":"ASAL"}</small></div><b className={"difficulty "+q.difficulty}>{q.difficulty==="easy"?"MUDAH":q.difficulty==="medium"?"SEDERHANA":"KBAT"}</b>{custom?<div className="bank-actions"><button onClick={()=>editQuestion(q as CustomQuestion)}>Edit</button><button onClick={()=>archiveQuestion(q.id,false)}>Arkib</button><button className="danger" onClick={()=>removeQuestion(q.id)}>Padam</button></div>:null}</div>})}</div>
        </section></>:null}

        {activeSection==="teachers"&&isAdmin?<div className="teacher-management-grid">
          <section className="panel teacher-directory-panel">
            <div className="panel-title"><div><small>PENGURUSAN GURU</small><h2>Akaun & permohonan guru</h2></div><span>{pendingTeachers.length} menunggu</span></div>
            <p className="class-help">Guru baharu daftar sendiri. Pentadbir menyemak, meluluskan dan mengurus akses dari sini.</p>
            <div className="teacher-admin-list">{teacherProfiles.map(t=>{
              const count=managedClasses.filter(c=>c.ownerTeacherId===t.uid).length;
              return <button key={t.uid} className={adminTeacherUid===t.uid?"selected":""} onClick={()=>{setAdminTeacherUid(t.uid);setAdminEditUntil(0);setAdminEditPassword("")}}>
                <div><strong>{t.name}</strong><small>{t.email||"Tiada email"} · {count} kelas</small></div>
                <span className={"teacher-status "+(t.status||"active")}>{teacherStatusLabel(t.status)}</span>
                <b>{teacherRoleLabel(t.role)}</b>
              </button>
            })}</div>
          </section>
          <section className="panel teacher-detail-panel">
            {!adminTeacher?<div className="panel-empty">Pilih seorang guru untuk melihat profil, kelas dan aksesnya.</div>:<>
              <div className="panel-title"><div><small>PROFIL GURU</small><h2>{adminTeacher.name}</h2></div><span className={"teacher-status "+(adminTeacher.status||"active")}>{teacherStatusLabel(adminTeacher.status)}</span></div>
              <div className="teacher-detail-meta"><div><span>Email</span><b>{adminTeacher.email||"-"}</b></div><div><span>Jenis Akses</span><b>{teacherRoleLabel(adminTeacher.role)}</b></div><div><span>Kelas</span><b>{adminTeacherClasses.length}</b></div><div><span>Murid</span><b>{adminTeacherClasses.reduce((s,item)=>s+item.studentRoster.length,0)}</b></div></div>

              <div className={"admin-edit-banner "+(adminEditActive?"active":"view")}><strong>{adminEditActive?"✏️ SUNTINGAN PENTADBIR":"👁️ PAPARAN SAHAJA"}</strong><span>{adminEditActive?"Suntingan dibenarkan selama 15 minit selepas pengesahan kata laluan.":"Maklumat guru boleh dilihat tetapi tidak boleh diubah."}</span>{adminEditActive?<button onClick={leaveAdminEdit}>Tamatkan Suntingan</button>:null}</div>

              {!adminEditActive?<div className="admin-reauth-box"><label>Sahkan kata laluan pentadbir<input type="password" value={adminEditPassword} onChange={e=>setAdminEditPassword(e.target.value)} placeholder="Kata laluan pentadbir"/></label><button className="primary" onClick={beginAdminEdit} disabled={!adminEditPassword}>Benarkan Suntingan · 15 minit</button><small>Pentadbir kekal menggunakan akaun sendiri. Semua perubahan direkodkan.</small></div>:<div className="teacher-edit-controls">
                <div className="teacher-control-row"><div><strong>Status akaun</strong><small>Luluskan, gantung atau tolak akses.</small></div>
                  {adminTeacher.status!=="active"?<button onClick={()=>updateTeacherAccess(adminTeacher,{status:"active",active:true},"GURU_LULUS")}>Luluskan / Aktifkan</button>:<button disabled={adminTeacher.uid===teacherUid} onClick={()=>updateTeacherAccess(adminTeacher,{status:"suspended",active:false},"GURU_GANTUNG")}>Nyahaktif</button>}
                  {adminTeacher.status!=="rejected"&&adminTeacher.uid!==teacherUid?<button className="danger" onClick={()=>updateTeacherAccess(adminTeacher,{status:"rejected",active:false},"GURU_TOLAK")}>Tolak</button>:null}
                </div>
                <div className="teacher-control-row"><div><strong>Jenis Akses</strong><small>Pentadbir mempunyai semua fungsi guru.</small></div><select value={adminTeacher.role} disabled={adminTeacher.uid===teacherUid} onChange={e=>updateTeacherAccess(adminTeacher,{role:e.target.value as "admin"|"guru"|"viewer"},"GURU_ROLE")}><option value="guru">Guru</option><option value="viewer">Paparan Sahaja</option><option value="admin">Pentadbir</option></select></div>
                <div className="teacher-control-row"><div><strong>Nama paparan</strong><small>{adminTeacher.name}</small></div><button onClick={()=>{const name=window.prompt("Nama guru",adminTeacher.name);if(name?.trim())void updateTeacherAccess(adminTeacher,{name:name.trim()},"GURU_NAMA")}}>Edit nama</button></div>
              </div>}

              <div className="teacher-owned-classes"><div className="subsection-title"><strong>Kelas milik guru</strong><span>{adminTeacherClasses.length}</span></div>
                {adminTeacherClasses.length?adminTeacherClasses.map(cls=><div key={cls.code} className="teacher-owned-class"><div><b>{cls.name}</b><small>{cls.code} · {cls.studentRoster.length} murid · {cls.assignments.length} tugasan</small></div>{adminEditActive?<><select value={adminTransferTarget[cls.code]||""} onChange={e=>setAdminTransferTarget(x=>({...x,[cls.code]:e.target.value}))}><option value="">Tukar kepada...</option>{activeTeacherOptions.filter(t=>t.uid!==adminTeacher.uid).map(t=><option key={t.uid} value={t.uid}>{t.name} · {teacherRoleLabel(t.role)}</option>)}</select><button disabled={!adminTransferTarget[cls.code]} onClick={()=>moveClassOwner(cls.code,adminTransferTarget[cls.code])}>Tukar Guru</button></>:<span>Lihat Sahaja</span>}</div>):<div className="panel-empty">Guru ini belum mempunyai kelas.</div>}
              </div>
            </>}
          </section>
        </div>:null}

        {activeSection==="settings"?<section className="settings-stack">
          <section className="panel settings-panel">
            <div className="panel-title"><div><small>TETAPAN AKAUN</small><h2>Maklumat & Salinan Data</h2></div><button onClick={backup}>Simpan Salinan Data</button></div>
            <div className="settings-grid">
              <div><span>Nama</span><b>{teacherProfile?.name||"Guru"}</b></div>
              <div><span>Jenis Akses</span><b>{teacherRoleLabel(teacherProfile?.role)}</b></div>
              <div><span>Kelas aktif</span><b>{activeClasses.length}</b></div>
              <div><span>Bank Soalan</span><b>{questions.length+customQuestions.filter(q=>q.active).length}</b></div>
            </div>
            <div className="settings-note"><strong>Salinan Data</strong><p>Simpan salinan kelas, murid, rekod percubaan, soalan tambahan dan aktiviti pentadbiran untuk rujukan.</p></div>
          </section>

          {isAdmin?<section className="panel">
            <div className="panel-title"><div><small>STATUS SISTEM</small><h2>{studentLoginMode==="double-confirm"?"Sistem Berfungsi Dengan Baik":"Tetapan Perlu Disemak"}</h2></div><span>{studentLoginMode==="double-confirm"?"BAIK":"SEMAK"}</span></div>
            <p className="class-help">Gunakan semakan ini jika pendaftaran guru, kemasukan murid atau penyimpanan rekod tidak berjalan seperti biasa.</p>
            <div className="settings-action-row"><button className="primary" onClick={activateMultiTeacher} disabled={deployingRules}>{deployingRules?"Menyemak...":"Semak Semula Sistem"}</button></div>
          </section>:null}

          {isAdmin?<section className="panel">
            <div className="panel-title"><div><small>AKAUN PENTADBIR</small><h2>Kata Laluan Pentadbir</h2></div></div>
            <p className="class-help">Tetapkan kata laluan untuk memastikan akaun pentadbir boleh digunakan dengan selamat.</p>
            <div className="admin-password-setup"><input type="password" minLength={6} value={adminNewPassword} onChange={e=>setAdminNewPassword(e.target.value)} placeholder="Kata laluan baharu · minimum 6 aksara"/><button onClick={setAdminPassword} disabled={adminNewPassword.length<6}>Tetapkan Kata Laluan</button></div>
            <small className="auth-note">Email: {teacherEmail}</small>
          </section>:null}

          <section className="panel">
            <div className="panel-title"><div><small>REKOD AKTIVITI</small><h2>Aktiviti Pentadbiran</h2></div><span>{auditLogs.length}</span></div>
            <div className="audit-list">{auditLogs.slice(0,40).map(a=><div key={a.id}><b>{auditActionLabel(a.action)}</b><span>{auditDetailLabel(a.detail)}</span><small>{a.by} · {new Date(a.createdAt).toLocaleString("ms-MY")}</small></div>)}</div>
          </section>
        </section>:null}
      </section>
    </div>

    {qrData?<div className="qr-modal" onClick={()=>setQrData(null)}><div onClick={e=>e.stopPropagation()}><button className="qr-close" onClick={()=>setQrData(null)}>×</button><small>QR KELAS</small><h2>{qrData.name}</h2><img src={qrData.image} alt={"QR "+qrData.code}/><b>{qrData.code}</b><p>Imbas QR → pilih nama → masuk GeoBoost.</p><div><button onClick={()=>navigator.clipboard.writeText(qrData.url)}>Salin Pautan</button><button onClick={()=>window.print()}>Cetak QR</button></div></div></div>:null}
  </main>;
}
