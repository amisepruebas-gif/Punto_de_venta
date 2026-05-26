import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  pinCorrecto: string;
  onSuccess: () => void;
  onClose: () => void;
};

/** Modal mínimo: input de texto + botón "Continuar". Sin enmascarar. */
export function PinPromptModal({
  open,
  pinCorrecto,
  onSuccess,
  onClose,
}: Props) {
  const [valor, setValor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setValor("");
      setError(null);
    } else {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function intentar() {
    if (valor === pinCorrecto) {
      onSuccess();
      setValor("");
      setError(null);
    } else {
      setError("Incorrecto");
      setValor("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[20rem] max-w-full rounded-2xl bg-card p-5 shadow-2xl"
      >
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") intentar();
          }}
          className="block h-12 w-full rounded-md border border-input bg-background px-3 text-center text-lg outline-none focus:ring-2 focus:ring-primary/40"
        />

        {error && (
          <p className="mt-2 text-center text-xs font-medium text-destructive">
            {error}
          </p>
        )}

        <Button
          onClick={intentar}
          disabled={!valor}
          className="mt-3 w-full"
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}
