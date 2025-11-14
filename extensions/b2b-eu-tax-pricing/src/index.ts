import { run, InputQuery } from "@shopify/shopify_function";

type CheckoutPricingOperation = {
  updateLinePrice: {
    lineId: string;
    price: {
      adjustment: {
        fixedPricePerQuantity: {
          amount: string;
          currencyCode: string;
        };
      };
    };
  };
};

type FunctionResult = {
  operations: CheckoutPricingOperation[];
};

type VatRateConfig = {
  [rateType: string]: Record<string, number>;
};

type BuyerIdentity = NonNullable<InputQuery["cart"]>["buyerIdentity"];

type CartLine = NonNullable<InputQuery["cart"]>["lines"][number];

const AUSTRIA_ISO = "AT";

function parseVatRates(value?: string | null): VatRateConfig | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as VatRateConfig;
    return parsed;
  } catch (_error) {
    return null;
  }
}

function isTaxExemptBuyer(buyer?: BuyerIdentity | null): buyer is BuyerIdentity {
  if (!buyer) {
    return false;
  }

  const customer = buyer.customer;
  const companyLocation = buyer.companyLocation;

  if (!customer || !customer.b2b || !companyLocation) {
    return false;
  }

  const taxExemptFlag = normalizeBoolean(companyLocation.taxExempt?.value);
  const vatNumber = (companyLocation.vatNumber?.value || "").trim();

  if (!taxExemptFlag || vatNumber.length === 0) {
    return false;
  }

  if (!companyLocation.countryCode || companyLocation.countryCode === AUSTRIA_ISO) {
    return false;
  }

  return true;
}

function normalizeBoolean(value?: string | null): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

function getVatRate(config: VatRateConfig | null, countryCode: string): number | null {
  if (!config) {
    return null;
  }

  const standardRates = config["standard-rate"] || {};
  const rate = standardRates[countryCode];
  return typeof rate === "number" ? rate : null;
}

function calculateNetAmount(gross: string, vatRate: number): string {
  const grossAmount = Number(gross);
  if (Number.isNaN(grossAmount)) {
    return gross;
  }

  const net = grossAmount / (1 + vatRate / 100);
  return net.toFixed(2);
}

function buildOperations(lines: CartLine[], netAmountByLineId: Map<string, string>): CheckoutPricingOperation[] {
  const operations: CheckoutPricingOperation[] = [];

  for (const line of lines) {
    const targetAmount = netAmountByLineId.get(line.id);
    if (!targetAmount) {
      continue;
    }

    const currentAmount = line.cost?.amountPerQuantity?.amount;
    const currencyCode = line.cost?.amountPerQuantity?.currencyCode;

    if (!currentAmount || !currencyCode || currentAmount === targetAmount) {
      continue;
    }

    operations.push({
      updateLinePrice: {
        lineId: line.id,
        price: {
          adjustment: {
            fixedPricePerQuantity: {
              amount: targetAmount,
              currencyCode,
            },
          },
        },
      },
    });
  }

  return operations;
}

export default run<InputQuery, FunctionResult>(({ input }) => {
  const buyer = input.cart?.buyerIdentity;
  const companyLocation = buyer?.companyLocation;
  const vatRates = parseVatRates(input.shop?.metafield?.value);

  if (!buyer || !companyLocation || !isTaxExemptBuyer(buyer)) {
    return { operations: [] };
  }

  const countryCode = companyLocation.countryCode;

  if (!countryCode) {
    return { operations: [] };
  }

  const vatRate = getVatRate(vatRates, countryCode);

  if (vatRate === null || vatRate <= 0) {
    return { operations: [] };
  }

  const netAmountByLineId = new Map<string, string>();

  for (const line of input.cart?.lines || []) {
    const grossAmount = line.cost?.amountPerQuantity?.amount;
    if (!grossAmount) {
      continue;
    }

    const netAmount = calculateNetAmount(grossAmount, vatRate);
    netAmountByLineId.set(line.id, netAmount);
  }

  const operations = buildOperations(input.cart?.lines || [], netAmountByLineId);

  return { operations };
});
