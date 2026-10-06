"use client";

import { StockDocumentEditor } from "../_components/stock-document-editor";

/** Новый документ склада. После «Создать» страница уходит на адрес документа. */
export default function NewStockDocumentPage() {
  return <StockDocumentEditor document={null} />;
}
