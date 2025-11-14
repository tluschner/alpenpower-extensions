# Alpenpower EU B2B Pricing Extension

Diese App stellt eine Shopify Function bereit, die Umsatzsteuer aus Bruttopreisen für steuerbefreite B2B-Kunden innerhalb der EU entfernt. Sie wurde speziell für Shopify Plus Händler mit EU-OSS-Setup entwickelt und nutzt die neuen Checkout Pricing APIs von Shopify.

## Projektstruktur

```
.
├── package.json
├── shopify.app.toml
├── tsconfig.json
└── extensions
    └── b2b-eu-tax-pricing
        ├── locales
        │   └── en.default.json
        ├── shopify.extension.toml
        └── src
            ├── index.ts
            └── input.graphql
```

## Funktionsweise

1. **Kundenqualifikation**
   - Prüft, ob es sich um einen B2B-Kunden handelt (`customer.b2b`).
   - Liest die Company-Location-Metafelder `alpenpwr.taxexempt` und `alpenpwr.vatnumber`.
   - Stellt sicher, dass eine gültige UID hinterlegt ist und der Standort nicht in Österreich liegt.
2. **Steuersatzbestimmung**
   - Liest das Shop-Metafeld `tax.vat_rates` und parst die JSON-Konfiguration.
   - Wählt den Standardsteuersatz des Ziellandes aus.
3. **Preisberechnung**
   - Netto = Brutto / (1 + Steuersatz).
   - Setzt den Nettobetrag als festen Preis pro Produkt über eine Checkout-Pricing-Operation.
4. **Shopify-konforme Rundung**
   - Verwendet `toFixed(2)` für kaufmännische Rundung auf zwei Nachkommastellen.

## Installation

1. **Abhängigkeiten installieren**
   ```bash
   npm install
   ```
2. **Shopify CLI vorbereiten**
   - Melde dich mit der Shopify CLI in deinem Shopify Plus Account an:
     ```bash
     shopify login --store your-dev-store.myshopify.com
     ```
3. **Entwicklung starten**
   ```bash
   shopify app dev
   ```
   Dadurch wird die Funktion kompiliert und ein lokaler Tunnel für die App-Oberfläche bereitgestellt.
4. **Deployment**
   ```bash
   shopify app deploy
   ```

## Konfiguration im Shop

1. **Shop-Metafeld** `tax.vat_rates`
   - Namespace: `tax`
   - Key: `vat_rates`
   - Typ: JSON
   - Beispielwert:
     ```json
     {"standard-rate":{"AT":20,"DE":19,"FR":20,"IT":22,"ES":21,"NL":21,"BE":21,"LU":17,"IE":23,"PT":23,"PL":23,"CZ":21,"SK":20,"SI":22,"HU":27},"reduced-rate":{"AT":10,"DE":7,"FR":10,"IT":10,"ES":10,"NL":9,"BE":6,"LU":3,"IE":13.5,"PT":13,"PL":8,"CZ":15,"SK":10,"SI":9.5,"HU":18}}
     ```
2. **Company-Location-Metafelder**
   - Namespace: `alpenpwr`
   - Key: `taxexempt` (Boolean)
   - Key: `vatnumber` (Einzeiliger Text)

## Theme-Anpassungen

Für Produkt- und Kategorieansichten empfiehlt sich eine Anzeige des Nettopreises für steuerbefreite Kunden. Beispielhafter Liquid-Snippet-Aufruf:

```liquid
{% assign company_location = customer.current_company_location %}
{% if customer.b2b? and company_location and company_location.metafields.alpenpwr.taxexempt.value == true %}
  {% assign vat_rates = shop.metafields.tax.vat_rates | parse_json %}
  {% assign country_code = company_location.country %}
  {% assign vat_rate = vat_rates['standard-rate'][country_code] %}
  {% if vat_rate and vat_rate > 0 %}
    {% assign vat_multiplier = 100 | plus: vat_rate | divided_by: 100 %}
    {% assign gross_price = product.price %}
    {% assign net_price = gross_price | divided_by: vat_multiplier %}
    <p class="price price--net">{{ net_price | money_with_currency }}</p>
  {% endif %}
{% endif %}
```

Passe die Liquid-Logik je nach Theme und gewünschter Darstellung an.

## Tests

- Unit Tests können über die Shopify Function Testumgebung ausgeführt werden:
  ```bash
  npm run function:test
  ```

## Deployment-Checkliste

1. Alle relevanten Metafelder in Shop und Company Locations pflegen.
2. Steuerbefreite Kunden in die entsprechende B2B-Kundengruppe aufnehmen.
3. Funktion über den Shopify Admin aktivieren und dem Checkout zuweisen.
4. Testbestellungen mit verschiedenen EU-Ländern durchführen.
