let meta = #{
    name: "reocr-max-compute",
    description: "Re-OCR Agustín ES a máxima CPU: discover + fan-out multi-subagente desacoplado (OCR paralelo → import/repair paralelo → commit serial → verify). Auto-tune workers×jobs≈nproc; sin descarga y sin push.",
    when_to_use: "Cola residual con varios tomos y máquina multi-core; preferir sobre reocr-local secuencial o reocr-parallel monofase cuando se quiera saturar CPU sin idle entre import.",
    phases: [
        #{ title: "Descubrir + sintonizar", detail: "pendientes, nproc, workers×jobs, conflictos OCR" },
        #{ title: "OCR paralelo", detail: "un subagente por tomo; solo tesseract/clean (CPU bound)" },
        #{ title: "Import + repair paralelo", detail: "tras barrera OCR; I/O + ts-node en fan-out" },
        #{ title: "Commit serial", detail: "un commit por oleada; nunca push" },
        #{ title: "Verificar + informe", detail: "dual unitCount + markdown" },
    ],
};

let discover_schema = #{
    "type": "object",
    "required": ["pendingIds", "nproc", "workers", "jobsPerWorker", "totalThreads"],
    "properties": #{
        "pendingIds": #{ "type": "array", "maxItems": 40, "items": #{ "type": "string" } },
        "doneIds": #{ "type": "array", "maxItems": 40, "items": #{ "type": "string" } },
        "nproc": #{ "type": "integer" },
        "workers": #{ "type": "integer" },
        "jobsPerWorker": #{ "type": "integer" },
        "totalThreads": #{ "type": "integer" },
        "activeOcr": #{ "type": "boolean" },
        "activeDocIds": #{ "type": "array", "items": #{ "type": "string" } },
        "memGiB": #{ "type": "number" },
        "notes": #{ "type": "array", "items": #{ "type": "string" } },
    },
};

let ocr_schema = #{
    "type": "object",
    "required": ["documentId", "success", "phase"],
    "properties": #{
        "documentId": #{ "type": "string" },
        "success": #{ "type": "boolean" },
        "phase": #{ "type": "string" },
        "cleanBytes": #{ "type": "integer" },
        "pages": #{ "type": "integer" },
        "elapsedSec": #{ "type": "integer" },
        "logTail": #{ "type": "string" },
        "error": #{ "type": "string" },
    },
};

let import_schema = #{
    "type": "object",
    "required": ["documentId", "success", "phase"],
    "properties": #{
        "documentId": #{ "type": "string" },
        "success": #{ "type": "boolean" },
        "phase": #{ "type": "string" },
        "unitCount": #{ "type": "integer" },
        "dualMatch": #{ "type": "boolean" },
        "repaired": #{ "type": "boolean" },
        "logTail": #{ "type": "string" },
        "error": #{ "type": "string" },
    },
};

let commit_schema = #{
    "type": "object",
    "required": ["success", "message"],
    "properties": #{
        "success": #{ "type": "boolean" },
        "message": #{ "type": "string" },
        "filesStaged": #{ "type": "integer" },
        "sha": #{ "type": "string" },
    },
};

let report_schema = #{
    "type": "object",
    "required": ["title", "markdown", "okCount", "failCount"],
    "properties": #{
        "title": #{ "type": "string" },
        "markdown": #{ "type": "string" },
        "okCount": #{ "type": "integer" },
        "failCount": #{ "type": "integer" },
        "okIds": #{ "type": "array", "items": #{ "type": "string" } },
        "failIds": #{ "type": "array", "items": #{ "type": "string" } },
        "throughputHint": #{ "type": "string" },
        "nextSteps": #{ "type": "array", "items": #{ "type": "string" } },
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
    if type_of(id) != "string" || id.len() < 11 { return false; }
    if !ends_with_es(id) { return false; }
    id.sub_string(0, 8) == "agustin-"
}

fn parse_bool(v, default_val) {
    if v == () { return default_val; }
    if type_of(v) == "bool" { return v; }
    let s = trimmed(`${v}`);
    if s == "true" || s == "1" || s == "yes" { return true; }
    if s == "false" || s == "0" || s == "no" { return false; }
    default_val
}

