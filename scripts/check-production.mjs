import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "app/page.tsx", "app/guru/page.tsx", "app/murid/page.tsx",
  "components/PracticeRunner.tsx", "components/GeoStimulus.tsx", "components/HotspotChoice.tsx",
  "lib/questions.ts", "lib/questionEngine.ts", "lib/firebase.ts", "lib/repository.ts", "lib/classroom.ts",
  "firebase/firestore.rules", "firebase/firestore.indexes.json",
  "public/manifest.webmanifest", "public/sw.js", "public/icon-192.png", "public/icon-512.png",
  "vercel.json", ".env.example"
];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
const source = fs.readFileSync(path.join(root, "lib/questions.ts"), "utf8");
const engine = fs.readFileSync(path.join(root, "lib/questionEngine.ts"), "utf8");
const total = (source.match(/q\("GB\d{2}-\d{3}"/g) || []).length;
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const checks = {
  totalQuestions: total === 390,
  optionShuffle: engine.includes("options: shuffle(question.options)"),
  version: pkg.version === "1.1.0",
};

if (missing.length || Object.values(checks).some((value) => !value)) {
  console.error("Production check FAILED", { missing, checks, totalQuestions: total, version: pkg.version });
  process.exit(1);
}
console.log("Production check OK", { requiredFiles: required.length, totalQuestions: total, version: pkg.version, optionShuffle: true });
