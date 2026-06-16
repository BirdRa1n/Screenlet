import React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import "./Card.css";

type Props = HTMLMotionProps<"div"> & {
  selected?: boolean;
};

export const Card: React.FC<Props> = ({
  selected,
  className,
  children,
  ...rest
}) => {
  return (
    <motion.div
      className={`ds-card ${selected ? "ds-card--selected" : ""} ${className ?? ""}`}
      layout
      {...rest}
    >
      {children}
    </motion.div>
  );
};
