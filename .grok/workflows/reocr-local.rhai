let meta = #{
    name: "reocr-local",
    description: "Planifica y opcionalmente ejecuta re-OCR de packs ES usando solo PDFs ya descargados en padres-source/pdf (sin red/Drive). Prioriza ocr-reocr-queue, importa clean y aplica repair_ocr_noise.",
    when_to_use: "Cuando ocr-reocr-queue o residual body noise pida re-OCR y los PDF locales ya existen; nunca para re-descargar de la fuente.",
    phases: [
        #{ title: "Mapa local", detail: "cola re-OCR + PDFs en disco + inventario Agustín" },
        #{ title: "Plan de trabajo", detail: "elegir ids, mapear n/PDF, comandos exactos (sin descarga)" },
        #{ title: "Ejecutar re-OCR", detail: "solo si execute=true; ocr_volume sobre PDF local" },
        #{ title: "Import + repair", detail: "ocr_import_agustin_clean + ocr-abc dual-write" },
        #{ title: "Informe", detail: "qué se hizo, unitIndex warning, cola restante" },
    ],
};

let map_schema = #{
    "type": "object",
    "required": ["summary", "localPdfCount", "queueEsCount", "notes"],
    "properties": #{
        "summary": #{ "type": "string" },
        "localPdfCount": #{ "type": "integer" },
        "queueEsCount": #{ "type": "integer" },
        "missingPdfIds": #{ "type": "array", "maxItems": 20, "items": #{ "type": "string" } },
        "notes": #{ "type": "array", "maxItems": 12, "items": #{ "type": "string" } },
        "commandsChecked": #{ "type": "array", "maxItems": 8, "items": #{ "type": "string" } },
    },
};

let plan_schema = #{
    "type": "object",
    "required": ["targets", "policy"],
    "properties": #{
        "policy": #{ "type": "string" },
        "targets": #{
            "type": "array",
            "maxItems": 12,
            "items": #{
                "type": "object",
                "required": ["documentId", "volumeN", "pdfPath", "priority", "reason", "commandDryRun"],
                "properties": #{
                    "documentId": #{ "type": "string" },
                    "volumeN": #{ "type": "integer" },
                    "pdfPath": #{ "type": "string" },
                    "pdfExists": #{ "type": "boolean" },
                    "priority": #{ "type": "integer" },
                    "residualScore": #{ "type": "integer" },
                    "reason": #{ "type": "string" },
                    "suggestedRange": #{ "type": "string" },
                    "commandDryRun": #{ "type": "string" },
                    "unitIndexRisk": #{ "type": "string" },
                },
            },
        },
        "skipped": #{
            "type": "array",
            "maxItems": 20,
            "items": #{
                "type": "object",
                "required": ["documentId", "why"],
                "properties": #{
                    "documentId": #{ "type": "string" },
                    "why": #{ "type": "string" },
                },
            },
        },
        "notes": #{ "type": "array", "items": #{ "type": "string" } },
    },
};

let exec_schema = #{
    "type": "object",
    "required": ["documentId", "success", "logTail"],
    "properties": #{
        "documentId": #{ "type": "string" },
        "success": #{ "type": "boolean" },
        "cleanBytes": #{ "type": "integer" },
        "imported": #{ "type": "boolean" },
        "repaired": #{ "type": "boolean" },
        "unitCountAfter": #{ "type": "integer" },
        "logTail": #{ "type": "string" },
        "error": #{ "type": "string" },
    },
};

let report_schema = #{
    "type": "object",
    "required": ["title", "markdown", "nextSteps"],
    "properties": #{
        "title": #{ "type": "string" },
        "markdown": #{ "type": "string" },
        "nextSteps": #{ "type": "array", "maxItems": 12, "items": #{ "type": "string" } },
        "executedIds": #{ "type": "array", "items": #{ "type": "string" } },
        "plannedIds": #{ "type": "array", "items": #{ "type": "string" } },
    },
};

fn trimmed(s) {
    if type_of(s) == "string" {
        s.trim();
        s
    } else {
        ""
    }
}

fn ends_with_es(id) {
    if type_of(id) != "string" || id.len() < 3 { return false; }
    id.sub_string(id.len() - 3, 3) == "-es"
}

