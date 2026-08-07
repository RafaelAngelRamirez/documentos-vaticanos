let meta = #{
    name: "reocr-parallel",
    description: "Re-OCR paralelo de packs agustin-*-es pendientes usando solo PDFs locales. Fan-out de workers (N tomos a la vez) con tesseract jobs repartidos por núcleos; commit serial tras cada oleada; sin descarga y sin push por defecto.",
    when_to_use: "Cola residual grande de Agustín ES con PDFs en padres-source/pdf y máquina multi-core; maximizar CPU vs reocr_finish_all secuencial.",
    phases: [
        #{ title: "Descubrir pendientes", detail: "inventario + clean/content freshness + PDF local" },
        #{ title: "Oleadas paralelas", detail: "N workers OCR+import+repair en paralelo" },
        #{ title: "Commit serial", detail: "un commit por oleada, sin push" },
        #{ title: "Verificar", detail: "dual unit counts + muestra residual" },
        #{ title: "Informe", detail: "resumen de throughput y fallos" },
    ],
};

let discover_schema = #{
    "type": "object",
    "required": ["pendingIds", "nproc", "workers", "jobsPerWorker"],
    "properties": #{
        "pendingIds": #{ "type": "array", "maxItems": 40, "items": #{ "type": "string" } },
        "doneIds": #{ "type": "array", "maxItems": 40, "items": #{ "type": "string" } },
        "nproc": #{ "type": "integer" },
        "workers": #{ "type": "integer" },
        "jobsPerWorker": #{ "type": "integer" },
        "notes": #{ "type": "array", "items": #{ "type": "string" } },
        "activeOcr": #{ "type": "boolean" },
    },
};

let worker_schema = #{
    "type": "object",
    "required": ["documentId", "success", "phase"],
    "properties": #{
        "documentId": #{ "type": "string" },
        "success": #{ "type": "boolean" },
        "phase": #{ "type": "string" },
        "unitCount": #{ "type": "integer" },
        "cleanBytes": #{ "type": "integer" },
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

// --- args ---
// workers: parallel volumes (default 2 on 8-core → 4 tesseract each)
// jobs_per: tesseract -P jobs per volume (default nproc/workers)
// wave_size: max ids per wave (= workers)
// max_waves: safety cap
// execute: false = plan only
// do_commit: true = git commit after each wave (never push)
// do_import / do_repair
let execute = false;
let workers = 2;
let jobs_per = 0;
let max_waves = 20;
let do_commit = true;
let do_import = true;
let do_repair = true;
let explicit_ids = [];

