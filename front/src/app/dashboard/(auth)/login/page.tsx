"use client";
import LogoRadeya from '@public/logo-radeya.svg';
import styles from "./style.module.scss";
import {cn} from "@/lib/utils";
import {Input} from "@/components/input";
import {Button} from "@/components/button";

export default function LoginPage() {

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        alert("Pressed")
    }

    return (
    <div className={cn("space-y-2", styles.dashboardLogin)}>
        <div className={styles.LoginFormHead}>
            <div className={styles.LoginFormHeadImg}>
                <LogoRadeya />
            </div>
            <span>Админка</span>
        </div>
        <form onSubmit={handleSubmit}  className={cn(styles.LoginForm)}>
            <div className={cn(styles.LoginGroup)}>
                <Input placeholder={"Введите Логин"} label={"Login"} autoComplete="username"/>
                <Input placeholder={"Введите Пароль"} label={"Password"} type={"password"} autoComplete="current-password" />
                <Button type="submit" className={styles.ButtonSubmit}>Войти</Button>
            </div>
        </form>
    </div>
  );
}
