import React from "react";
import { motion } from "framer-motion";
import "../../styles/components/ProgressBar.css";

export const ProgressBar: React.FC<{
  progress: number;
  label?: string;
}> = ({ progress, label }) => {
  return (
    <div className="ds-progress">
      {label ? <span className="ds-progress__label">{label}</span> : null}
      <div className="ds-progress__track">
        <motion.div
          className="ds-progress__fill"
          animate={{ width: `${Math.round(progress * 100)}%` }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        />
      </div>
      <span className="ds-progress__value">
        {Math.round(progress * 100)}%
      </span>
    </div>
  );
};