if args != () {
    if args.execute != () {
        let e = `${args.execute}`;
        if e == "true" || e == "1" || e == "yes" { execute = true; }
        if type_of(args.execute) == "bool" && args.execute == true { execute = true; }
    }
    if args.workers != () {
        let w = trimmed(`${args.workers}`);
        if w == "1" { workers = 1; }
        else if w == "2" { workers = 2; }
        else if w == "3" { workers = 3; }
        else if w == "4" { workers = 4; }
        else if type_of(args.workers) == "i64" || type_of(args.workers) == "int" {
            workers = args.workers;
        }
    }
    if args.jobs_per != () {
        let j = trimmed(`${args.jobs_per}`);
        if j == "2" { jobs_per = 2; }
        else if j == "3" { jobs_per = 3; }
        else if j == "4" { jobs_per = 4; }
        else if j == "6" { jobs_per = 6; }
        else if j == "8" { jobs_per = 8; }
        else if type_of(args.jobs_per) == "i64" || type_of(args.jobs_per) == "int" {
            jobs_per = args.jobs_per;
        }
    }
    if args.max_waves != () {
        let m = trimmed(`${args.max_waves}`);
        if m == "1" { max_waves = 1; }
        else if m == "2" { max_waves = 2; }
        else if m == "5" { max_waves = 5; }
        else if m == "10" { max_waves = 10; }
        else if m == "20" { max_waves = 20; }
    }
    if args.do_commit != () {
        let v = `${args.do_commit}`;
        if v == "false" || v == "0" { do_commit = false; }
    }
    if args.do_import != () {
        let v = `${args.do_import}`;
        if v == "false" || v == "0" { do_import = false; }
    }
    if args.do_repair != () {
        let v = `${args.do_repair}`;
        if v == "false" || v == "0" { do_repair = false; }
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

if workers < 1 { workers = 1; }
if workers > 4 {
    log("workers capped at 4 to avoid thrashing");
    workers = 4;
}

log("reocr-parallel execute=" + `${execute}` + " workers=" + workers.to_string() + " jobs_per=" + jobs_per.to_string());

// =============================================================================
phase("Descubrir pendientes");
// =============================================================================

let disc = "Discover pending local re-OCR work for Agustín ES. NEVER download. ";
disc += "You MUST use tools (run_terminal_command, read_file, list_dir). ";
disc += "1) Run `nproc` and free -h; set nproc. ";
disc += "2) Read documentos/padres-source/inventory/agustin-volumes.json (40 volumes). ";
disc += "3) A pack is DONE if clean/*.txt AND dual content.json both mtime-fresh from campaign ";
disc += "   OR you detect import after clean: content unitCount>0 and clean non-empty AND ";
disc += "   content mtime >= 2026-07-26 for packs already re-OCR'd in this campaign. ";
disc += "   Safer rule used by project: treat as DONE if BOTH clean and content were updated ";
disc += "   after 2026-07-26 14:00 local and units match dual roots. ";
disc += "4) DONE set known: n=1,3,4,5,9,15,16,18,19,29,30 at least; re-verify and list any more. ";
disc += "5) PENDING = all other agustin-*-es with local PDF under padres-source/pdf/. ";
disc += "6) Check `pgrep -af tesseract|pdftoppm|reocr_finish` — if active OCR exists, set activeOcr=true ";
disc += "   and still return pendingIds but note that this wave should not start if user wants exclusivity. ";
disc += "7) Compute workers=" + workers.to_string() + " (from args). ";
disc += "   jobsPerWorker: if jobs_per arg is 0, use max(2, nproc/workers); else use arg. ";
disc += "8) Return pendingIds ordered by residual from ocr-reocr-queue.json when available. ";
if explicit_ids.len() > 0 {
    disc += "User forced ids filter: " + json_encode(explicit_ids) + " — only keep these if still pending. ";
}
disc += "Return structured output only after reading real files.";

let dres = agent(disc, #{
    label: "discover",
    capability_mode: "execute",
    output_schema: discover_schema,
});

let pending = [];
let nproc = 8;
let jobs_pw = 4;
let active_ocr = false;

if dres != () && dres.success && dres.output != () {
    if dres.output.nproc != () { nproc = dres.output.nproc; }
    if dres.output.jobsPerWorker != () { jobs_pw = dres.output.jobsPerWorker; }
    if dres.output.workers != () {
        // respect discovery if smaller
        if dres.output.workers < workers { workers = dres.output.workers; }
    }
    if dres.output.activeOcr == true { active_ocr = true; }
    if dres.output.pendingIds != () {
        for id in dres.output.pendingIds {
            let s = trimmed(`${id}`);
            if is_agustin_es(s) { pending.push(s); }
        }
    }
}

if jobs_per > 0 { jobs_pw = jobs_per; }
if jobs_pw < 2 { jobs_pw = 2; }

// Rhai filter explicit
if explicit_ids.len() > 0 {
    let filtered = [];
    for id in explicit_ids {
        // keep only if in pending or force all explicit
        let in_pend = false;
        for p in pending {
            if p == id { in_pend = true; }
        }
        if in_pend || pending.len() == 0 { filtered.push(id); }
    }
    if filtered.len() > 0 { pending = filtered; }
}

if pending.len() == 0 {
    // fallback seed of historically pending if discover failed
    log("discover empty — using residual seed fallback");
    pending.push("agustin-02-confesiones-es");
    pending.push("agustin-07-sermones-1-es");
    pending.push("agustin-08-cartas-1-es");
    pending.push("agustin-10-sermones-2-es");
}

log("pending=" + pending.len().to_string() + " nproc=" + nproc.to_string() + " workers=" + workers.to_string() + " jobs/worker=" + jobs_pw.to_string() + " activeOcr=" + `${active_ocr}`);
write_scratch_file("reocr-parallel-pending.json", json_encode(pending));

if active_ocr && execute {
    log("WARN: OCR already running on host — parallel wave may thrash; continuing only if exclusive workdirs differ");
}

if !execute {
    let plan_md = "# reocr-parallel plan-only\n\n";
    plan_md += "workers=" + workers.to_string() + " jobsPerWorker=" + jobs_pw.to_string() + " pending=" + pending.len().to_string() + "\n\n";
    plan_md += "## Pending\n\n";
    for id in pending {
        plan_md += "- `" + id + "`\n";
    }
    plan_md += "\n## Run\n\n```\n/workflow reocr-parallel {\"execute\":true,\"workers\":2,\"jobs_per\":4,\"max_waves\":20,\"do_commit\":true}\n```\n";
    plan_md += "\nCPU model: workers×jobsPerWorker ≈ cores (default 2×4 on 8-core).\n";
    plan_md += "Each worker runs one volume via reocr_local_volume.sh with private /tmp/dv-ocr/<doc-id>/.\n";
    plan_md += "Commits are serial after each wave; **no git push**.\n";
    let ppath = write_scratch_file("reocr-parallel-report.md", plan_md);
    complete(#{
        summary: "plan-only reocr-parallel",
        execute: false,
        pendingCount: pending.len(),
        workers: workers,
        jobsPerWorker: jobs_pw,
        report_path: ppath,
    });
}

