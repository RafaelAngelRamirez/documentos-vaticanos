let meta = #{
    name: "analyze-es-syntax",
    description: "Analiza a fondo la estructura del corpus y la sintaxis residual de packs en español (prioridad San Agustín / OCR BAC), en paralelo; compara con repair_ocr_* y produce un informe accionable.",
    when_to_use: "Cuando haya basura OCR, ortografía rota o prosa ilegible en documentos ES ya importados; especialmente volúmenes agustin-*-es tras ocr-punct/ocr-abc.",
    phases: [
        #{ title: "Mapa estructura", detail: "layout, modelos, pipeline OCR y cobertura de repair" },
        #{ title: "Inventario ES", detail: "listar packs locale=es y priorizar peores candidatos" },
        #{ title: "Análisis sintaxis", detail: "un agente por documento: muestreo de unidades y taxonomía de defectos" },
        #{ title: "Huecos vs repair", detail: "qué ya cubre ocr-punct/ocr-abc y qué no" },
        #{ title: "Informe", detail: "síntesis markdown con prioridades y reglas propuestas" },
    ],
};

// --- schemas ---
let structure_schema = #{
    "type": "object",
    "required": ["summary", "key_paths", "unit_shape", "notes"],
    "properties": #{
        "summary": #{ "type": "string" },
        "key_paths": #{ "type": "array", "maxItems": 20, "items": #{ "type": "string" } },
        "unit_shape": #{ "type": "string" },
        "notes": #{ "type": "array", "maxItems": 12, "items": #{ "type": "string" } },
    },
};

let inventory_schema = #{
    "type": "object",
    "required": ["docs"],
    "properties": #{
        "docs": #{
            "type": "array",
            "maxItems": 40,
            "items": #{
                "type": "object",
                "required": ["id", "priority", "reason"],
                "properties": #{
                    "id": #{ "type": "string" },
                    "kind": #{ "type": "string" },
                    "unitCount": #{ "type": "integer" },
                    "priority": #{ "type": "integer" },
                    "reason": #{ "type": "string" },
                    "queueReocr": #{ "type": "boolean" },
                    "residualHints": #{ "type": "array", "items": #{ "type": "string" } },
                },
            },
        },
        "es_total": #{ "type": "integer" },
        "agustin_es_total": #{ "type": "integer" },
        "notes": #{ "type": "array", "items": #{ "type": "string" } },
    },
};

let syntax_schema = #{
    "type": "object",
    "required": ["documentId", "unitsSampled", "severity", "defectClasses", "severityScore"],
    "properties": #{
        "documentId": #{ "type": "string" },
        "unitsTotal": #{ "type": "integer" },
        "unitsSampled": #{ "type": "integer" },
        "severityScore": #{ "type": "integer" },
        "defectClasses": #{
            "type": "array",
            "maxItems": 16,
            "items": #{
                "type": "object",
                "required": ["class", "count", "examples"],
                "properties": #{
                    "class": #{ "type": "string" },
                    "count": #{ "type": "integer" },
                    "coveredByExistingRepair": #{ "type": "string" },
                    "examples": #{
                        "type": "array",
                        "maxItems": 4,
                        "items": #{
                            "type": "object",
                            "required": ["unitIndex", "snippet"],
                            "properties": #{
                                "unitIndex": #{ "type": "integer" },
                                "snippet": #{ "type": "string" },
                                "consecutivo": #{ "type": "string" },
                            },
                        },
                    },
                },
            },
        },
        "frontMatterNoise": #{ "type": "boolean" },
        "bodyProseNoise": #{ "type": "boolean" },
        "indexGarbage": #{ "type": "boolean" },
        "findings": #{ "type": "array", "maxItems": 10, "items": #{ "type": "string" } },
        "suggestedRules": #{ "type": "array", "maxItems": 8, "items": #{ "type": "string" } },
    },
};

let gap_schema = #{
    "type": "object",
    "required": ["gaps", "alreadyCovered", "summary"],
    "properties": #{
        "summary": #{ "type": "string" },
        "alreadyCovered": #{ "type": "array", "maxItems": 12, "items": #{ "type": "string" } },
        "gaps": #{
            "type": "array",
            "maxItems": 16,
            "items": #{
                "type": "object",
                "required": ["class", "whyNotCovered", "fixSafety", "proposedApproach"],
                "properties": #{
                    "class": #{ "type": "string" },
                    "whyNotCovered": #{ "type": "string" },
                    "fixSafety": #{ "type": "string" },
                    "proposedApproach": #{ "type": "string" },
                    "evidenceDocs": #{ "type": "array", "items": #{ "type": "string" } },
                },
            },
        },
        "doNotTouch": #{ "type": "array", "maxItems": 8, "items": #{ "type": "string" } },
    },
};

