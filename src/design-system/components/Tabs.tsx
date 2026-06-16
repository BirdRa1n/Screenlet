import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import "../../styles/components/Tabs.css";

type Tab = { value: string; label: string };

type Props = {
  tabs: Tab[];
  defaultValue?: string;
  children: (active: string) => React.ReactNode;
};

export const Tabs: React.FC<Props> = ({ tabs, defaultValue, children }) => {
  const [active, setActive] = useState(defaultValue ?? tabs[0]?.value ?? "");

  return (
    <div className="ds-tabs">
      <div className="ds-tabs__bar">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            className={`ds-tabs__tab${active === tab.value ? " ds-tabs__tab--active" : ""}`}
            onClick={() => setActive(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={active}
          className="ds-tabs__content"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.14, ease: "easeOut" as const }}
        >
          {children(active)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