fn is_agustin_es(id) {
    if type_of(id) != "string" { return false; }
    if !ends_with_es(id) { return false; }
    // "agustin-" prefix
    if id.len() < 9 { return false; }
    id.sub_string(0, 8) == "agustin-"
}

// --- args ---
// Default: plan-only (dry). execute=true runs local OCR (expensive, CPU-bound).
let execute = false;
let max_docs = 2;
let explicit_ids = [];
let jobs = "4";
let dpi = "130";
let do_import = true;
let do_repair = true;
let force_rerender = false;
let range_hint = "";

if args != () {
    if args.execute != () {
        let e = `${args.execute}`;
        if e == "true" || e == "1" || e == "yes" { execute = true; }
        if type_of(args.execute) == "bool" && args.execute == true { execute = true; }
    }
    if args.dry_run != () {
        let d = `${args.dry_run}`;
        if d == "true" || d == "1" { execute = false; }
    }
    if args.max_docs != () {
        let md = trimmed(`${args.max_docs}`);
        if md == "1" { max_docs = 1; }
        else if md == "2" { max_docs = 2; }
        else if md == "3" { max_docs = 3; }
        else if md == "4" { max_docs = 4; }
        else if type_of(args.max_docs) == "i64" || type_of(args.max_docs) == "int" {
            max_docs = args.max_docs;
        }
    }
    if args.jobs != () { jobs = trimmed(`${args.jobs}`); }
    if args.dpi != () { dpi = trimmed(`${args.dpi}`); }
    if args.range != () { range_hint = trimmed(`${args.range}`); }
    // Note: `import` is reserved in this dialect — use do_import / do_repair
    if args.do_import != () {
        let v = `${args.do_import}`;
        if v == "false" || v == "0" { do_import = false; }
        if type_of(args.do_import) == "bool" && args.do_import == false { do_import = false; }
    }
    if args.do_repair != () {
        let v = `${args.do_repair}`;
        if v == "false" || v == "0" { do_repair = false; }
        if type_of(args.do_repair) == "bool" && args.do_repair == false { do_repair = false; }
    }
    if args.force_rerender != () {
        let v = `${args.force_rerender}`;
        if v == "true" || v == "1" { force_rerender = true; }
    }
    if args.ids != () {
        if type_of(args.ids) == "array" {
            for x in args.ids {
                let s = trimmed(`${x}`);
                if s != "" && ends_with_es(s) { explicit_ids.push(s); }
            }
        } else {
            let raw = trimmed(`${args.ids}`);
            let cur = "";
            let i = 0;
            while i < raw.len() {
                let ch = raw.sub_string(i, 1);
                if ch == "," {
                    let t = trimmed(cur);
                    if t != "" && ends_with_es(t) { explicit_ids.push(t); }
                    cur = "";
                } else {
                    cur += ch;
                }
                i += 1;
            }
            let t = trimmed(cur);
            if t != "" && ends_with_es(t) { explicit_ids.push(t); }
        }
    }
}

if max_docs < 1 { max_docs = 1; }
if max_docs > 4 {
    log("max_docs capped at 4 for local re-OCR cost");
    max_docs = 4;
}

log("reocr-local execute=" + `${execute}` + " max_docs=" + max_docs.to_string() + " import=" + `${do_import}` + " repair=" + `${do_repair}`);

// =============================================================================
phase("Mapa local");
// =============================================================================

let map_prompt = "Map LOCAL re-OCR inputs for Documentos Vaticanos. NEVER suggest downloading from Drive/network. ";
map_prompt += "You MUST use tools (read_file, list_dir, run_terminal_command for ls/stat only). ";
map_prompt += "1) Read documentos/corpus/ocr-reocr-queue.json — count entries ending in -es (ignore locale twins en/hi/zh/ar). ";
map_prompt += "2) List documentos/padres-source/pdf/agustin-*.pdf (local only) and count. ";
map_prompt += "3) Read documentos/padres-source/inventory/agustin-volumes.json — corpusDocId ↔ n. ";
map_prompt += "4) Confirm scripts-descarga/reocr_local_volume.sh and ocr_volume.sh exist; dry-run one example: ";
map_prompt += "`cd scripts-descarga && ./reocr_local_volume.sh --doc-id agustin-05-de-trinitate-es --dry-run`. ";
map_prompt += "5) Note pipeline: local PDF → ocr_volume (tesseract) → clean/*.txt → ocr_import_agustin_clean → dual-write corpus; then repair_ocr_noise_corpus --apply. ";
map_prompt += "6) Stress: re-import RE-SEGMENTS units (unitIndex may change). Mechanical repair alone keeps unitIndex. ";
map_prompt += "Return summary + localPdfCount + queueEsCount + any missing PDF for top queue ES ids.";

