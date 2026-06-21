"use client";

import * as React from "react";
import {
  Tabs as ShadTabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type Tab = { value: string; label: string };

type Props = {
  tabs: Tab[];
  defaultValue?: string;
  children: (active: string) => React.ReactNode;
};

export const Tabs: React.FC<Props> = ({ tabs, defaultValue, children }) => {
  const [active, setActive] = React.useState(
    defaultValue ?? tabs[0]?.value ?? "",
  );

  return (
    <div className="flex flex-col gap-4">
      <ShadTabs value={active} onValueChange={setActive}>
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </ShadTabs>

      <div>{children(active)}</div>
    </div>
  );
};
