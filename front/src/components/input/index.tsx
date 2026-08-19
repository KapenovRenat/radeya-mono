import React, {ComponentProps} from 'react';

import { cn } from "@/lib/utils";
import styles from "./style.module.scss";

interface InputProps extends ComponentProps<"input"> {
    error?: string | null;
    label?: string | null;
}

export function Input({
    error,
    label,
    className,
    id,
    ...props
}: InputProps) {

    return (
        <div className={cn(styles.input, `${className}`)}>
            {label ? <label className={styles.inputLabel} htmlFor={id}>{label}</label> : null}
            <input id={id} {...props} className={styles.inputValue}/>
            {error ? <div className={styles.desc}>
                {error}
            </div> : null}
        </div>
    )
}