let map_r = agent(map_prompt, #{
    label: "map:local",
    capability_mode: "execute",
    output_schema: map_schema,
});

let map_summary = "";
if map_r != () && map_r.success && map_r.output != () && map_r.output.summary != () {
    map_summary = `${map_r.output.summary}`;
    log("map ok: " + map_summary);
} else {
    log("map agent weak/failed — continue with plan agent tools");
    map_summary = "map agent incomplete; plan agent must re-check files";
}

// =============================================================================
phase("Plan de trabajo");
// =============================================================================

let plan_prompt = "Build a LOCAL-ONLY re-OCR work plan. NEVER download. NEVER invent PDF paths. ";
plan_prompt += "You MUST use tools. ";
plan_prompt += "Inputs: ocr-reocr-queue.json (prefer locale=es / id ends with -es only), ";
plan_prompt += "agustin-volumes.json, list of files in documentos/padres-source/pdf/. ";
plan_prompt += "Helper: scripts-descarga/reocr_local_volume.sh --doc-id <id> --dry-run. ";
plan_prompt += "Scope max_docs=" + max_docs.to_string() + ". ";
if explicit_ids.len() > 0 {
    plan_prompt += "User forced ids (only these if present locally): " + json_encode(explicit_ids) + ". ";
} else {
    plan_prompt += "Default priority: highest residualScore among agustin-*-es with local PDF. ";
    plan_prompt += "Prefer known hot packs: agustin-18,15,12,05,01,31,32,34,35 if in queue and PDF exists. ";
}
plan_prompt += "For each target run `./reocr_local_volume.sh --doc-id ID --dry-run` and paste commandDryRun from output. ";
plan_prompt += "pdfExists must be true only if you verified the file. Skip twins (-en/-zh/…) and skip missing PDF with why. ";
plan_prompt += "unitIndexRisk: always warn that --import re-segments units. ";
if range_hint != "" {
    plan_prompt += "User range hint: " + range_hint + " — put in suggestedRange when sensible. ";
}
plan_prompt += "policy must state: local PDF only; no Drive; optional import+repair after OCR. ";
plan_prompt += "At most " + max_docs.to_string() + " targets.";

let plan_r = agent(plan_prompt, #{
    label: "plan:targets",
    capability_mode: "execute",
    output_schema: plan_schema,
});

let targets = [];
let skipped = [];
if plan_r != () && plan_r.success && plan_r.output != () {
    if plan_r.output.targets != () {
        for t in plan_r.output.targets {
            if t == () || t.documentId == () { continue; }
            let id = trimmed(`${t.documentId}`);
            if !is_agustin_es(id) {
                log("drop non-agustin-es from plan: " + id);
                continue;
            }
            if t.pdfExists == false {
                log("drop missing pdf: " + id);
                skipped.push(#{ documentId: id, why: "pdfExists=false" });
                continue;
            }
            // de-dupe
            let seen = false;
            for x in targets {
                if x.documentId == id { seen = true; }
            }
            if seen { continue; }
            targets.push(t);
            if targets.len() >= max_docs { break; }
        }
    }
    if plan_r.output.skipped != () {
        for s in plan_r.output.skipped {
            if s != () { skipped.push(s); }
        }
    }
}

// Fallback seed if plan empty
if targets.len() == 0 {
    log("plan empty — seed dry-run fallback ids");
    let seeds = [];
    if explicit_ids.len() > 0 {
        for id in explicit_ids { seeds.push(id); }
    } else {
        seeds.push("agustin-18-epistolas-indices-es");
        seeds.push("agustin-05-de-trinitate-es");
        seeds.push("agustin-15-tratados-escriturarios-es");
        seeds.push("agustin-32-antidonatistas-1-es");
    }
    let i = 0;
    while i < seeds.len() && targets.len() < max_docs {
        let id = seeds[i];
        if is_agustin_es(id) {
            targets.push(#{
                documentId: id,
                volumeN: 0,
                pdfPath: "(verify locally)",
                pdfExists: true,
                priority: i + 1,
                reason: "fallback-seed",
                commandDryRun: "cd scripts-descarga && ./reocr_local_volume.sh --doc-id " + id + " --dry-run",
                unitIndexRisk: "import re-segments units",
            });
        }
        i += 1;
    }
}

