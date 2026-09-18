"use client";
import LogoRadeya from '@public/logo-radeya.svg';
import React from 'react';
import { cn } from "@/lib/utils";
import styles from "./style.module.scss";
import {Button} from "@/components/button";
import {useAuth, useLogout} from "@/features/auth/use-auth";
import Link from "next/link";
import {USER_ROLES} from "@radeya/shared";

export function DashboardNavMenu({ children, className }: { children?: React.ReactNode, className?: string }) {
    const { logout, isLoading } = useLogout();
    const { user } = useAuth();

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
                        <Link href="/dashboard/products">
                            <div>

                            </div>
                            <p>Товары</p>
                        </Link>
                    </li>
                    {user?.role === USER_ROLES.ADMIN ? <li>
                        <Link href="/dashboard/accounts">
                            <div>

                            </div>
                            <p>Аккаунты и История</p>
                        </Link>
                    </li> : null}

                    {user?.role === USER_ROLES.ADMIN ? <li>
                        <Link href="/dashboard/kaspi-sync">
                            <div>

                            </div>
                            <p>Синхронизация товаров Kaspi</p>
                        </Link>
                    </li> : null}
                </ul>
            </div>

            <div className={cn(styles.account)}>
                <div className={styles.accountDesc}>
                    <p>{user?.login}</p>
                    <span>Должность: {user?.position}</span>
                </div>
                <Button onClick={logout} disabled={isLoading} className={styles.accountButton}>Выйти</Button>
            </div>
        </div>
    )
}