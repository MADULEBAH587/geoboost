"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Question } from "@/lib/questions";
import { buildQuestionSession, type SessionMix, standardMix } from "@/lib/questionEngine";
import { getStudentSession } from "@/lib/session";
import { saveAttempt, type AttemptResponse } from "@/lib/repository";
import { validateClassCode } from "@/lib/classroom";
import { GeoStimulus, stimulusForQuestion } from "@/components/GeoStimulus";
import { HotspotChoice, isHotspotQuestion } from "@/components/HotspotChoice";

type SavedPractice = {
  sessionIds: string[];
  index: number;
  selected: string | null;
  checked: boolean;
  responses: AttemptResponse[];
  startedAt: number;
};

export function PracticeRunner({
  bank,
  requested,
  title,
  eyebrow,
  mode,
  returnHref = "/",
  mix = standardMix,
}: {
  bank: Question[];
  requested: number;
  title: string;
  eyebrow: string;
  mode: string;
  returnHref?: string;
  mix?: SessionMix;
}) {
  const saveKey = "geoboost_resume_"+mode+"_"+title.replace(/[^a-z0-9]+/gi,"_").slice(0,60);
  const [session, setSession] = useState<Question[]>(() => buildQuestionSession(bank, requested, mix));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [responses, setResponses] = useState<AttemptResponse[]>([]);
  const [done, setDone] = useState(false);
  const [synced, setSynced] = useState<boolean | null>(null);
  const [guest, setGuest] = useState(false);
  const [resumeReady, setResumeReady] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const startedAt = useRef(Date.now());

  const label = useMemo(() => eyebrow || mode.toUpperCase(), [eyebrow, mode]);

  useEffect(() => {
    let active = true;
    async function prepare() {
      const student = getStudentSession();
      const uniqueChapters = [...new Set(bank.map(q=>q.chapter))];
      if (student?.classCode && uniqueChapters.length === 1 && mode !== "pemulihan" && mode !== "ulang-salah") {
        try {
          const record = await validateClassCode(student.classCode);
          if (record && !record.openChapters.includes(uniqueChapters[0])) {
            if (active) setAccessDenied(true);
          }
        } catch {}
      }

      try {
        const raw = localStorage.getItem(saveKey);
        if (raw) {
          const saved = JSON.parse(raw) as SavedPractice;
          const byId = new Map(bank.map(q=>[q.id,q]));
          const restored = saved.sessionIds.map(id=>byId.get(id)).filter(Boolean) as Question[];
          if (restored.length === saved.sessionIds.length && restored.length > 0 && saved.index < restored.length) {
            setSession(restored);
            setIndex(saved.index);
            setSelected(saved.selected);
            setChecked(saved.checked);
            setResponses(Array.isArray(saved.responses) ? saved.responses : []);
            startedAt.current = saved.startedAt || Date.now();
            setResumed(true);
          }
        }
      } catch {}
      if (active) setResumeReady(true);
    }
    prepare();
    return () => { active = false; };
  }, [saveKey, bank, mode]);

  useEffect(() => {
    if (!resumeReady || done || accessDenied || !session.length) return;
    const state: SavedPractice = {
      sessionIds: session.map(q=>q.id),
      index,
      selected,
      checked,
      responses,
      startedAt: startedAt.current,
    };
    localStorage.setItem(saveKey, JSON.stringify(state));
  }, [resumeReady, done, accessDenied, saveKey, session, index, selected, checked, responses]);

  if (accessDenied) {
    return <main className="quiz-shell"><div className="empty-state"><span className="result-icon">🔒</span><h1>Bab ini belum dibuka</h1><p>Guru kelas anda belum membuka bab ini untuk latihan.</p><a className="primary" href="/">← Kembali ke GeoBoost</a></div></main>;
  }

  if (!session.length) {
    return <main className="quiz-shell"><div className="empty-state"><h1>Tiada soalan untuk set ini</h1><p>Pilih bab lain atau lengkapkan satu latihan dahulu.</p><a className="primary" href={returnHref}>← Kembali</a></div></main>;
  }

  const current = session[index];
  const isCorrect = selected === current.answer;
  const progress = Math.round(((index + (checked ? 1 : 0)) / session.length) * 100);
  const stimulus = stimulusForQuestion(current);

  function checkAnswer() {
    if (!selected || checked) return;
    const response: AttemptResponse = {
      questionId: current.id,
      subtopic: current.subtopic,
      selected,
      answer: current.answer,
      correct: selected === current.answer,
      difficulty: current.difficulty,
    };
    setChecked(true);
    setResponses(a => [...a, response]);
  }

  async function next() {
    if (index < session.length - 1) {
      setIndex(i => i + 1);
      setSelected(null);
      setChecked(false);
      return;
    }

    const finalResponses = responses.length === session.length
      ? responses
      : selected
        ? [...responses, {
            questionId: current.id,
            subtopic: current.subtopic,
            selected,
            answer: current.answer,
            correct: selected === current.answer,
            difficulty: current.difficulty,
          }]
        : responses;

    const score = finalResponses.filter(a => a.correct).length;
    const student = getStudentSession();
    setGuest(!student);
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    const wrongSubtopics = [...new Set(finalResponses.filter(a => !a.correct).map(a => a.subtopic))];
    const uniqueChapters = [...new Set(session.map(q => q.chapter))];
    const chapter = uniqueChapters.length === 1 ? uniqueChapters[0] : 0;

    const result = await saveAttempt({
      id: crypto.randomUUID(),
      studentId: student?.id || "demo",
      studentName: student?.name || "Murid Demo",
      className: student?.className || "Demo",
      classCode: student?.classCode || "",
      chapter,
      label: title,
      mode,
      score,
      total: session.length,
      percentage: Math.round((score / session.length) * 100),
      durationSeconds,
      wrongSubtopics,
      responses: finalResponses,
      completedAt: Date.now(),
    });

    const wrongIds = finalResponses.filter(a=>!a.correct).map(a=>a.questionId);
    if (wrongIds.length) {
      localStorage.setItem("geoboost_last_wrong", JSON.stringify({ ids: wrongIds, title, savedAt: Date.now() }));
    } else {
      localStorage.removeItem("geoboost_last_wrong");
    }
    localStorage.removeItem(saveKey);
    setResponses(finalResponses);
    setSynced(result.synced);
    setDone(true);
  }

  if (done) {
    const score = responses.filter(a => a.correct).length;
    const percentage = Math.round((score / session.length) * 100);
    const wrong = [...new Set(responses.filter(a => !a.correct).map(a => a.subtopic))];
    const wrongCount = responses.filter(a=>!a.correct).length;
    const easy = responses.filter(a=>a.difficulty==="easy");
    const medium = responses.filter(a=>a.difficulty==="medium");
    const kbat = responses.filter(a=>a.difficulty==="kbat");
    const mastery = (items: AttemptResponse[]) => items.length ? Math.round(items.filter(x=>x.correct).length/items.length*100) : 0;
    return (
      <main className="quiz-shell result-shell">
        <section className="result-card">
          <span className="result-icon">{percentage >= 80 ? "🏆" : percentage >= 60 ? "⭐" : "🎯"}</span>
          <span className="eyebrow dark">{label} SELESAI</span>
          <h2 className="result-title">{title}</h2>
          <h1>{percentage}%</h1>
          <p>{score} daripada {session.length} jawapan betul.</p>
          <div className="result-stats"><div><small>XP sesi</small><b>{score * 10}</b></div><div><small>Mudah</small><b>{mastery(easy)}%</b></div><div><small>Sederhana</small><b>{mastery(medium)}%</b></div><div><small>KBAT</small><b>{mastery(kbat)}%</b></div></div>
          {guest ? <div className="sync-banner offline">👤 Mod tetamu · masuk sebagai murid untuk menyimpan markah.</div> : <div className={"sync-banner "+(synced ? "online" : "offline")}>{synced ? "☁️ Rekod diselaraskan ke Firebase" : "📱 Rekod selamat pada peranti · akan cuba sync semula"}</div>}
          {wrong.length > 0 && <div className="recovery-box"><span>🎯</span><div><small>Cadangan pemulihan</small><strong>{wrong.join(", ")}</strong></div></div>}
          <div className="result-actions"><a className="primary" href={returnHref}>Kembali</a>{wrongCount > 0 ? <a className="secondary dark-button" href="/ulang-salah">Ulang {wrongCount} soalan salah</a> : null}<a className="secondary dark-button" href="/pemulihan">Pemulihan</a></div>
        </section>
      </main>
    );
  }

  return (
    <main className="quiz-shell">
      <header className="quiz-topbar">
        <a href={returnHref}>← Keluar</a>
        <div><small>{label}</small><strong>{title}</strong></div>
        <span>{index + 1}/{session.length}</span>
      </header>
      <div className="quiz-progress"><span style={{ width: progress+"%" }} /></div>
      {resumed ? <div className="resume-banner">↩️ Latihan disambung dari jawapan terakhir. Kemajuan disimpan automatik.</div> : <div className="resume-banner subtle">☁️ Autosave aktif · anda boleh keluar dan sambung semula.</div>}
      <section className="question-card">
        <div className="question-meta"><span>Bab {current.chapter} · {current.subtopic}</span><span className={"difficulty "+current.difficulty}>{current.difficulty === "easy" ? "MUDAH" : current.difficulty === "medium" ? "SEDERHANA" : "KBAT"}</span><span>{current.id}</span></div>
        {stimulus ? <GeoStimulus kind={stimulus} /> : null}
        <h1>{current.prompt}</h1>
        {isHotspotQuestion(current.id) ? (
          <HotspotChoice questionId={current.id} options={current.options} selected={selected} disabled={checked} onSelect={setSelected} />
        ) : (
          <div className="option-list">
            {current.options.map((option, optionIndex) => {
              const chosen = selected === option;
              const answerClass = checked ? (option === current.answer ? "correct" : chosen ? "wrong" : "") : chosen ? "selected" : "";
              return <button key={option+"-"+optionIndex} onClick={()=>!checked && setSelected(option)} className={"option "+answerClass}><span>{String.fromCharCode(65 + optionIndex)}</span><b>{option}</b></button>;
            })}
          </div>
        )}
        {!checked ? <button disabled={!selected} onClick={checkAnswer} className="primary full quiz-submit">Semak jawapan</button> : <div className={"feedback "+(isCorrect ? "good" : "bad")}><div><strong>{isCorrect ? "✓ Tepat! +10 XP" : "Belum tepat"}</strong><p>{current.explanation}</p>{!isCorrect && <small>Jawapan: <b>{current.answer}</b></small>}</div><button onClick={next}>{index === session.length - 1 ? "Lihat keputusan" : "Seterusnya →"}</button></div>}
      </section>
    </main>
  );
}