let report_schema = #{
    "type": "object",
    "required": ["title", "markdown", "topDocs", "nextSteps"],
    "properties": #{
        "title": #{ "type": "string" },
        "markdown": #{ "type": "string" },
        "topDocs": #{ "type": "array", "items": #{ "type": "string" } },
        "nextSteps": #{ "type": "array", "maxItems": 12, "items": #{ "type": "string" } },
        "ruleCandidates": #{ "type": "array", "maxItems": 12, "items": #{ "type": "string" } },
    },
};

// --- helpers ---
fn trimmed(s) {
    if type_of(s) == "string" {
        s.trim();
        s
    } else {
        ""
    }
}

fn contains_substr(hay, needle) {
    if type_of(hay) != "string" || type_of(needle) != "string" { return false; }
    if needle == "" { return true; }
    let i = 0;
    let nlen = needle.len();
    let hlen = hay.len();
    if nlen > hlen { return false; }
    while i + nlen <= hlen {
        if hay.sub_string(i, nlen) == needle { return true; }
        i += 1;
    }
    false
}

fn ends_with_es(id) {
    if type_of(id) != "string" || id.len() < 3 { return false; }
    id.sub_string(id.len() - 3, 3) == "-es"
}

fn is_agustin_es(id) {
    if type_of(id) != "string" { return false; }
    if !ends_with_es(id) { return false; }
    contains_substr(id, "agustin-")
}

fn scope_allows(id, scope) {
    if type_of(id) != "string" || id == "" { return false; }
    if !ends_with_es(id) { return false; }
    if scope == "agustin-es" || scope == "agustin" { return is_agustin_es(id); }
    if scope == "patristic-es" || scope == "patristic" {
        // allow any -es; inventory should prefer patristic; still filter twins later
        return true;
    }
    if scope == "all-es" || scope == "es" { return true; }
    // default agustin
    is_agustin_es(id)
}

// --- args ---
let scope = "agustin-es";
let max_docs = 8;
let explicit_ids = [];
let sample_hint = "front+body+tail";

