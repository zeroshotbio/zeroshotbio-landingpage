// /POC_workflow — Mode-1 POC wizard. Step 1 ("Submit compound") is the working vertical slice;
// steps 2–6 are stubs. Server component (metadata) wrapping the client wizard.
import PocClient from "./PocClient";

export const metadata = {
  title: "POC workflow — zeroshot bio",
  description:
    "Proof-of-concept compound-insight wizard. Public cell-line reference (Tahoe-100M) standing in for the zebrafish atlas.",
};

export default function PocWorkflowPage() {
  return <PocClient />;
}