fn parse_int_arg(v, default_val) {
    if v == () { return default_val; }
    if type_of(v) == "i64" || type_of(v) == "int" { return v; }
    let s = trimmed(`${v}`);
    // small fixed map — Rhai has no int()
    if s == "0" { return 0; }
    if s == "1" { return 1; }
    if s == "2" { return 2; }
    if s == "3" { return 3; }
    if s == "4" { return 4; }
    if s == "5" { return 5; }
    if s == "6" { return 6; }
    if s == "7" { return 7; }
    if s == "8" { return 8; }
    if s == "10" { return 10; }
    if s == "12" { return 12; }
    if s == "16" { return 16; }
    if s == "20" { return 20; }
    if s == "40" { return 40; }
    default_val
}

// --- args ---
// execute: run work (default false = plan only)
// workers: concurrent volumes (0 = auto from nproc)
// jobs_per: tesseract -P per volume (0 = auto so workers*jobs ≈ nproc)
// max_waves: safety
// do_commit / do_import / do_repair
// mode: "agent" (default, 1 subagent/volume) | "shell" (1 agent launches reocr_parallel_wave)
// skip_active: if true and host OCR running, plan-only / complete early
// ids: forced list
let execute = false;
let workers_arg = 0;
let jobs_arg = 0;
let max_waves = 20;
let do_commit = true;
let do_import = true;
let do_repair = true;
let mode = "agent";
let skip_active = true;
let explicit_ids = [];

if args != () {
    execute = parse_bool(args.execute, false);
    workers_arg = parse_int_arg(args.workers, 0);
    jobs_arg = parse_int_arg(args.jobs_per, 0);
    max_waves = parse_int_arg(args.max_waves, 20);
    do_commit = parse_bool(args.do_commit, true);
    do_import = parse_bool(args.do_import, true);
    do_repair = parse_bool(args.do_repair, true);
    skip_active = parse_bool(args.skip_active, true);
    if args.mode != () {
        let m = trimmed(`${args.mode}`);
        if m == "shell" || m == "agent" { mode = m; }
    }
    if args.ids != () {
        if type_of(args.ids) == "array" {
            for x in args.ids {
                let s = trimmed(`${x}`);
                if s != "" && is_agustin_es(s) { explicit_ids.push(s); }
            }
        } else {
            let raw = trimmed(`${args.ids}`);
            let cur = "";
            let i = 0;
            while i < raw.len() {
                let ch = raw.sub_string(i, 1);
                if ch == "," {
                    let t = trimmed(cur);
                    if t != "" && is_agustin_es(t) { explicit_ids.push(t); }
                    cur = "";
                } else {
                    cur += ch;
                }
                i += 1;
            }
            let t = trimmed(cur);
            if t != "" && is_agustin_es(t) { explicit_ids.push(t); }
        }
    }
}

log("reocr-max-compute execute=" + `${execute}` + " mode=" + mode + " workers_arg=" + workers_arg.to_string() + " jobs_arg=" + jobs_arg.to_string());

// =============================================================================
phase("Descubrir + sintonizar");
// =============================================================================

let disc = "MAX-COMPUTE discover for local re-OCR (Agustín ES). NEVER download. ";
disc += "MUST use tools: run_terminal_command, read_file. ";
disc += "1) nproc → nproc. free -g → memGiB approx. ";
disc += "2) Read documentos/padres-source/inventory/agustin-volumes.json. ";
disc += "3) DONE rule: clean/*.txt AND both content.json (corpus + assets) mtime >= 2026-07-26 14:00 ";
disc += "   AND unitCount>0 AND dual unitCounts equal. ";
disc += "4) PENDING = agustin-*-es with local PDF under padres-source/pdf/ that fail DONE. ";
disc += "5) pgrep -af 'tesseract|pdftoppm|reocr_local|reocr_priority|ocr_volume' → activeOcr + activeDocIds if detectable. ";
disc += "6) AUTO-TUNE for max CPU without thrash (RAM~31Gi, typical 8 cores): ";
disc += "   Prefer workers×jobsPerWorker ≈ nproc (leave 0–1 core free if nproc>=8). ";
disc += "   Many pending + large pages: more workers, fewer jobs (e.g. 4×2 on 8-core). ";
disc += "   Few pending: 2×4 or 1×nproc. Cap workers at 4 (disk+RAM for page PNGs). ";
disc += "   Cap jobsPerWorker at 8. Min jobs=2. ";
if workers_arg > 0 {
    disc += "User forced workers=" + workers_arg.to_string() + ". ";
}
if jobs_arg > 0 {
    disc += "User forced jobsPerWorker=" + jobs_arg.to_string() + ". ";
}
disc += "7) totalThreads = workers * jobsPerWorker. ";
if explicit_ids.len() > 0 {
    disc += "User ids filter (keep if pending or force): " + json_encode(explicit_ids) + ". ";
}
disc += "Return structured output only after real file checks.";

