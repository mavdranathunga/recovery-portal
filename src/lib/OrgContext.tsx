"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type OrgId = "sathosa" | "idl";

interface OrgContextType {
  org: OrgId;
  setOrg: (org: OrgId) => void;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [org, setOrgState] = useState<OrgId>("sathosa");

  // Load from localStorage on mount
  useEffect(() => {
    const savedOrg = localStorage.getItem("selected_org");
    if (savedOrg === "idl" || savedOrg === "sathosa") {
      setOrgState(savedOrg);
    }
  }, []);

  const setOrg = (newOrg: OrgId) => {
    setOrgState(newOrg);
    localStorage.setItem("selected_org", newOrg);
  };

  return (
    <OrgContext.Provider value={{ org, setOrg }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const context = useContext(OrgContext);
  if (context === undefined) {
    throw new Error("useOrg must be used within an OrgProvider");
  }
  return context;
}