if args != () {
    if args.scope != () { scope = trimmed(`${args.scope}`); }
    if args.max_docs != () {
        // accept number or string
        if type_of(args.max_docs) == "i64" || type_of(args.max_docs) == "int" {
            max_docs = args.max_docs;
        } else {
            let md = trimmed(`${args.max_docs}`);
            if md != "" {
                // best-effort: known small caps only
                if md == "4" { max_docs = 4; }
                else if md == "6" { max_docs = 6; }
                else if md == "8" { max_docs = 8; }
                else if md == "10" { max_docs = 10; }
                else if md == "12" { max_docs = 12; }
                else if md == "16" { max_docs = 16; }
            }
        }
    }
    if args.sample != () { sample_hint = trimmed(`${args.sample}`); }
    if args.ids != () {
        if type_of(args.ids) == "array" {
            for x in args.ids {
                let s = trimmed(`${x}`);
                if s != "" && ends_with_es(s) { explicit_ids.push(s); }
            }
        } else {
            // comma-separated string
            let raw = trimmed(`${args.ids}`);
            // split on commas by hand
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
if max_docs > 16 {
    log("max_docs capped at 16 (was higher)");
    max_docs = 16;
}

log("analyze-es-syntax scope=" + scope + " max_docs=" + max_docs.to_string() + " explicit_ids=" + explicit_ids.len().to_string());

// Seed defaults known-hot from prior residual / re-OCR queue (used if inventory fails).
let seed_ids = [
    "agustin-32-antidonatistas-1-es",
    "agustin-34-antidonatistas-3-es",
    "agustin-35-antipelagianos-3-es",
    "agustin-18-epistolas-indices-es",
    "agustin-15-tratados-escriturarios-es",
    "agustin-12-tratados-morales-es",
    "agustin-31-antimaniqueos-2-es",
    "agustin-01-primeros-escritos-es",
    "agustin-05-de-trinitate-es",
    "agustin-02-confesiones-es",
    "agustin-16-ciudad-de-dios-1-es",
    "agustin-17-ciudad-de-dios-2-es",
];

// =============================================================================
phase("Mapa estructura");
// =============================================================================

let structure_jobs = [];

let p_layout = "Map the offline corpus structure for Documentos Vaticanos. ";
p_layout += "You MUST use read-only tools (read_file, list_dir, grep) — do not invent paths. ";
p_layout += "Read and summarize: (1) documentos/corpus/manifest.json shape (sample a few DocumentMeta fields), ";
p_layout += "(2) per-doc layout documents/<id>/{content.json,index.json,meta.json}, ";
p_layout += "(3) scripts-descarga/models/corpus.model.ts and transport_data.model.ts unit fields (consecutivo, contenido, referencias), ";
p_layout += "(4) dual-write CORPUS_ROOTS in scripts-descarga/src/pipeline/write_corpus.ts, ";
p_layout += "(5) docs/CORPUS-STRUCTURE-ANALYSIS.md if present. ";
p_layout += "Explain stable citas = documentId + unitIndex (array order). ";
p_layout += "Return unit_shape as a short description of one content.json unit. key_paths = absolute or repo-relative paths you actually opened.";
structure_jobs.push(#{
    prompt: p_layout,
    label: "struct:layout",
    capability_mode: "read-only",
    output_schema: structure_schema,
});

let p_repair = "Map existing OCR cleanup / repair code for Spanish/Patristic corpus. ";
p_repair += "You MUST use read-only tools. Open and summarize what each covers and what it REFUSES to do: ";
p_repair += "scripts-descarga/src/pipeline/repair_ocr_punctuation.ts, ";
p_repair += "scripts-descarga/src/pipeline/repair_ocr_noise.ts, ";
p_repair += "scripts-descarga/src/pipeline/plain_text_units.ts (stripPdfChrome, rejoinHyphenation, softNormalize), ";
p_repair += "scripts-descarga/repair_ocr_punctuation_corpus.ts, repair_ocr_noise_corpus.ts, ";
p_repair += "import_agustin_volume.ts / ocr_import_agustin_clean.ts entry points. ";
p_repair += "List known inventories under documentos/corpus/: ocr-punct-inventory.json, ocr-abc-inventory.json, ocr-reocr-queue.json. ";
p_repair += "In notes, call out residual classes intentionally NOT fixed (e.g. lowercase.period.lowercase joins).";
structure_jobs.push(#{
    prompt: p_repair,
    label: "struct:repair",
    capability_mode: "read-only",
    output_schema: structure_schema,
});

let p_agustin = "Map the San Agustín ES pack pipeline and source layout. ";
p_agustin += "You MUST use tools. Read documentos/padres-source/inventory (agustin volumes), ";
p_agustin += "list a few clean/ texts, read import_agustin_volume.ts and ocr_import_agustin_clean.ts, ";
p_agustin += "count how many manifest documents have id starting with agustin- and locale es. ";
p_agustin += "Describe typical front-matter BAC chrome (comisión, MCML, Editorial Católica) that often survives into early unitIndex. ";
p_agustin += "Note that locale twins (en/hi/zh/ar) often clone ES unitCount — analysis should target *-es only.";
structure_jobs.push(#{
    prompt: p_agustin,
    label: "struct:agustin",
    capability_mode: "read-only",
    output_schema: structure_schema,
});

let structure_results = parallel(structure_jobs);
let structure_ok = 0;
let structure_summaries = [];
for r in structure_results {
    if r != () && r.success && r.output != () {
        structure_ok += 1;
        if r.output.summary != () {
            structure_summaries.push(trimmed(`${r.output.summary}`));
        }
    }
}
log("structure agents ok=" + structure_ok.to_string() + "/" + structure_results.len().to_string());
write_scratch_file("structure_ok_count", structure_ok.to_string());

// =============================================================================
phase("Inventario ES");
// =============================================================================

