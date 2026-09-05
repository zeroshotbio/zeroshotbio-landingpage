"use client";
import dynamic from "next/dynamic";
const Space = dynamic(() => import("./Space"), { ssr: false, loading: () => <div style={{ position: "fixed", inset: 0, background: "#0b0e14" }} /> });
export default function SpaceLoader() { return <Space />; }
