import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[1px]",
  {
    variants: {
      variant: {
        default:
          "bg-background-accent text-text-inverse hover:bg-background-accent/90",
        destructive:
          "bg-background-danger text-white hover:bg-background-danger/90",
        outline:
          "border border-border-input bg-background-default hover:bg-background-muted",
        secondary:
          "bg-background-muted text-text-default hover:bg-background-muted/80",
        ghost: "hover:bg-background-muted dark:hover:bg-background-muted/50",
        link: "text-text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9",
        sm: "h-8 gap-1.5",
        lg: "h-10",
      },
      style: {
        default: "",
        icon: "",
      },
    },
    compoundVariants: [
      {
        style: "default",
        size: "default",
        className: "px-6 py-2 has-[>svg]:px-4",
      },
      {
        style: "default",
        size: "sm",
        className: "px-4 has-[>svg]:px-3",
      },
      {
        style: "default",
        size: "lg",
        className: "px-8 has-[>svg]:px-6",
      },
      {
        style: "icon",
        size: "default",
        className: "w-9 h-9 p-0",
      },
      {
        style: "icon",
        size: "sm",
        className: "w-8 h-8 p-0",
      },
      {
        style: "icon",
        size: "lg",
        className: "w-10 h-10 p-0",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
      style: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  style = "default",
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    style?: "default" | "icon";
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, style, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
