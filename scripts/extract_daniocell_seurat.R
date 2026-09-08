#!/usr/bin/env Rscript
# Pull the embeddings + per-cell metadata out of Daniocell2023_SeuratV4.rds.
#
# We install SeuratObject (not full Seurat) purely so the S4 class definitions
# exist; without them readRDS still deserialises but slot access is fragile.
# Nothing here calls a Seurat method — we only read slots.
#
# Emits plain CSVs so the Python build step never needs R again:
#   umap_global.csv        cell, UMAP_1, UMAP_2
#   umap_<tissue>.csv      one per tissue subset in @misc$tissue.umaps
#   meta_extra.csv         the object's own metadata columns (superset check)
suppressMessages(library(SeuratObject))

args <- commandArgs(trailingOnly = TRUE)
rds  <- if (length(args) > 0) args[1] else "raw/Daniocell2023_SeuratV4.rds"
out  <- if (length(args) > 1) args[2] else "extracted"
dir.create(out, showWarnings = FALSE, recursive = TRUE)

cat(format(Sys.time()), "reading", rds, "\n"); flush.console()
obj <- readRDS(rds)
cat(format(Sys.time()), "loaded. class:", class(obj), "\n")
cat("  slots:", paste(slotNames(obj), collapse = ", "), "\n")

# --- global embedding -----------------------------------------------------
reds <- slot(obj, "reductions")
cat("  reductions:", paste(names(reds), collapse = ", "), "\n")
emb <- slot(reds[["umap"]], "cell.embeddings")
cat("  global umap:", nrow(emb), "cells x", ncol(emb), "dims\n")
df <- data.frame(cell = rownames(emb), emb, check.names = FALSE)
write.csv(df, file.path(out, "umap_global.csv"), row.names = FALSE, quote = FALSE)

# --- per-tissue embeddings ------------------------------------------------
misc <- slot(obj, "misc")
cat("  misc names:", paste(names(misc), collapse = ", "), "\n")
tu <- misc[["tissue.umaps"]]
if (!is.null(tu)) {
  cat("  tissue.umaps:", length(tu), "->", paste(names(tu), collapse = ", "), "\n")
  for (nm in names(tu)) {
    m <- as.matrix(tu[[nm]])
    d <- data.frame(cell = rownames(m), m, check.names = FALSE)
    write.csv(d, file.path(out, paste0("umap_", nm, ".csv")), row.names = FALSE, quote = FALSE)
    cat("    ", nm, nrow(m), "cells\n")
  }
}

# --- metadata the object carries (may hold columns the GEO TSV lacks) -----
md <- slot(obj, "meta.data")
cat("  meta.data:", nrow(md), "rows x", ncol(md), "cols\n")
cat("  columns:", paste(colnames(md), collapse = ", "), "\n")
md$cell <- rownames(md)
write.csv(md, file.path(out, "meta_extra.csv"), row.names = FALSE)
cat(format(Sys.time()), "done\n")
