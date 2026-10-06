"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { parseStockDocumentNumber } from "@radeya/shared";

import { Loader } from "@/components/loader";
import { useGetStockDocumentQuery } from "@/features/stock-documents/stock-documents-api";
import { apiErrorMessage } from "@/shared/api/error-message";
import { STOCK_DOCUMENTS_HREF } from "../_components/document-meta";
import { StockDocumentEditor } from "../_components/stock-document-editor";

/** Документ по номеру из адреса: `/dashboard/products/stock-documents/00128`. */
export default function StockDocumentPage() {
  const params = useParams<{ number: string }>();
  const number = parseStockDocumentNumber(params.number ?? "");
  const document = useGetStockDocumentQuery(number ?? 0, { skip: number === null });

  if (number === null) {
    return <NotFound message="В адресе не номер документа" />;
  }

  if (document.isLoading) return <Loader />;

  if (document.isError || !document.data) {
    return <NotFound message={apiErrorMessage(document.error, "Не удалось загрузить документ")} />;
  }

  // key: после записи сервер присылает документ заново — черновик собирается
  // из него с нуля, а не сливается со старыми полями формы.
  return <StockDocumentEditor key={document.data.id + document.data.updatedAt} document={document.data} />;
}

function NotFound({ message }: { message: string }) {
  return (
    <div className="space-y-3">
      <p role="alert">{message}</p>
      <Link href={STOCK_DOCUMENTS_HREF} className="underline">К списку документов</Link>
    </div>
  );
}
