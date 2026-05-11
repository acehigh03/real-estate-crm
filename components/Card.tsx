import { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  className?: string;
  children: React.ReactNode;
  noLift?: boolean;
  style?: CSSProperties;
}

export function Card({ className, children, noLift = false, style }: CardProps) {
  return (
    <div
      className={cn("crm-bento-card", !noLift && "crm-bento-card-lift", className)}
      style={style}
    >
      {children}
    </div>
  );
}
