"use client";

import { useMemo, useState } from "react";
import { LISTING_STATUSES, type CabinetOffer } from "@radeya/shared";

/**
 * Отбор товаров в таблице кабинета: статус, проблемы, поиск.
 *
 * Статус — всегда одно из двух: либо в продаже, либо снятые. Смешанного
 * списка нет намеренно: проверять данные проще, когда на экране однородный
 * набор, а не всё вперемешку.
 */
export function useCabinetFilters(offers: CabinetOffer[]) {
  const [query, setQuery] = useState("");
  const [showOffSale, setShowOffSale] = useState(false);
  const [onlyProblems, setOnlyProblems] = useState(false);

  const filtered = useMemo(() => {
    const status = showOffSale
      ? LISTING_STATUSES.OFF_SALE
      : LISTING_STATUSES.ON_SALE;

    const needle = query.trim().toLowerCase();

    return offers.filter((offer) => {
      if (offer.status !== status) return false;

      if (onlyProblems && offer.problems.length === 0) return false;

      return needle === "" || matches(offer, needle);
    });
  }, [offers, showOffSale, onlyProblems, query]);

  return {
    query,
    setQuery,
    showOffSale,
    setShowOffSale,
    onlyProblems,
    setOnlyProblems,
    filtered,
  };
}

/**
 * Ищем по артикулу и обоим названиям: витринное и наше различаются,
 * и работник может помнить любое из них.
 */
function matches(offer: CabinetOffer, needle: string): boolean {
  return (
    offer.sku.toLowerCase().includes(needle) ||
    offer.title.toLowerCase().includes(needle) ||
    (offer.masterTitle?.toLowerCase().includes(needle) ?? false)
  );
}
