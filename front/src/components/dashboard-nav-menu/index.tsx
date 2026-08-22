"use client";
import LogoRadeya from '@public/logo-radeya.svg';
import React from 'react';
import { cn } from "@/lib/utils";
import styles from "./style.module.scss";
import {Button} from "@/components/button";
import {useLogout} from "@/features/auth/use-auth";
import Link from "next/link";

export function DashboardNavMenu({ children, className }: { children?: React.ReactNode, className?: string }) {
    const { logout, isLoading } = useLogout();

    return (
        <div className={cn(styles.DashboardNavMenu, `${className}`)}>
            <div className={cn(styles.DashboardNavMenuLogo)}>
                <LogoRadeya />
            </div>

            <div className={cn(styles.DashboardMenu)}>
                <ul>
                    <li>
                        <Link href="/dashboard">
                            <div>

                            </div>
                            <p>Статистика</p>
                        </Link>
                    </li>
                    <li>
                        <Link href="/dashboard">
                            <div>

                            </div>
                            <p>Заказы</p>
                        </Link>
                    </li>
                    <li>
                        <Link href="/dashboard">
                            <div>

                            </div>
                            <p>Товары</p>
                        </Link>
                    </li>
                    <li>
                        <Link href="/dashboard/accounts">
                            <div>

                            </div>
                            <p>Аккаунты и История</p>
                        </Link>
                    </li>
                </ul>
            </div>

            <div className={cn(styles.account)}>
                <div className={styles.accountDesc}>
                    <p>Admin</p>
                    <span>Должность: CEO</span>
                </div>
                <Button onClick={logout} disabled={isLoading} className={styles.accountButton}>Выйти</Button>
            </div>
        </div>
    )
}