log("planned targets=" + targets.len().to_string());
for t in targets {
    log("  plan: " + `${t.documentId}` + " — " + `${t.reason}`);
}

write_scratch_file("reocr-plan.json", json_encode(#{
    execute: execute,
    max_docs: max_docs,
    targets: targets,
    skipped: skipped,
    map_summary: map_summary,
}));

// =============================================================================
phase("Ejecutar re-OCR");
// =============================================================================

let exec_results = [];

if !execute {
    log("execute=false — plan-only mode (no OCR CPU). Pass args.execute=true to run.");
} else if targets.len() == 0 {
    log("no targets to execute");
} else {
    // Sequential panels of 1 to avoid thrashing tesseract/CPU (still one parallel() call with 1 job each round)
    for t in targets {
        let id = trimmed(`${t.documentId}`);
        let cmd = "cd /home/angel/proyectos/personal/documentos-vaticanos/scripts-descarga && ./reocr_local_volume.sh --doc-id " + id;
        cmd += " --jobs " + jobs + " --dpi " + dpi;
        if range_hint != "" {
            cmd += " --range " + range_hint;
        } else if t.suggestedRange != () && trimmed(`${t.suggestedRange}`) != "" {
            cmd += " --range " + trimmed(`${t.suggestedRange}`);
        }
        if force_rerender { cmd += " --force-rerender"; }
        // OCR only in this phase; import/repair next phase for clearer logs
        let ep = "Execute LOCAL re-OCR for documentId=" + id + ". ";
        ep += "HARD RULES: do NOT download from Drive/network; use only scripts-descarga/reocr_local_volume.sh; ";
        ep += "if PDF missing, set success=false and explain. ";
        ep += "Run this command and capture the log tail (last ~40 lines):\n";
        ep += cmd + "\n";
        ep += "After OCR, check documentos/padres-source/clean/" + id + ".txt exists and report cleanBytes. ";
        ep += "Do NOT import yet in this step (imported=false, repaired=false). ";
        ep += "OCR can take a long time — wait for the command to finish.";

        let er = agent(ep, #{
            label: "ocr:" + id,
            capability_mode: "execute",
            output_schema: exec_schema,
        });
        if er != () && er.success && er.output != () {
            exec_results.push(er.output);
            log("ocr done " + id + " success=" + `${er.output.success}`);
        } else {
            exec_results.push(#{
                documentId: id,
                success: false,
                logTail: "agent failed",
                error: "agent_failed",
                imported: false,
                repaired: false,
            });
            log("ocr agent failed " + id);
        }
    }
}

// =============================================================================
phase("Import + repair");
// =============================================================================

let post_results = [];

if execute && do_import {
    for t in targets {
        let id = trimmed(`${t.documentId}`);
        // only import if OCR step claimed success (or always try if clean exists)
        let pp = "Post-process LOCAL re-OCR for " + id + ". ";
        pp += "1) If clean text missing at documentos/padres-source/clean/" + id + ".txt → success=false. ";
        pp += "2) Resolve volume n from documentos/padres-source/inventory/agustin-volumes.json for this corpusDocId. ";
        pp += "3) Import: `cd scripts-descarga && npx ts-node --transpile-only ocr_import_agustin_clean.ts --n <N>`. ";
        pp += "   WARNING: this re-segments units (unitIndex may change). Report unitCountAfter from content.json length. ";
        if do_repair {
            pp += "4) Repair: `npx ts-node --transpile-only repair_ocr_noise_corpus.ts --apply --ids " + id + "`. repaired=true if exit 0. ";
        } else {
            pp += "4) Skip repair (user disabled). repaired=false. ";
        }
        pp += "5) Do NOT download anything. Do NOT touch locale twins. ";
        pp += "Return documentId, success, imported, repaired, unitCountAfter, logTail.";

        let pr = agent(pp, #{
            label: "post:" + id,
            capability_mode: "execute",
            output_schema: exec_schema,
        });
        if pr != () && pr.success && pr.output != () {
            post_results.push(pr.output);
            log("post " + id + " success=" + `${pr.output.success}`);
        } else {
            post_results.push(#{
                documentId: id,
                success: false,
                imported: false,
                repaired: false,
                logTail: "post agent failed",
                error: "agent_failed",
            });
        }
    }
} else if execute && !do_import {
    log("import disabled — clean text left under padres-source/clean for manual review");
} else {
    log("skip import/repair (plan-only)");
}

