import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import "../../styles/components/Tooltip.css";

type Side = "top" | "bottom" | "left" | "right";

type Props = {
  label: string;
  side?: Side;
  children: React.ReactNode;
};

export const Tooltip: React.FC<Props> = ({ label, side = "top", children }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className="ds-tooltip-root"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            className={`ds-tooltip__popup ds-tooltip__popup--${side}`}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.1, ease: "easeOut" as const }}
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
