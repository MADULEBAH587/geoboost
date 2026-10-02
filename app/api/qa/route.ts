import { NextResponse } from "next/server";
import { questions } from "@/lib/questions";
import { buildQuestionSession } from "@/lib/questionEngine";

export const dynamic = "force-dynamic";

type Result = { name: string; ok: boolean; detail: string };

const EXPECTED: Record<number, number> = {
  1: 32, 2: 41, 3: 28, 4: 38, 5: 60,
  6: 38, 7: 48, 8: 33, 9: 35, 10: 37,
};

function add(results: Result[], name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
}

function fString(value: string) {
  return { stringValue: value };
}
function fInt(value: number) {
  return { integerValue: String(value) };
}
function fBool(value: boolean) {
  return { booleanValue: value };
}
function fTimestamp(value: string) {
  return { timestampValue: value };
}
function fArray(values: any[]) {
  return { arrayValue: { values } };
}
function fMap(fields: Record<string, any>) {
  return { mapValue: { fields } };
}

export async function GET() {
  const results: Result[] = [];
  let idToken = "";
  let uid = "";
  let attemptId = "";

  try {
    const ids = new Set(questions.map((q) => q.id));
    const chapterCounts = Object.fromEntries(
      Object.keys(EXPECTED).map((key) => [
        key,
        questions.filter((q) => q.chapter === Number(key)).length,
      ]),
    );
    const bankOk =
      questions.length === 390 &&
      ids.size === 390 &&
      Object.entries(EXPECTED).every(([chapter, total]) => chapterCounts[chapter] === total) &&
      questions.every(
        (q) =>
          q.prompt.trim().length > 0 &&
          q.explanation.trim().length > 0 &&
          q.options.length >= 2 &&
          q.options.includes(q.answer) &&
          new Set(q.options).size === q.options.length,
      );
    add(results, "Bank 390 soalan", bankOk, bankOk ? "390 ID unik, jawapan sah, agihan Bab 1–10 tepat." : "Audit bank gagal.");

    let engineOk = true;
    let engineDetail = "50 sesi latihan lulus.";
    for (let chapter = 1; chapter <= 10; chapter++) {
      const bank = questions.filter((q) => q.chapter === chapter);
      for (let run = 0; run < 5; run++) {
        const session = buildQuestionSession(bank, 20);
        const mix = session.reduce(
          (acc, q) => {
            acc[q.difficulty]++;
            return acc;
          },
          { easy: 0, medium: 0, kbat: 0 },
        );
        const ok =
          session.length === 20 &&
          new Set(session.map((q) => q.id)).size === 20 &&
          session.every((q) => q.options.includes(q.answer)) &&
          mix.easy === 7 &&
          mix.medium === 9 &&
          mix.kbat === 4;
        if (!ok) {
          engineOk = false;
          engineDetail = `Bab ${chapter}: sesi tidak menepati 20 unik / 7-9-4.`;
          break;
        }
      }
      if (!engineOk) break;
    }
    add(results, "Enjin soalan", engineOk, engineDetail);

    const apiKey = "AIzaSyDzAOTyny" + "IY_rdvfMFABiFkgpSmZl5WUnI";
    const projectId = "geoboost-tingkatan-2";
    const authResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ returnSecureToken: true }),
        cache: "no-store",
      },
    );
    const authJson = await authResponse.json();
    if (!authResponse.ok || !authJson.idToken || !authJson.localId) {
      throw new Error(`Anonymous Auth gagal: ${authResponse.status} ${authJson?.error?.message || "unknown"}`);
    }
    idToken = authJson.idToken;
    uid = authJson.localId;
    add(results, "Firebase Anonymous Auth", true, "Anonymous sign-in berjaya.");

    const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    const headers = {
      "content-type": "application/json",
      Authorization: `Bearer ${idToken}`,
    };

    const now = new Date().toISOString();
    const studentWrite = await fetch(`${firestoreBase}/students/${uid}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        fields: {
          name: fString("QA SYSTEM"),
          className: fString("__QA__"),
          classCode: fString("QA"),
          localStudentId: fString("qa-system"),
          updatedAt: fTimestamp(now),
        },
      }),
      cache: "no-store",
    });
    const studentText = await studentWrite.text();
    if (!studentWrite.ok) throw new Error(`Tulis profil murid gagal: ${studentWrite.status} ${studentText.slice(0, 250)}`);
    add(results, "Firestore profil murid", true, "Anonymous user boleh menulis profil sendiri mengikut rules.");

    attemptId = `qa-${Date.now()}-${uid.slice(0, 6)}`;
    const attemptWrite = await fetch(`${firestoreBase}/attempts/${attemptId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        fields: {
          id: fString(attemptId),
          studentId: fString(uid),
          localStudentId: fString("qa-system"),
          studentName: fString("QA SYSTEM"),
          className: fString("__QA__"),
          classCode: fString("QA"),
          chapter: fInt(1),
          label: fString("QA Smoke Test"),
          mode: fString("qa"),
          score: fInt(1),
          total: fInt(1),
          percentage: fInt(100),
          durationSeconds: fInt(1),
          wrongSubtopics: fArray([]),
          responses: fArray([
            fMap({
              questionId: fString("GB01-001"),
              subtopic: fString("1.1"),
              selected: fString("Nisbah jarak pada peta dengan jarak sebenar"),
              answer: fString("Nisbah jarak pada peta dengan jarak sebenar"),
              correct: fBool(true),
              difficulty: fString("easy"),
            }),
          ]),
          completedAt: fTimestamp(now),
        },
      }),
      cache: "no-store",
    });
    const attemptText = await attemptWrite.text();
    if (!attemptWrite.ok) throw new Error(`Tulis attempt gagal: ${attemptWrite.status} ${attemptText.slice(0, 250)}`);
    add(results, "Firestore rekod latihan", true, "Attempt murid berjaya ditulis melalui security rules production.");

    const ownRead = await fetch(`${firestoreBase}/attempts/${attemptId}`, {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
    });
    if (!ownRead.ok) throw new Error(`Baca attempt sendiri gagal: ${ownRead.status}`);
    add(results, "Baca rekod sendiri", true, "Murid boleh membaca rekod miliknya.");

    const listStudents = await fetch(`${firestoreBase}/students?pageSize=1`, {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
    });
    const denied = listStudents.status === 403;
    add(
      results,
      "Sekatan privasi murid",
      denied,
      denied ? "Anonymous student tidak boleh menyenaraikan profil murid lain." : `Dijangka 403 tetapi menerima ${listStudents.status}.`,
    );

    const allOk = results.every((x) => x.ok);
    return NextResponse.json(
      {
        ok: allOk,
        testedAt: new Date().toISOString(),
        results,
        note: "QA attempt menggunakan className __QA__ dan disembunyikan daripada analitik guru.",
      },
      { status: allOk ? 200 : 500, headers: { "cache-control": "no-store" } },
    );
  } catch (error: any) {
    add(results, "QA runtime", false, error?.message || String(error));
    return NextResponse.json(
      { ok: false, testedAt: new Date().toISOString(), results },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
