"use client";
import LogoRadeya from '@public/logo-radeya.svg';
import React from 'react';
import { cn } from "@/lib/utils";
import styles from "./style.module.scss";
import {Button} from "@/components/button";
import {useAuth, useLogout} from "@/features/auth/use-auth";
import Link from "next/link";
import {PERMISSIONS} from "@radeya/shared";
import {useCan} from "@/features/auth/use-can";
import {SETTINGS_PERMISSIONS} from "@/features/settings/settings-permissions";

export function DashboardNavMenu({ children, className }: { children?: React.ReactNode, className?: string }) {
    const { logout, isLoading } = useLogout();
    const { user } = useAuth();
    const can = useCan();

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
                    {can(PERMISSIONS.ORDERS_VIEW) ? <li>
                        <Link href="/dashboard/orders">
                            <div>

                            </div>
                            <p>Заказы</p>
                        </Link>
                    </li> : null}
                    {can(PERMISSIONS.CATALOG_VIEW) ? <li>
                        <Link href="/dashboard/products">
                            <div>

                            </div>
                            <p>Товары</p>
                        </Link>
                    </li> : null}
                    {can(PERMISSIONS.STOCK_DOCUMENTS_VIEW) ? <li>
                        <Link href="/dashboard/products/stock-documents">
                            <div>

                            </div>
                            <p>Документы склада</p>
                        </Link>
                    </li> : null}
                    {can([PERMISSIONS.USERS_MANAGE, PERMISSIONS.AUDIT_VIEW]) ? <li>
                        <Link href="/dashboard/accounts">
                            <div>

                            </div>
                            <p>Аккаунты и История</p>
                        </Link>
                    </li> : null}

                    {can(PERMISSIONS.IMPORTS) ? <li>
                        <Link href="/dashboard/imports">
                            <div>

                            </div>
                            <p>Импорты</p>
                        </Link>
                    </li> : null}

                    {can(PERMISSIONS.KASPI_SYNC) ? <li>
                        <Link href="/dashboard/kaspi-sync">
                            <div>

                            </div>
                            <p>Синхронизация товаров Kaspi</p>
                        </Link>
                    </li> : null}

                    {can(SETTINGS_PERMISSIONS) ? <li>
                        <Link href="/dashboard/settings">
                            <div>

                            </div>
                            <p>Настройки</p>
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