let dres = agent(disc, #{
    label: "discover-tune",
    capability_mode: "execute",
    output_schema: discover_schema,
});

let pending = [];
let nproc = 8;
let workers = 4;
let jobs_pw = 2;
let active_ocr = false;
let active_docs = [];

if dres != () && dres.success && dres.output != () {
    if dres.output.nproc != () { nproc = dres.output.nproc; }
    if dres.output.workers != () { workers = dres.output.workers; }
    if dres.output.jobsPerWorker != () { jobs_pw = dres.output.jobsPerWorker; }
    if dres.output.activeOcr == true { active_ocr = true; }
    if dres.output.activeDocIds != () {
        for x in dres.output.activeDocIds {
            let s = trimmed(`${x}`);
            if s != "" { active_docs.push(s); }
        }
    }
    if dres.output.pendingIds != () {
        for id in dres.output.pendingIds {
            let s = trimmed(`${id}`);
            if is_agustin_es(s) { pending.push(s); }
        }
    }
}

// Script-level overrides + safety clamps (agents don't enforce invariants)
if workers_arg > 0 { workers = workers_arg; }
if jobs_arg > 0 { jobs_pw = jobs_arg; }
if workers < 1 { workers = 1; }
if workers > 4 {
    log("workers clamped to 4 (PNG RAM + pdftoppm thrash)");
    workers = 4;
}
if jobs_pw < 2 { jobs_pw = 2; }
if jobs_pw > 8 { jobs_pw = 8; }

// If auto and product far from nproc, rebalance toward nproc
if workers_arg == 0 && jobs_arg == 0 && nproc > 0 {
    let prod = workers * jobs_pw;
    if prod > nproc + 1 {
        // shrink jobs first
        while jobs_pw > 2 && workers * jobs_pw > nproc {
            jobs_pw = jobs_pw - 1;
        }
    }
    if workers * jobs_pw < nproc - 1 && workers < 4 && pending.len() >= workers + 1 {
        // try more workers if backlog allows
        let try_w = workers + 1;
        if try_w * jobs_pw <= nproc + 1 { workers = try_w; }
    }
}

if explicit_ids.len() > 0 {
    let filtered = [];
    for id in explicit_ids {
        let in_pend = false;
        for p in pending {
            if p == id { in_pend = true; }
        }
        // force explicit even if discover misclassified, unless currently OCRing by sibling
        if in_pend || pending.len() == 0 { filtered.push(id); }
        else { filtered.push(id); }
    }
    pending = filtered;
}

// Drop ids already being OCR'd by another process if skip_active
if skip_active && active_docs.len() > 0 {
    let kept = [];
    for id in pending {
        let busy = false;
        for a in active_docs {
            if a == id { busy = true; }
        }
        if busy {
            log("skip busy " + id);
        } else {
            kept.push(id);
        }
    }
    pending = kept;
}

if pending.len() == 0 {
    log("no pending after discover");
    let empty_md = "# reocr-max-compute\n\nNo pending volumes (or all busy). activeOcr=" + `${active_ocr}` + "\n";
    let ep = write_scratch_file("reocr-max-compute-report.md", empty_md);
    complete(#{
        summary: "no-pending",
        execute: execute,
        pendingCount: 0,
        workers: workers,
        jobsPerWorker: jobs_pw,
        activeOcr: active_ocr,
        report_path: ep,
    });
}

log("pending=" + pending.len().to_string() + " nproc=" + nproc.to_string() + " workers=" + workers.to_string() + " jobs/worker=" + jobs_pw.to_string() + " threads≈" + (workers * jobs_pw).to_string() + " activeOcr=" + `${active_ocr}`);
write_scratch_file("reocr-max-compute-pending.json", json_encode(#{
    pending: pending,
    workers: workers,
    jobsPerWorker: jobs_pw,
    nproc: nproc,
    mode: mode,
    activeOcr: active_ocr,
}));

if active_ocr && execute && skip_active {
    log("host OCR active — will only process non-busy pending; monitor thrash");
}