// =============================================================================
phase("Oleadas paralelas");
// =============================================================================

let ok_ids = [];
let fail_ids = [];
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
    log("WAVE " + wave.to_string() + " size=" + wave_ids.len().to_string() + " " + json_encode(wave_ids));

    let jobs = [];
    for id in wave_ids {
        let pr = "PARALLEL local re-OCR worker for ONE document. ";
        pr += "documentId=" + id + ". HARD: no Drive/download; no git push; no other volumes. ";
        pr += "1) cd to repo scripts-descarga. ";
        pr += "2) Export OCR_JOBS=" + jobs_pw.to_string() + " so tesseract uses " + jobs_pw.to_string() + " cores for THIS volume only. ";
        pr += "3) Workdir is already /tmp/dv-ocr/" + id + " (per-doc — safe with siblings). ";
        pr += "4) Run: ./reocr_local_volume.sh --doc-id " + id + " --jobs " + jobs_pw.to_string() + " --dpi 130 --force-rerender ";
        if do_import {
            pr += "then npx ts-node --transpile-only ocr_import_agustin_clean.ts --n <N from inventory for this id>. ";
        }
        if do_repair {
            pr += "then npx ts-node --transpile-only repair_ocr_noise_corpus.ts --apply --ids " + id + ". ";
        }
        pr += "5) Prefer a single shell chain if cleaner: ";
        pr += "`OCR_JOBS=" + jobs_pw.to_string() + " ./reocr_local_volume.sh --doc-id " + id + " --jobs " + jobs_pw.to_string() + " --force-rerender` ";
        pr += "then import+repair as above. ";
        pr += "6) Verify dual content unit counts match. Report unitCount, cleanBytes, success, phase=ocr|import|repair|done, logTail last 30 lines. ";
        pr += "Wait for long OCR; do not background and return early.";
        jobs.push(#{
            prompt: pr,
            label: "w:" + id,
            capability_mode: "execute",
            output_schema: worker_schema,
        });
    }

    let wres = parallel(jobs);
    let wave_ok = [];
    let wi = 0;
    for r in wres {
        let id = wave_ids[wi];
        if r != () && r.success && r.output != () && r.output.success == true {
            ok_ids.push(id);
            wave_ok.push(id);
            log("worker OK " + id);
        } else {
            fail_ids.push(id);
            log("worker FAIL " + id);
        }
        wi += 1;
    }

    // =========================================================================
    phase("Commit serial");
    // =========================================================================
    if do_commit && wave_ok.len() > 0 {
        let cp = "Serial git COMMIT only (NEVER push) for successful wave ids: " + json_encode(wave_ok) + ". ";
        cp += "Repo: documentos-vaticanos on branch typescript-migration. ";
        cp += "Stage for each id: documentos/corpus/documents/<id>/, frontend/src/assets/corpus/documents/<id>/, ";
        cp += "documentos/padres-source/clean/<id>.txt, documentos/corpus/revisions/ocr-abc/<id>.json, ";
        cp += "plus manifests, ocr-abc-inventory, ocr-reocr-queue, revisions/_summary, registry if changed. ";
        cp += "git commit -m 'feat(corpus): parallel re-OCR wave " + wave.to_string() + " (local only, no push)\\n\\n";
        cp += "unitIndex resegmented for: " + json_encode(wave_ok) + "' ";
        cp += "If nothing to stage, success=true message=empty. Return sha of commit if any.";
        let cres = agent(cp, #{
            label: "commit:wave" + wave.to_string(),
            capability_mode: "execute",
            output_schema: commit_schema,
        });
        if cres != () && cres.success && cres.output != () {
            log("commit wave " + wave.to_string() + " " + `${cres.output.message}`);
        } else {
            log("commit wave " + wave.to_string() + " failed or empty");
        }
    }
}

