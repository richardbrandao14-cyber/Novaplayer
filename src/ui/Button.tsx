import type { ButtonHTMLAttributes } from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";
// Padrão composicional shadcn/ui, adaptado aos tokens NOVA UI (MIT).
const buttonVariants = cva("nova-button", {
  variants: {
    variant: {
      default: "button-primary",
      secondary: "button-secondary",
      ghost: "button-ghost",
    },
  },
  defaultVariants: { variant: "default" },
});
type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };
export function Button({
  className,
  variant,
  asChild = false,
  ...props
}: Props) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp className={cn(buttonVariants({ variant }), className)} {...props} />
  );
}
