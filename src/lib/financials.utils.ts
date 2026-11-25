export interface PaymentFinancials {
  grossAmount: number;
  gatewayCommission: number;
  gatewayTax: number;
  gatewayTotalFee: number;
  netSettlementAmount: number;
  currency: string;
  isEstimated?: boolean;
}

export function resolvePaymentFinancials(payment: any): PaymentFinancials {
  if (payment?.financials && typeof payment.financials === "object") {
    const gross = Number(payment.financials.grossAmount ?? payment.amount ?? 0);
    const comm = Number(payment.financials.gatewayCommission ?? 0);
    const tax = Number(payment.financials.gatewayTax ?? 0);
    const fee = Number(payment.financials.gatewayTotalFee ?? (comm + tax));
    const net = Number(payment.financials.netSettlementAmount ?? Math.max(0, gross - fee));
    return {
      grossAmount: gross,
      gatewayCommission: comm,
      gatewayTax: tax,
      gatewayTotalFee: fee,
      netSettlementAmount: net,
      currency: payment.financials.currency || payment.currency || "INR",
      isEstimated: payment.financials.isEstimated ?? !payment.chargesFinalized,
    };
  }

  const gross = Number(payment?.amount) || 0;
  const gw = String(payment?.gateway || "").toUpperCase();
  const currency = payment?.currency || "INR";

  let rate = 0;
  if (gw === "CASHFREE") rate = 0.016;
  else if (gw === "RAZORPAY") rate = 0.02;

  if (rate > 0 && gross > 0) {
    const commission = Number((gross * rate).toFixed(2));
    const tax = Number((commission * 0.18).toFixed(2));
    const totalFee = Number((commission + tax).toFixed(2));
    const net = Number(Math.max(0, gross - totalFee).toFixed(2));
    return {
      grossAmount: gross,
      gatewayCommission: commission,
      gatewayTax: tax,
      gatewayTotalFee: totalFee,
      netSettlementAmount: net,
      currency,
      isEstimated: true,
    };
  }

  return {
    grossAmount: gross,
    gatewayCommission: 0,
    gatewayTax: 0,
    gatewayTotalFee: 0,
    netSettlementAmount: gross,
    currency,
    isEstimated: false,
  };
}

