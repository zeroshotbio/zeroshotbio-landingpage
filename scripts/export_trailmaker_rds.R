#!/usr/bin/env Rscript
# Export one of Patrick's Trailmaker Seurat objects for /trailmaker_UI, reading the .rds and nothing
# else: no Gold, no barcode matching. Usage:
#   Rscript scripts/export_trailmaker_rds.R <patrick.rds> <outdir>
# Writes to <outdir>:
#   units.csv          one row per replicate unit (the object's `samples` value): unit, n cells, treatment
#   sets.txt           Patrick's custom cell-set names (custom_cellset-<Name>, trimmed), in column order
#   genes.txt          the object's feature names, in row order
#   features.csv       the RNA assay's feature metadata, if the object carries any
#   member_counts.csv  unit, set, cells of that set in that unit (a cell in several sets counts in each)
#   expr_counts.int32  genes x (unit*sets + set), column-major int32: of the cells of that set in that
#                      unit, how many have >= 1 count of the gene
suppressPackageStartupMessages({library(SeuratObject); library(Matrix); library(data.table)})
a <- commandArgs(TRUE)
f <- a[1]; out <- a[2]
dir.create(out, showWarnings = FALSE, recursive = TRUE)
t0 <- Sys.time()
obj <- readRDS(f)
md <- obj[[]]
cat("read", f, "in", round(difftime(Sys.time(), t0, units = "secs")), "s:", nrow(md), "cells\n")
cnt <- tryCatch(LayerData(obj, assay = "RNA", layer = "counts"),
                error = function(e) GetAssayData(obj, assay = "RNA", slot = "counts"))
stopifnot(identical(colnames(cnt), rownames(md)))
cnt <- as(cnt, "CsparseMatrix")
genes <- rownames(cnt)
writeLines(genes, file.path(out, "genes.txt"))
mf <- tryCatch(obj[["RNA"]][[]], error = function(e) NULL)
if (!is.null(mf) && ncol(mf) > 0) fwrite(cbind(feature = rownames(mf), mf), file.path(out, "features.csv"))

cs <- grep("^custom_cellset-", colnames(md), value = TRUE)
S <- sapply(cs, function(c) md[[c]] %in% c(TRUE, 1, "TRUE", "1"))
sets <- trimws(sub("^custom_cellset-", "", cs))
writeLines(sets, file.path(out, "sets.txt"))
unit <- as.character(md$samples)
units <- sort(unique(unit))
u <- match(unit, units)
treat <- if ("Treatment" %in% colnames(md)) as.character(md$Treatment) else rep(NA_character_, nrow(md))
ut <- tapply(treat, u, function(x) x[1])
fwrite(data.table(unit = units, n = as.integer(tabulate(u, length(units))), treatment = as.character(ut[as.character(seq_along(units))])),
       file.path(out, "units.csv"))

ns <- length(sets)
idx <- which(S, arr.ind = TRUE)
M <- sparseMatrix(i = idx[, 1], j = (u[idx[, 1]] - 1) * ns + idx[, 2], x = 1, dims = c(nrow(md), length(units) * ns))
mc <- colSums(M)
fwrite(data.table(unit = rep(units, each = ns), set = rep(sets, length(units)), n = as.integer(mc)),
       file.path(out, "member_counts.csv"))
B <- cnt
B@x[] <- 1
t1 <- Sys.time()
A <- as.matrix(B %*% M)
cat("expressed counts:", nrow(A), "genes x", ncol(A), "unit-set codes in", round(difftime(Sys.time(), t1, units = "secs")), "s\n")
stopifnot(max(A) < .Machine$integer.max)
writeBin(as.integer(round(A)), file.path(out, "expr_counts.int32"), size = 4)
cat("units", length(units), "| sets", ns, "| genes", length(genes), "| e.g. genes", paste(head(genes, 3), collapse = " "), "\n")
cat("DONE export\n")
