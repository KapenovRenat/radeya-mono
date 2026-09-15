import { z } from 'zod';

/**
 * Импорт складов из выгрузки Kaspi.
 *
 * Список приходит с клиента уже разобранным, поэтому проверяем формат каждого
 * поля: эндпоинт доступен только админу, но «свой пользователь» — не замена
 * валидации. Кривой код склада попадёт в справочник навсегда, а на него потом
 * сошлются товары и заказы.
 */

/** Наш короткий код склада: `PP3`. */
const WAREHOUSE_CODE_PATTERN = /^PP\d{1,4}$/;

/** Идентификатор в Kaspi: `6871008_PP3` — номер продавца и код точки. */
const KASPI_STORE_ID_PATTERN = /^\d{1,20}_PP\d{1,4}$/;

/** Код города по КАТО — только цифры. */
const KATO_PATTERN = /^\d{1,12}$/;

/**
 * Верхняя граница на случай испорченного или чужого файла: складов у продавца
 * десятки, не тысячи. Без неё один запрос может заливать справочник сколь угодно долго.
 */
const MAX_WAREHOUSES = 500;

export const saveWarehousesSchema = z.object({
  warehouses: z
    .array(
      z.object({
        code: z
          .string()
          .trim()
          .regex(WAREHOUSE_CODE_PATTERN, 'Код склада ожидается в виде PP3'),
        storeId: z
          .string()
          .trim()
          .regex(KASPI_STORE_ID_PATTERN, 'storeId ожидается в виде 6871008_PP3'),
        // null допустим: у части складов в выгрузке города нет.
        cityId: z
          .string()
          .trim()
          .regex(KATO_PATTERN, 'Код города ожидается числом (КАТО)')
          .nullable(),
      }),
    )
    .min(1, 'Список складов пуст')
    .max(MAX_WAREHOUSES, `Не больше ${MAX_WAREHOUSES} складов за раз`),
});

export type SaveWarehousesInput = z.infer<typeof saveWarehousesSchema>;
