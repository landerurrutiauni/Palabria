import Link from "next/link";
import { SearchX } from "lucide-react";
import { StateScreen } from "@/components/ui/notice";

export default function NotFound() {
  return (
    <StateScreen
      icon={<SearchX className="size-9 text-ink-700" />}
      eyebrow="Error 404"
      title="¡Palabria! Esta página no existe"
      actions={
        <Link href="/" className="btn btn-primary">
          Ir al desafío de hoy
        </Link>
      }
    >
      Puede que el enlace esté incompleto o que la página se haya movido.
    </StateScreen>
  );
}
