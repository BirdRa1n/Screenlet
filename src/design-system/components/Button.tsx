import React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import "./Button.css";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

type Props = Omit<HTMLMotionProps<"button">, "ref" | "children"> & {
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
  children?: React.ReactNode;
};

export const Button: React.FC<Props> = ({
  variant = "secondary",
  size = "md",
  icon,
  className,
  children,
  disabled,
  ...rest
}) => {
  return (
    <motion.button
      className={`ds-button ds-button--${variant} ds-button--${size} ${className ?? ""}`}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      disabled={disabled}
      {...rest}
    >
      {icon ? <span className="ds-button__icon">{icon}</span> : null}
      {children}
    </motion.button>
  );
};
