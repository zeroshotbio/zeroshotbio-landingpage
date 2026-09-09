suppressMessages({library(SingleCellExperiment); library(S4Vectors)})

## monocle3's cell_data_set, defined as a stub so readRDS can restore the object
## without the package. The slot list is monocle3's own; we only ever read
## colData, which lives on the SingleCellExperiment parent.
setClass("cell_data_set", contains = "SingleCellExperiment",
         slots = c(reduce_dim_aux = "SimpleList",
                   principal_graph_aux = "SimpleList",
                   principal_graph = "SimpleList",
                   clusters = "SimpleList"))

## The counts assay is a BPCells IterableMatrix living on disk. We never touch
## it, but readRDS still needs somewhere to put the S4 object, so give it a
## permissive stub. If BPCells is ever installed this stub must be removed.
setClass("IterableMatrix", representation("VIRTUAL"))
for (cl in c("MatrixDir","TransformLog1p","TransformScaleShift","RenameDims",
             "ConvertMatrixType","MatrixSubset")) {
  if (!isVirtualClass(cl) && !methods::existsMethod("show", cl))
    try(setClass(cl, contains = "IterableMatrix",
                 representation(dim = "ANY", dimnames = "ANY", threads = "ANY")), silent = TRUE)
}

cat("reading...\n"); flush.console()
t0 <- Sys.time()
cds <- readRDS("/data/scratch/platt_open/cds_object.rds")
cat("read in", round(as.numeric(difftime(Sys.time(), t0, units="secs"))), "s\n")
cat("class:", paste(class(cds), collapse=","), "\n")

## NOTE: do NOT call dim(), colData() or any other S4 generic on this object.
## Method dispatch walks the class hierarchy, finds a monocle3-defined class and
## tries to load the package, which is the whole thing we are avoiding. Direct
## slot access does not dispatch, so everything below reads @colData by hand.
cdl <- cds@colData
cat("colData class:", paste(class(cdl), collapse=","), "\n")
nms <- cdl@listData
cat("columns (", length(nms), "):\n", sep=""); print(names(nms))
n <- length(nms[[1]])
cat("rows:", n, "\n")

flat <- lapply(nms, function(v) {
  if (is.factor(v)) as.character(v)
  else if (is.numeric(v) || is.logical(v) || is.character(v)) v
  else as.character(v)
})
df <- as.data.frame(flat, stringsAsFactors = FALSE, optional = TRUE)
names(df) <- names(nms)
df$.cell_id <- as.character(cdl@rownames)

out <- "/data/scratch/platt_open/platt_coldata.tsv"
if (requireNamespace("data.table", quietly = TRUE)) data.table::fwrite(df, out, sep = "\t", quote = FALSE)
else write.table(df, out, sep = "\t", quote = FALSE, row.names = FALSE)
cat("wrote", out, "-", nrow(df), "x", ncol(df), "\n")
