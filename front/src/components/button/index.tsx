import React, {ComponentProps} from 'react';

import { cn } from "@/lib/utils";
import styles from "./style.module.scss";

interface ButtonProps extends ComponentProps<"button"> {
    error?: string | null;
    label?: string | null;
}

export function Button({
                          className,
                           error,
                           type = "button",
                          ...props
                      }: ButtonProps) {
    const {children} = props;

    return (
        <div className={cn(styles.Button, `${className}`)}>
            <button type={type} {...props} className={styles.ButtonComponent}>
                {children ? children : 'Button'}
            </button>
            {error ? <div className={styles.desc}>
                {error}
            </div> : null}
        </div>
    )
}
