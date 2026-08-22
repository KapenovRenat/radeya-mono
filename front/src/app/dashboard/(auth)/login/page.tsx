"use client";
import LogoRadeya from '@public/logo-radeya.svg';
import styles from "./style.module.scss";
import {cn} from "@/lib/utils";
import {Input} from "@/components/input";
import {Button} from "@/components/button";
import {useLoginForm} from "@/features/auth/use-login-form";

export default function LoginPage() {
    const { login, setLogin, password, setPassword, error, isLoading, handleSubmit } = useLoginForm();

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
                <Input placeholder={"Введите Логин"} label={"Login"} onChange={(e) => setLogin(e.target.value)} autoComplete="username" value={login}/>
                <Input placeholder={"Введите Пароль"} label={"Password"} type={"password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button type="submit" className={styles.ButtonSubmit} disabled={isLoading}>{isLoading ? 'Вход ...' : 'Войти'}</Button>
                {error && <div>{error}</div>}
            </div>
        </form>
    </div>
  );
}
