import { useState } from "react";
import { useReducedMotion } from "motion/react";
import { Brand } from "./Brand";
/** Assinatura de abertura, sem cronômetro de carregamento nem bloqueio de entrada. */
export function BrandEntrance() {
  const [done, setDone] = useState(false);
  const reduced = useReducedMotion();
  if (done || reduced) return null;
  return (
    <div
      className="nex-entrance"
      aria-hidden="true"
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) setDone(true);
      }}
    >
      <Brand large />
      <span className="nex-entrance-line" />
      <p>Seu próximo momento.</p>
    </div>
  );
}