let inv_prompt = "Build a PRIORITY inventory of Spanish corpus documents for residual OCR/syntax analysis. ";
inv_prompt += "You MUST use tools (read_file/grep). ";
inv_prompt += "1) Read documentos/corpus/manifest.json — filter locale=='es' (or id ending -es). ";
inv_prompt += "2) Read documentos/corpus/ocr-abc-inventory.json and ocr-reocr-queue.json — prefer queueReocr / high residualScore. ";
inv_prompt += "3) Read ocr-punct-inventory.json targets if present. ";
inv_prompt += "4) Prefer scope='" + scope + "': if agustin-es, only agustin-*-es; if patristic-es, kind patristic *-es; if all-es, any *-es. ";
inv_prompt += "5) Rank worst residual quality first. Include unitCount when known. ";
inv_prompt += "6) Return at most 40 docs with priority 1=worst. Reasons must cite inventory metrics or sampled evidence if you open content. ";
inv_prompt += "Do not invent document ids — only ids present in the manifest. Empty docs only if you proved zero ES docs.";

let inv = agent(inv_prompt, #{
    label: "inventory:es",
    capability_mode: "read-only",
    output_schema: inventory_schema,
});

let work_ids = [];
let work_reasons = #{};

if explicit_ids.len() > 0 {
    for id in explicit_ids {
        if scope_allows(id, scope) {
            work_ids.push(id);
            work_reasons[id] = "args.ids";
        } else {
            log("dropped out-of-scope explicit id: " + id);
        }
    }
} else if inv != () && inv.success && inv.output != () && inv.output.docs != () {
    // sort-ish: agents should already rank; take in order, re-filter
    for d in inv.output.docs {
        if d == () || d.id == () { continue; }
        let id = trimmed(`${d.id}`);
        if id == "" { continue; }
        if !scope_allows(id, scope) {
            log("dropped inventory id out of scope: " + id);
            continue;
        }
        // de-dupe
        let seen = false;
        for w in work_ids {
            if w == id { seen = true; }
        }
        if seen { continue; }
        work_ids.push(id);
        let reason = if d.reason != () { trimmed(`${d.reason}`) } else { "inventory" };
        work_reasons[id] = reason;
        if work_ids.len() >= max_docs { break; }
    }
}

// Fallback to seeds if inventory empty/failed
if work_ids.len() == 0 {
    log("inventory empty or failed — using seed_ids");
    for id in seed_ids {
        if scope_allows(id, scope) {
            work_ids.push(id);
            work_reasons[id] = "seed-hotlist";
        }
        if work_ids.len() >= max_docs { break; }
    }
}

// Cap
if work_ids.len() > max_docs {
    let capped = [];
    let i = 0;
    while i < max_docs {
        capped.push(work_ids[i]);
        i += 1;
    }
    log("capped work_ids " + work_ids.len().to_string() + " → " + max_docs.to_string());
    work_ids = capped;
}

log("work_ids (" + work_ids.len().to_string() + "):");
for id in work_ids {
    let reason = if work_reasons[id] != () { work_reasons[id] } else { "?" };
    log("  - " + id + " (" + reason + ")");
}

if work_ids.len() == 0 {
    complete(#{
        summary: "No Spanish document ids to analyze (check scope/args).",
        scope: scope,
        report_path: "",
    });
}

// =============================================================================
phase("Análisis sintaxis");
// =============================================================================

let syntax_jobs = [];
for id in work_ids {
    let pr = "Deep residual SYNTAX / OCR quality audit for ONE Spanish corpus pack. ";
    pr += "documentId=" + id + ". ";
    pr += "You MUST use tools — never invent unit text. ";
    pr += "Read documentos/corpus/documents/" + id + "/content.json (large JSON: sample strategically, do NOT load entire file into memory if tool truncates — use offset/limit or shell head/python sampling). ";
    pr += "Also peek meta if present and any revision under documentos/corpus/revisions/. ";
    pr += "Sampling strategy (" + sample_hint + "): ";
    pr += "(A) first ~80 units (front matter / BAC chrome), ";
    pr += "(B) ~40 mid-body units at regular strides, ";
    pr += "(C) last ~40 units (indices often garbage). ";
    pr += "For each unit inspect fields consecutivo + contenido. ";
    pr += "Classify residual defects NOT already fixed by ocr-punct/ocr-abc when possible: ";
    pr += "toc_dotted_garbage, bac_chrome_frontmatter, spaced_or_shredded_letters, internal_word_period (e.g. sancti.ficationis), ";
    pr += "hyphen_mid_line, glued_words (LOSSEÑORES), digit_glued_tokens, mojibake/replacement_chars, ";
    pr += "latin_mixed_into_spanish_body, wrong_column_merge (two-column OCR), accent_corruption, ";
    pr += "ellipses_leaders, page_headers_footers, index_noise, other_illegible. ";
    pr += "For coveredByExistingRepair use: full | partial | none | unknown. ";
    pr += "severityScore 0=clean readable Spanish, 100=mostly unusable. ";
    pr += "Give concrete snippets with unitIndex (0-based array index). Max 4 examples per class. ";
    pr += "suggestedRules: conservative mechanical fixes only (no theological paraphrase). ";
    pr += "Remember: unitIndex is stable — do not propose reordering units.";
    syntax_jobs.push(#{
        prompt: pr,
        label: "syntax:" + id,
        capability_mode: "read-only",
        output_schema: syntax_schema,
    });
}

