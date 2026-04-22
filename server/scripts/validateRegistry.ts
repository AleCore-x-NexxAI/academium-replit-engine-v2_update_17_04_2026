import { FRAMEWORK_REGISTRY, FRAMEWORK_DISCIPLINES } from "../agents/frameworkRegistry";

let errors = 0;

for (const entry of FRAMEWORK_REGISTRY) {
  const id = entry.canonicalId;

  for (const disc of entry.disciplines) {
    if (!FRAMEWORK_DISCIPLINES.includes(disc)) {
      console.error(`[${id}] unknown discipline "${disc}"`);
      errors++;
    }
  }

  if (!entry.disciplineDescriptions) {
    console.error(`[${id}] missing disciplineDescriptions`);
    errors++;
    continue;
  }

  for (const disc of entry.disciplines) {
    const pair = entry.disciplineDescriptions[disc];
    if (!pair) {
      console.error(`[${id}] missing disciplineDescriptions.${disc}`);
      errors++;
      continue;
    }
    for (const lang of ["en", "es"] as const) {
      const txt = pair[lang];
      if (!txt || txt.trim().length === 0) {
        console.error(`[${id}] empty disciplineDescriptions.${disc}.${lang}`);
        errors++;
      }
      const wordCount = txt.trim().split(/\s+/).length;
      if (wordCount < 20 || wordCount > 70) {
        console.warn(`[${id}] disciplineDescriptions.${disc}.${lang} has ${wordCount} words (expected 25-60)`);
      }
    }
  }

  for (const disc of Object.keys(entry.disciplineDescriptions)) {
    if (!entry.disciplines.includes(disc)) {
      console.error(`[${id}] disciplineDescriptions has key "${disc}" not in disciplines array`);
      errors++;
    }
  }
}

console.log(`\nValidated ${FRAMEWORK_REGISTRY.length} registry entries.`);
if (errors > 0) {
  console.error(`${errors} error(s) found.`);
  process.exit(1);
} else {
  console.log("All entries pass validation.");
}
