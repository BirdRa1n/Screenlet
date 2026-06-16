import React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { Tooltip } from "./Tooltip";
import "./IconButton.css";

type Props = Omit<HTMLMotionProps<"button">, "ref" | "children"> & {
  variant?: "default" | "danger";
  label: string;
  tooltip?: boolean;
  children?: React.ReactNode;
};

export const IconButton: React.FC<Props> = ({
  variant = "default",
  label,
  tooltip = true,
  className,
  children,
  disabled,
  ...rest
}) => {
  const btn = (
    <motion.button
      aria-label={label}
      title={label}
      className={`ds-icon-button ds-icon-button--${variant} ${className ?? ""}`}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      transition={{ duration: 0.12, ease: "easeOut" as const }}
      disabled={disabled}
      {...rest}
    >
      {children}
    </motion.button>
  );

  if (!tooltip) return btn;
  return <Tooltip label={label}>{btn}</Tooltip>;
};
