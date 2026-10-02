"use client";

import { useEffect, useState } from "react";
import { PracticeRunner } from "@/components/PracticeRunner";
import { questions, Question } from "@/lib/questions";
import { getCustomQuestions, mergeQuestionBanks } from "@/lib/customQuestions";
import { validateClassCode, ClassAssignment } from "@/lib/classroom";
import { getStudentSession } from "@/lib/session";
import { getLocalAttempts } from "@/lib/repository";

export default function AssignmentPage() {
  const [bank,setBank]=useState<Question[]|null>(null);
  const [assignment,setAssignment]=useState<ClassAssignment|null>(null);
  const [blocked,setBlocked]=useState("");

  useEffect(()=>{
    async function load(){
      const params=new URLSearchParams(window.location.search);
      const student=getStudentSession();
      const classCode=params.get("class")||student?.classCode||"";
      const id=params.get("id")||"";
      if(!student||!classCode||!id){setBank([]);return}
      try{
        const record=await validateClassCode(classCode);
        const task=record?.assignments.find(a=>a.id===id);
        if(!record||!task||!task.active){setBlocked("Tugasan ini tidak lagi aktif.");setBank([]);return}
        if(task.targetStudentIds?.length && !task.targetStudentIds.includes(student.id)){setBlocked("Tugasan ini tidak ditetapkan kepada anda.");setBank([]);return}
        const tries=getLocalAttempts().filter(a=>a.studentId===student.id && a.mode==="tugasan:"+task.id).length;
        if(tries>=(task.maxAttempts||3)){setBlocked("Anda telah mencapai had "+(task.maxAttempts||3)+" percubaan untuk tugasan ini.");setBank([]);return}
        const custom=await getCustomQuestions();
        const merged=mergeQuestionBanks(questions,custom);
        const selected=task.questionIds?.length
          ? task.questionIds.map(qid=>merged.find(q=>q.id===qid)).filter(Boolean) as Question[]
          : merged.filter(q=>q.chapter===task.chapter);
        setAssignment(task);setBank(selected);
      }catch(error){console.error(error);setBlocked("Tugasan tidak dapat dimuatkan.");setBank([])}
    }
    load();
  },[]);

  if(bank===null)return <main className="quiz-shell"><div className="empty-state"><h1>Memuatkan tugasan...</h1></div></main>;
  if(!bank.length||!assignment)return <main className="quiz-shell"><div className="empty-state"><span className="result-icon">📝</span><h1>{blocked||"Tugasan tidak sah"}</h1><p>Kembali ke halaman Tugasan Saya untuk melihat tugasan aktif.</p><a className="primary" href="/murid/tugasan">Kembali</a></div></main>;

  return <PracticeRunner bank={bank} requested={Math.min(assignment.questionCount,bank.length)} title={assignment.title} eyebrow="TUGASAN GURU" mode={"tugasan:"+assignment.id} returnHref="/murid/tugasan"/>;
}