if !execute {
    let plan_md = "# reocr-max-compute plan-only\n\n";
    plan_md += "| param | value |\n|---|---|\n";
    plan_md += "| nproc | " + nproc.to_string() + " |\n";
    plan_md += "| workers | " + workers.to_string() + " |\n";
    plan_md += "| jobsPerWorker | " + jobs_pw.to_string() + " |\n";
    plan_md += "| totalThreads | " + (workers * jobs_pw).to_string() + " |\n";
    plan_md += "| mode | " + mode + " |\n";
    plan_md += "| pending | " + pending.len().to_string() + " |\n";
    plan_md += "| activeOcr | " + `${active_ocr}` + " |\n\n";
    plan_md += "## Pipeline (max CPU)\n\n";
    plan_md += "1. **OCR wave** — up to " + workers.to_string() + " subagents; each runs only `reocr_local_volume.sh` (no import).\n";
    plan_md += "2. **Import+repair wave** — parallel after OCR barrier (ts-node; lighter).\n";
    plan_md += "3. **Commit serial** — never push.\n";
    plan_md += "4. Repeat waves until pending empty or max_waves.\n\n";
    plan_md += "## Pending\n\n";
    for id in pending {
        plan_md += "- `" + id + "`\n";
    }
    plan_md += "\n## Run\n\n```\n";
    plan_md += "/workflow reocr-max-compute {\"execute\":true,\"workers\":" + workers.to_string() + ",\"jobs_per\":" + jobs_pw.to_string() + ",\"mode\":\"agent\",\"do_commit\":true}\n";
    plan_md += "```\n\n";
    plan_md += "Shell bulk alternative: `mode:\"shell\"` → one agent runs `reocr_parallel_wave.sh` per wave.\n";
    let pp = write_scratch_file("reocr-max-compute-report.md", plan_md);
    complete(#{
        summary: "plan-only reocr-max-compute",
        execute: false,
        pendingCount: pending.len(),
        workers: workers,
        jobsPerWorker: jobs_pw,
        totalThreads: workers * jobs_pw,
        mode: mode,
        pending: pending,
        report_path: pp,
    });
}

// =============================================================================
// EXECUTE path
// =============================================================================

let ocr_ok = [];
let ocr_fail = [];
let import_ok = [];
let import_fail = [];
let wave = 0;
let idx = 0;

