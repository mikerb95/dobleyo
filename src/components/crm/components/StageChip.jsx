import React from "react";
import styles from "../CRM.module.css";
import { STAGES } from "./constants.js";

export default function StageChip({ stage }) {
  const def = STAGES.find((s) => s.id === stage);
  if (!def) return null;
  return (
    <span className={[styles.stage, styles[`stage--${stage}`]].join(" ")}>
      {def.label}
    </span>
  );
}
