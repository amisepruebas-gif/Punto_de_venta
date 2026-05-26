import { MessageSquare } from "lucide-react";

type Props = {
  onClick: () => void;
  /** Cuenta de no-leídos (opcional). Sólo aparece badge si > 0. */
  noLeidos?: number;
};

export function FloatingChatButton({ onClick, noLeidos }: Props) {
  const count = noLeidos ?? 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Abrir chat"
      className="pointer-events-auto fixed bottom-[8rem] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/20 transition-transform hover:scale-105 active:scale-95"
    >
      <MessageSquare className="h-6 w-6" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
