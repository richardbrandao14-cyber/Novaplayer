import type { ReactNode } from "react";
import { Tooltip } from "radix-ui";
export function Tip({
  label,
  children,
  enabled = true,
}: {
  label: string;
  children: ReactNode;
  enabled?: boolean;
}) {
  if (!enabled) return children;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={10}
          className="tooltip-content"
        >
          {label}
          <Tooltip.Arrow />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