let syntax_results = parallel(syntax_jobs);

let syntax_reports = [];
let i = 0;
for r in syntax_results {
    let id = work_ids[i];
    if r != () && r.success && r.output != () {
        syntax_reports.push(r.output);
        let score = if r.output.severityScore != () { `${r.output.severityScore}` } else { "?" };
        log("syntax ok " + id + " severity=" + score);
    } else {
        log("syntax FAILED " + id);
        // keep a stub so downstream knows
        syntax_reports.push(#{
            documentId: id,
            unitsSampled: 0,
            severityScore: -1,
            defectClasses: [],
            findings: ["agent_failed_or_empty"],
            suggestedRules: [],
        });
    }
    i += 1;
}

// Encode compact JSON for next phase prompts
let syntax_json = json_encode(syntax_reports);
write_scratch_file("syntax_reports.json", syntax_json);

// =============================================================================
phase("Huecos vs repair");
// =============================================================================

let gap_jobs = [];

let p_gap_punct = "Adversarial gap analysis: residual Spanish syntax defects vs repair_ocr_punctuation.ts. ";
p_gap_punct += "You MUST re-read scripts-descarga/src/pipeline/repair_ocr_punctuation.ts and its tests. ";
p_gap_punct += "Here is the JSON array of per-document syntax audits (evidence from sibling agents):\n";
p_gap_punct += syntax_json;
p_gap_punct += "\nFor each recurring defect class, decide if punctuation repair already covers it, partially covers it, or cannot safely cover it. ";
p_gap_punct += "FixSafety: safe_mechanical | risky | needs_reocr | human_edit. ";
p_gap_punct += "Prefer fail-closed: if unsure, say needs_reocr or human_edit. ";
p_gap_punct += "doNotTouch: things that would corrupt theology/abbreviations (art.cit, lowercase.period.lowercase joins, etc.).";
gap_jobs.push(#{
    prompt: p_gap_punct,
    label: "gap:punct",
    capability_mode: "read-only",
    output_schema: gap_schema,
});

let p_gap_noise = "Adversarial gap analysis: residual defects vs repair_ocr_noise.ts (spaced letters, short words, garbage blanking). ";
p_gap_noise += "You MUST re-read scripts-descarga/src/pipeline/repair_ocr_noise.ts. ";
p_gap_noise += "Evidence JSON:\n";
p_gap_noise += syntax_json;
p_gap_noise += "\nFocus on shredded indices, two-column merges, BAC front matter, residual body_noise that abc queue flags but does not fix. ";
p_gap_noise += "Propose ONLY conservative extensions (dictionary short words, chrome line patterns, stricter garbage). ";
p_gap_noise += "Never invent prose. unitIndex slots must stay.";
gap_jobs.push(#{
    prompt: p_gap_noise,
    label: "gap:noise",
    capability_mode: "read-only",
    output_schema: gap_schema,
});

let p_gap_import = "Gap analysis for import-time cleaning of Agustín BAC volumes. ";
p_gap_import += "Read plain_text_units.ts stripPdfChrome/rejoinHyphenation and import_agustin_volume.ts / ocr_import_agustin_clean.ts. ";
p_gap_import += "Evidence JSON:\n";
p_gap_import += syntax_json;
p_gap_import += "\nWhich defects should be fixed at clean-text import time vs post-corpus repair scripts? ";
p_gap_import += "Call out front-matter units that should be marked garbage placeholder rather than left as unreadable TOC. ";
p_gap_import += "List doNotTouch invariants (stable unitIndex, dual-write roots, no reindex).";
gap_jobs.push(#{
    prompt: p_gap_import,
    label: "gap:import",
    capability_mode: "read-only",
    output_schema: gap_schema,
});