while wave < max_waves && idx < pending.len() {
    wave += 1;
    let wave_ids = [];
    let w = 0;
    while w < workers && idx < pending.len() {
        wave_ids.push(pending[idx]);
        idx += 1;
        w += 1;
    }
    log("WAVE " + wave.to_string() + " OCR size=" + wave_ids.len().to_string() + " " + json_encode(wave_ids));

    // -------------------------------------------------------------------------
    phase("OCR paralelo");
    // -------------------------------------------------------------------------
    let wave_ocr_ok = [];

    if mode == "shell" {
        // Build CSV in Rhai so agent does not invent ids
        let csv = "";
        let ci = 0;
        for id in wave_ids {
            if ci > 0 { csv += ","; }
            csv += id;
            ci += 1;
        }
        // One orchestrator: OS-level parallel OCR (true concurrent tesseract)
        let sh = "SHELL-WAVE max-compute OCR. HARD: no download, no push. ";
        sh += "cd to documentos-vaticanos/scripts-descarga. Run EXACTLY (wait for DONE):\n";
        sh += "REOCR_IDS='" + csv + "' WORKERS=" + wave_ids.len().to_string() + " ";
        sh += "OCR_JOBS=" + jobs_pw.to_string() + " PHASE=ocr DO_IMPORT=0 DO_REPAIR=0 REOCR_COMMIT=0 ";
        sh += "bash reocr_parallel_wave.sh\n";
        sh += "Then verify each clean file non-empty for: " + csv + ". ";
        sh += "success=true only if ALL cleans ok. documentId=wave phase=ocr-shell. ";
        sh += "logTail=last 40 lines of the wave log under /tmp/dv-reocr-logs/. ";
        sh += "If any FAIL OCR, success=false and put failed ids in error.";
        let shell_res = agent(sh, #{
            label: "shell-ocr:w" + wave.to_string(),
            capability_mode: "execute",
            output_schema: ocr_schema,
        });
        if shell_res != () && shell_res.success && shell_res.output != () && shell_res.output.success == true {
            for id in wave_ids {
                ocr_ok.push(id);
                wave_ocr_ok.push(id);
            }
            log("shell OCR wave OK");
        } else {
            // verify cleans on host via a follow-up is too heavy; mark fail for safety
            // but still try to salvage ids with fresh clean via second agent? skip — fail closed
            for id in wave_ids {
                ocr_fail.push(id);
            }
            log("shell OCR wave FAIL");
        }
    } else {
        // Agent-per-volume: max isolation, parallel() barrier
        let ojobs = [];
        for id in wave_ids {
            let pr = "MAX-COMPUTE OCR worker — ONE volume only. documentId=" + id + ". ";
            pr += "HARD rules: no Drive/download; no git push; no other volumes; do NOT import yet. ";
            pr += "1) Repo root = documentos-vaticanos; cd scripts-descarga. ";
            pr += "2) Export OMP_THREAD_LIMIT=1 OCR_JOBS=" + jobs_pw.to_string() + ". ";
            pr += "3) Workdir /tmp/dv-ocr/" + id + " is private — safe with sibling workers. ";
            pr += "4) Run and WAIT (do not background):\n";
            pr += "   ./reocr_local_volume.sh --doc-id " + id + " --jobs " + jobs_pw.to_string() + " --dpi 130 --force-rerender\n";
            pr += "5) On success: clean at documentos/padres-source/clean/" + id + ".txt must be non-empty. ";
            pr += "6) Return success=true, phase=ocr, cleanBytes=wc -c, pages if known, logTail last 25 lines. ";
            pr += "If already fresh clean from THIS campaign (mtime after 2026-07-26 14:00 and large), you MAY skip re-OCR and success=true phase=ocr-skip. ";
            pr += "Long OCR (300–500 pages) can take 30–90+ min — wait fully.";
            ojobs.push(#{
                prompt: pr,
                label: "ocr:" + id,
                capability_mode: "execute",
                output_schema: ocr_schema,
            });
        }
        let ores = parallel(ojobs);
        let oi = 0;
        for r in ores {
            let id = wave_ids[oi];
            if r != () && r.success && r.output != () && r.output.success == true {
                ocr_ok.push(id);
                wave_ocr_ok.push(id);
                log("OCR OK " + id);
            } else {
                ocr_fail.push(id);
                log("OCR FAIL " + id);
            }
            oi += 1;
        }
    }

    // -------------------------------------------------------------------------
    phase("Import + repair paralelo");
    // -------------------------------------------------------------------------
    if do_import && wave_ocr_ok.len() > 0 {
        let ijobs = [];
        for id in wave_ocr_ok {
            let ip = "MAX-COMPUTE import+repair worker — ONE volume. documentId=" + id + ". ";
            ip += "HARD: no download, no push, no re-OCR. Clean must already exist. ";
            ip += "1) cd scripts-descarga. ";
            ip += "2) Resolve n from inventory agustin-volumes.json where corpusDocId==" + id + ". ";
            ip += "3) npx ts-node --transpile-only ocr_import_agustin_clean.ts --n <n> ";
            ip += "   (dual-writes corpus + assets; unitIndex may resegment — expected). ";
            if do_repair {
                ip += "4) npx ts-node --transpile-only repair_ocr_noise_corpus.ts --apply --ids " + id + ". ";
            }
            ip += "5) Verify unitCount: documentos/corpus/documents/" + id + "/content.json ";
            ip += "   vs frontend/src/assets/corpus/documents/" + id + "/content.json equal and >0. ";
            ip += "Return success, phase=import, unitCount, dualMatch, repaired, logTail.";
            ijobs.push(#{
                prompt: ip,
                label: "imp:" + id,
                capability_mode: "execute",
                output_schema: import_schema,
            });
        }
        let ires = parallel(ijobs);
        let ii = 0;
        let wave_imp_ok = [];
        for r in ires {
            let id = wave_ocr_ok[ii];
            if r != () && r.success && r.output != () && r.output.success == true {
                import_ok.push(id);
                wave_imp_ok.push(id);
                log("import OK " + id);
            } else {
                import_fail.push(id);
                log("import FAIL " + id);
            }
            ii += 1;
        }

        // ---------------------------------------------------------------------
        phase("Commit serial");
        // ---------------------------------------------------------------------
        if do_commit && wave_imp_ok.len() > 0 {
            let cp = "Serial git COMMIT only (NEVER push) for ids: " + json_encode(wave_imp_ok) + ". ";
            cp += "Branch typescript-migration. Stage per id: ";
            cp += "documentos/corpus/documents/<id>/, frontend/src/assets/corpus/documents/<id>/, ";
            cp += "documentos/padres-source/clean/<id>.txt, documentos/corpus/revisions/ocr-abc/<id>.json; ";
            cp += "plus manifests, ocr-abc-inventory, ocr-reocr-queue, revisions/_summary, registry if changed. ";
            cp += "git commit -m \"feat(corpus): max-compute re-OCR wave " + wave.to_string() + " (local, no push)\\n\\n";
            cp += "unitIndex resegmented: " + json_encode(wave_imp_ok) + "\" ";
            cp += "Return success, message, filesStaged, sha. Empty tree → success=true message=empty.";
            let cres = agent(cp, #{
                label: "commit:w" + wave.to_string(),
                capability_mode: "execute",
                output_schema: commit_schema,
            });
            if cres != () && cres.success && cres.output != () {
                log("commit " + `${cres.output.message}`);
            } else {
                log("commit wave " + wave.to_string() + " failed");
            }
        }
    } else if !do_import {
        // OCR-only mode: treat ocr_ok as final
        for id in wave_ocr_ok {
            import_ok.push(id);
        }
    }
}