// =============================================================================
phase("Informe");
// =============================================================================

let planned_ids = [];
for t in targets {
    planned_ids.push(trimmed(`${t.documentId}`));
}

let synth = "Write a Spanish markdown report for the LOCAL re-OCR workflow (no downloads). ";
synth += "Mode execute=" + `${execute}` + ". ";
synth += "Map summary: " + map_summary + "\n";
synth += "Plan targets JSON: " + json_encode(targets) + "\n";
synth += "Skipped: " + json_encode(skipped) + "\n";
synth += "OCR exec results: " + json_encode(exec_results) + "\n";
synth += "Import/repair results: " + json_encode(post_results) + "\n";
synth += "Sections:\n";
synth += "1. Resumen (plan-only vs executed)\n";
synth += "2. Política: solo PDF local en padres-source/pdf; sin Drive\n";
synth += "3. Tabla targets (id | n | pdf | residual | acción)\n";
synth += "4. Comandos exactos (copy-paste) usando reocr_local_volume.sh\n";
synth += "5. Riesgo unitIndex al importar\n";
synth += "6. Resultados si execute\n";
synth += "7. Next steps (siguientes ids de cola, rangos de páginas, no re-descargar)\n";
synth += "title short. plannedIds and executedIds lists.";

let rep = agent(synth, #{
    label: "report:final",
    capability_mode: "read-only",
    output_schema: report_schema,
});

let title = "Re-OCR local (sin descarga)";
let md = "";
let next_steps = [];
let executed_ids = [];

if rep != () && rep.success && rep.output != () {
    if rep.output.title != () { title = `${rep.output.title}`; }
    if rep.output.markdown != () { md = `${rep.output.markdown}`; }
    if rep.output.nextSteps != () { next_steps = rep.output.nextSteps; }
    if rep.output.executedIds != () { executed_ids = rep.output.executedIds; }
}

if md == "" {
    md = "Plan-only o síntesis fallida. Ver scratch reocr-plan.json.\n\n";
    md += "## Targets\n\n";
    for t in targets {
        md += "- `" + `${t.documentId}` + "` — " + `${t.reason}` + "\n";
        if t.commandDryRun != () {
            md += "  - `" + `${t.commandDryRun}` + "`\n";
        }
    }
    md += "\n## Ejecutar\n\n";
    md += "```bash\ncd scripts-descarga\n";
    for t in targets {
        let id = `${t.documentId}`;
        md += "./reocr_local_volume.sh --doc-id " + id + " --import --repair\n";
    }
    md += "```\n";
}

if execute {
    for r in exec_results {
        if r != () && r.success == true && r.documentId != () {
            executed_ids.push(`${r.documentId}`);
        }
    }
}

let full = "# " + title + "\n\n";
full += "_Workflow `reocr-local` · execute=`" + `${execute}` + "` · max_docs=" + max_docs.to_string() + "_\n\n";
full += md;
full += "\n\n---\n\n## Comandos locales (sin red)\n\n```bash\ncd scripts-descarga\n";
for t in targets {
    let id = trimmed(`${t.documentId}`);
    full += "./reocr_local_volume.sh --doc-id " + id + " --dry-run\n";
    full += "./reocr_local_volume.sh --doc-id " + id + " --import --repair   # re-OCR completo + import\n";
}
full += "```\n";
full += "\n**Importante:** `--import` re-segmenta unidades (`unitIndex` puede cambiar en ese pack). ";
full += "Los PDF se leen solo de `documentos/padres-source/pdf/`; si falta el archivo, el script falla sin descargar.\n";

let report_path = write_scratch_file("reocr-local-report.md", full);
log("report: " + report_path);

complete(#{
    summary: title,
    execute: execute,
    plannedIds: planned_ids,
    executedIds: executed_ids,
    targetCount: targets.len(),
    skippedCount: skipped.len(),
    nextSteps: next_steps,
    report_path: report_path,
    helper: "scripts-descarga/reocr_local_volume.sh",
});