let gap_results = parallel(gap_jobs);
let gap_payloads = [];
for r in gap_results {
    if r != () && r.success && r.output != () {
        gap_payloads.push(r.output);
    }
}
let gap_json = json_encode(gap_payloads);
write_scratch_file("gap_reports.json", gap_json);
log("gap agents ok=" + gap_payloads.len().to_string() + "/" + gap_results.len().to_string());

// =============================================================================
phase("Informe");
// =============================================================================

let struct_blob = json_encode(structure_summaries);
let work_blob = json_encode(work_ids);

let synth = "Write the final analysis report in Spanish (markdown) for Documentos Vaticanos. ";
synth += "This is a synthesis of prior read-only audits — you may re-open key files only to verify a claim. ";
synth += "Scope=" + scope + ". Documents analyzed: " + work_blob + ". ";
synth += "Structure summaries: " + struct_blob + ". ";
synth += "Syntax audits JSON: " + syntax_json + ". ";
synth += "Gap analyses JSON: " + gap_json + ". ";
synth += "Required markdown sections:\n";
synth += "1. Resumen ejecutivo\n";
synth += "2. Estructura del corpus (qué leímos, cómo se empaqueta un doc ES)\n";
synth += "3. Qué ya limpian ocr-punct / ocr-abc / stripPdfChrome\n";
synth += "4. Tabla de documentos analizados (id | severity | clases dominantes)\n";
synth += "5. Taxonomía de defectos residuales (con ejemplos unitIndex)\n";
synth += "6. Huecos de cobertura y reglas mecánicas candidatas (ordenadas por seguridad)\n";
synth += "7. Casos que requieren re-OCR o revisión humana\n";
synth += "8. Next steps concretos (comandos existentes: repair_ocr_* --inventory/--apply; no implementar código aquí)\n";
synth += "Be concrete, cite documentIds and unitIndexes. No inventar texto de unidades no vistos. ";
synth += "title short. topDocs = worst ids. nextSteps actionable. ruleCandidates one-line each.";

let report_agent = agent(synth, #{
    label: "report:final",
    capability_mode: "read-only",
    output_schema: report_schema,
});

let md = "";
let title = "Análisis sintaxis corpus ES";
let next_steps = [];
let top_docs = work_ids;
let rule_candidates = [];

if report_agent != () && report_agent.success && report_agent.output != () {
    if report_agent.output.markdown != () { md = `${report_agent.output.markdown}`; }
    if report_agent.output.title != () { title = `${report_agent.output.title}`; }
    if report_agent.output.nextSteps != () { next_steps = report_agent.output.nextSteps; }
    if report_agent.output.topDocs != () && report_agent.output.topDocs.len() > 0 {
        top_docs = report_agent.output.topDocs;
    }
    if report_agent.output.ruleCandidates != () { rule_candidates = report_agent.output.ruleCandidates; }
} else {
    md = "# Análisis sintaxis corpus ES (fallback)\n\n";
    md += "El agente de síntesis falló. Work ids: " + work_blob + "\n\n";
    md += "Revisa scratch syntax_reports.json y gap_reports.json del run.\n";
    md += "Structure ok agents: " + structure_ok.to_string() + "\n";
}

// Ensure markdown has some local header even if agent returned body only
let full_md = "# " + title + "\n\n";
full_md += "_Workflow `analyze-es-syntax` · scope=`" + scope + "` · docs=" + work_ids.len().to_string() + "_\n\n";
full_md += md;
full_md += "\n\n---\n\n## Work list\n\n";
for id in work_ids {
    let reason = if work_reasons[id] != () { work_reasons[id] } else { "" };
    full_md += "- `" + id + "` — " + reason + "\n";
}

let report_path = write_scratch_file("es-syntax-report.md", full_md);
log("report written: " + report_path);

complete(#{
    summary: title,
    scope: scope,
    documentsAnalyzed: work_ids,
    topDocs: top_docs,
    nextSteps: next_steps,
    ruleCandidates: rule_candidates,
    structureAgentsOk: structure_ok,
    syntaxCount: syntax_reports.len(),
    gapCount: gap_payloads.len(),
    report_path: report_path,
});