// =============================================================================
phase("Verificar");
// =============================================================================

let vjobs = [];
// up to 3 parallel verifiers on ok_ids sample
let sample = [];
let si = 0;
while si < ok_ids.len() && sample.len() < 3 {
    sample.push(ok_ids[si]);
    si += 1;
}
for id in sample {
    let vp = "Verify dual-write for " + id + " after re-OCR. ";
    vp += "Read documentos/corpus/documents/" + id + "/content.json length and frontend assets twin; ";
    vp += "read clean txt size; confirm unitCount match. success=true only if units>0 and dual equal. ";
    vp += "phase=verify. documentId=" + id;
    vjobs.push(#{
        prompt: vp,
        label: "verify:" + id,
        capability_mode: "execute",
        output_schema: worker_schema,
    });
}
if vjobs.len() > 0 {
    let vr = parallel(vjobs);
    log("verify panel size=" + vr.len().to_string());
}

// =============================================================================
phase("Informe");
// =============================================================================

let synth = "Write Spanish markdown report for reocr-parallel run. ";
synth += "workers=" + workers.to_string() + " jobsPerWorker=" + jobs_pw.to_string() + " waves=" + wave.to_string() + ". ";
synth += "okIds=" + json_encode(ok_ids) + " failIds=" + json_encode(fail_ids) + ". ";
synth += "Sections: resumen CPU, tabla OK/FAIL, commits, next pending if any, no-push note. ";
synth += "title short. okCount failCount.";

let rep = agent(synth, #{
    label: "report",
    capability_mode: "read-only",
    output_schema: report_schema,
});

let title = "reocr-parallel";
let md = "";
let ok_c = ok_ids.len();
let fail_c = fail_ids.len();
if rep != () && rep.success && rep.output != () {
    if rep.output.title != () { title = `${rep.output.title}`; }
    if rep.output.markdown != () { md = `${rep.output.markdown}`; }
    if rep.output.okCount != () { ok_c = rep.output.okCount; }
    if rep.output.failCount != () { fail_c = rep.output.failCount; }
}
if md == "" {
    md = "# " + title + "\n\nok=" + ok_c.to_string() + " fail=" + fail_c.to_string() + "\n";
    md += "workers=" + workers.to_string() + " jobs/worker=" + jobs_pw.to_string() + "\n";
}

let full = "# " + title + "\n\n";
full += "_workers=" + workers.to_string() + " jobsPerWorker=" + jobs_pw.to_string() + "_\n\n";
full += md;
full += "\n\n## OK\n";
for id in ok_ids { full += "- `" + id + "`\n"; }
full += "\n## FAIL\n";
for id in fail_ids { full += "- `" + id + "`\n"; }

let rpath = write_scratch_file("reocr-parallel-report.md", full);
log("report " + rpath);

complete(#{
    summary: title,
    execute: true,
    workers: workers,
    jobsPerWorker: jobs_pw,
    waves: wave,
    okCount: ok_ids.len(),
    failCount: fail_ids.len(),
    okIds: ok_ids,
    failIds: fail_ids,
    report_path: rpath,
});