// =============================================================================
phase("Verificar + informe");
// =============================================================================

let final_ok = import_ok;
let sample = [];
let si = 0;
while si < final_ok.len() && sample.len() < 4 {
    sample.push(final_ok[si]);
    si += 1;
}
if sample.len() > 0 {
    let vjobs = [];
    for id in sample {
        let vp = "Verify dual-write after max-compute re-OCR for " + id + ". ";
        vp += "Read both content.json unit counts + clean size. ";
        vp += "success=true only if units>0 and dual equal. phase=verify documentId=" + id + " unitCount=N dualMatch=bool.";
        vjobs.push(#{
            prompt: vp,
            label: "verify:" + id,
            capability_mode: "execute",
            output_schema: import_schema,
        });
    }
    let _vr = parallel(vjobs);
    log("verify panel=" + sample.len().to_string());
}

let synth = "Spanish markdown report: reocr-max-compute. ";
synth += "nproc=" + nproc.to_string() + " workers=" + workers.to_string() + " jobsPerWorker=" + jobs_pw.to_string() + " ";
synth += "mode=" + mode + " waves=" + wave.to_string() + ". ";
synth += "ocr_ok=" + json_encode(ocr_ok) + " ocr_fail=" + json_encode(ocr_fail) + " ";
synth += "import_ok=" + json_encode(import_ok) + " import_fail=" + json_encode(import_fail) + ". ";
synth += "Sections: CPU packing (workers×jobs), tabla OK/FAIL, commits no-push, next pending. ";
synth += "throughputHint one line. okCount=import_ok len, failCount=ocr_fail+import_fail unique.";

let rep = agent(synth, #{
    label: "report",
    capability_mode: "read-only",
    output_schema: report_schema,
});

let title = "reocr-max-compute";
let md = "";
if rep != () && rep.success && rep.output != () {
    if rep.output.title != () { title = `${rep.output.title}`; }
    if rep.output.markdown != () { md = `${rep.output.markdown}`; }
}
if md == "" {
    md = "workers=" + workers.to_string() + " jobs=" + jobs_pw.to_string() + " waves=" + wave.to_string() + "\n";
}

let full = "# " + title + "\n\n";
full += "_threads≈" + (workers * jobs_pw).to_string() + " mode=" + mode + "_\n\n";
full += md;
full += "\n\n## OCR OK\n";
for id in ocr_ok { full += "- `" + id + "`\n"; }
full += "\n## OCR FAIL\n";
for id in ocr_fail { full += "- `" + id + "`\n"; }
full += "\n## Import OK\n";
for id in import_ok { full += "- `" + id + "`\n"; }
full += "\n## Import FAIL\n";
for id in import_fail { full += "- `" + id + "`\n"; }

let rpath = write_scratch_file("reocr-max-compute-report.md", full);
log("report " + rpath);

complete(#{
    summary: title,
    execute: true,
    mode: mode,
    workers: workers,
    jobsPerWorker: jobs_pw,
    totalThreads: workers * jobs_pw,
    waves: wave,
    ocrOk: ocr_ok,
    ocrFail: ocr_fail,
    importOk: import_ok,
    importFail: import_fail,
    okCount: import_ok.len(),
    failCount: ocr_fail.len() + import_fail.len(),
    report_path: rpath,
});
