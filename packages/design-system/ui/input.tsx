import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@design-system/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        `dark:bg-input/30 h-12 shadow border-3 px-2.5 py-1 text-base w-full min-w-0 outline-none
         focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] 
         aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 aria-invalid:ring-[3px]
         transition-[color,box-shadow] 
         file:h-7 file:text-sm file:font-medium  md:text-sm file:text-foreground  file:inline-flex file:border-0 file:bg-transparent
         placeholder:text-muted-foreground  
         disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50`,
        className
      )}
      {...props}
    />
  );
}

export { Input };
