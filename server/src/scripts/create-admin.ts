import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Writable } from 'node:stream';

import {
  LOGIN_PATTERN,
  LOGIN_MAX_LENGTH,
  LOGIN_MIN_LENGTH,
  LOGIN_RULES_HINT,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  PASSWORD_RULES_HINT,
  USER_ROLES,
  normalizeLogin,
} from '@radeya/shared';

import { prisma, disconnectDatabase } from '../db/client';
import { hashPassword } from '../modules/auth/auth.service';

/**
 * Создание администратора из терминала.
 *
 * Публичного эндпоинта регистрации в системе нет вовсе — это осознанное решение:
 * форма, доступная снаружи хотя бы на минуту, рано или поздно окажется открытой
 * в проде. Первый админ заводится здесь, остальных он создаёт уже из дашборда.
 *
 * Запуск: npm run create:admin --workspace=server
 */

let muted = false;

async function main() {
  // Свой поток вывода: пока muted, символы пароля не печатаются в терминал.
  // Внутренности readline не трогаем — они меняются от версии к версии Node.
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) stdout.write(chunk, encoding);
      callback();
    },
  });

  const rl = createInterface({ input: stdin, output, terminal: true });

  const askHidden = async (query: string) => {
    // Приглашение печатаем мимо обёртки, иначе оно тоже проглотится.
    stdout.write(query);
    muted = true;
    const answer = await rl.question('');
    muted = false;
    stdout.write('\n');
    return answer;
  };

  try {
    const existing = await prisma.user.count();

    if (existing > 0) {
      stdout.write(
        `\nВ базе уже есть учётные записи (${existing}). ` +
          'Скрипт создаст ещё одного администратора.\n' +
          'Обычный порядок — заводить сотрудников из дашборда.\n\n',
      );
    }

    const login = normalizeLogin(await rl.question('Логин: '));

    if (
      login.length < LOGIN_MIN_LENGTH ||
      login.length > LOGIN_MAX_LENGTH ||
      !LOGIN_PATTERN.test(login)
    ) {
      throw new Error(`Логин не подходит. ${LOGIN_RULES_HINT}`);
    }

    const taken = await prisma.user.findUnique({ where: { login } });

    if (taken) {
      throw new Error(`Логин «${login}» уже занят.`);
    }

    const name = (await rl.question('Имя: ')).trim();

    if (!name) {
      throw new Error('Имя обязательно.');
    }

    const position = (await rl.question('Должность: ')).trim();

    if (!position) {
      throw new Error('Должность обязательна.');
    }

    const password = await askHidden('Пароль: ');

    if (
      password.length < PASSWORD_MIN_LENGTH ||
      !PASSWORD_PATTERN.test(password)
    ) {
      throw new Error(`Пароль не подходит. ${PASSWORD_RULES_HINT}`);
    }

    const repeat = await askHidden('Пароль ещё раз: ');

    if (password !== repeat) {
      throw new Error('Пароли не совпадают.');
    }

    const user = await prisma.user.create({
      data: {
        login,
        name,
        position,
        role: USER_ROLES.ADMIN,
        passwordHash: await hashPassword(password),
      },
    });

    stdout.write(`\nАдминистратор «${user.login}» создан.\n`);
  } finally {
    muted = false;
    rl.close();
    await disconnectDatabase();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  stdout.write(`\nОшибка: ${message}\n`);
  process.exitCode = 1;
});
