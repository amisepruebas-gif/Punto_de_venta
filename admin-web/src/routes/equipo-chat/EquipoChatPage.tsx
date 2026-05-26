import { useState } from "react";
import { Mail, KeyRound } from "lucide-react";
import { useNegocio } from "@/hooks/useNegocio";
import { DelegadosTab } from "./DelegadosTab";
import { ColaboradoresTab } from "./ColaboradoresTab";

type Tab = "delegados" | "colaboradores";

const TABS: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "delegados", label: "Admins delegados", icon: Mail },
  { id: "colaboradores", label: "Colaboradores", icon: KeyRound },
];

export function EquipoChatPage() {
  const { negocioId } = useNegocio();
  const [tab, setTab] = useState<Tab>("delegados");

  if (!negocioId) {
    return (
      <p className="container max-w-4xl py-12 text-center text-sm text-muted-foreground">
        Cargando…
      </p>
    );
  }

  return (
    <div className="container max-w-4xl space-y-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Equipo de chat</h1>
        <p className="text-sm text-muted-foreground">
          Quién puede entrar al chat. Los <strong>delegados</strong> son
          administradores adicionales (login con Google). Los{" "}
          <strong>colaboradores</strong> son usuarios solo-chat con
          username + password.
        </p>
      </div>

      <nav className="flex gap-1 border-b">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={
              tab === id
                ? "flex items-center gap-2 border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary"
                : "flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      {tab === "delegados" && <DelegadosTab negocioId={negocioId} />}
      {tab === "colaboradores" && <ColaboradoresTab negocioId={negocioId} />}
    </div>
  );
}
