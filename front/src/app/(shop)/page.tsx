import { PriceTag } from "@/components/price-tag";

export default function ShopHomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Магазин</h1>
      <p className="text-muted-foreground">
        Витрина появится на последнем этапе — сначала админка.
      </p>

      {/* Проверка, что SCSS-модули и токены темы работают. */}
      <PriceTag price={24990} oldPrice={31990} />
    </div>
  );
}
