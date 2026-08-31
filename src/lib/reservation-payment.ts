export const DEPOSIT_RATE = 0.5;

export const RESERVATION_PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "credit_card", label: "Credit/Debit Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "paymaya", label: "PayMaya" },
  { value: "other", label: "Other" },
] as const;

export type ReservationPaymentStatus =
  | "Unpaid"
  | "Deposit Required"
  | "Deposit Paid"
  | "Partially Paid"
  | "Fully Paid";

export function money(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function requiredDeposit(totalAmount: number) {
  return money(Math.max(0, totalAmount) * DEPOSIT_RATE);
}

export function remainingBalance(totalAmount: number, paidAmount: number) {
  return money(Math.max(0, totalAmount) - Math.max(0, paidAmount));
}

export function paymentMethodLabel(method?: string | null) {
  const key = String(method ?? "").trim().toLowerCase();
  if (!key) return "—";
  const found = RESERVATION_PAYMENT_METHODS.find((m) => m.value === key);
  if (found) return found.label;
  if (key === "card" || key === "e-wallet") return key === "card" ? "Credit/Debit Card" : "GCash";
  if (key === "bank") return "Bank Transfer";
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function reservationPaymentStatus(
  totalAmount: number,
  paidAmount: number,
): ReservationPaymentStatus {
  const total = money(totalAmount);
  const paid = money(paidAmount);
  const deposit = requiredDeposit(total);
  if (total <= 0 && paid <= 0) return "Unpaid";
  if (paid <= 0) return "Unpaid";
  if (total > 0 && paid >= total) return "Fully Paid";
  if (paid >= deposit) {
    return paid > deposit ? "Partially Paid" : "Deposit Paid";
  }
  return "Deposit Required";
}

export function reservationPaymentSummary(
  totalAmount: number,
  paidAmount: number,
  method?: string | null,
) {
  const total = money(totalAmount);
  const paid = money(Math.max(0, paidAmount));
  const deposit = requiredDeposit(total);
  const balance = remainingBalance(total, paid);
  return {
    total,
    deposit,
    paid,
    balance,
    method: paymentMethodLabel(method),
    methodRaw: method?.trim() || "",
    status: reservationPaymentStatus(total, paid),
    depositMet: paid >= deposit && deposit > 0,
  };
}

export function validateReservationPayment(totalAmount: number, paidAmount: number) {
  if (!Number.isFinite(paidAmount)) return "Enter a valid amount paid.";
  if (paidAmount < 0) return "Amount paid cannot be negative.";
  if (paidAmount > money(totalAmount) + 0.001) {
    return "Amount paid cannot exceed the total reservation amount.";
  }
  return null;
}

export function peso(value: number) {
  return `₱${money(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function contractPaymentSectionHtml(input: {
  totalAmount: number;
  paidAmount: number;
  paymentMethod?: string | null;
}) {
  const s = reservationPaymentSummary(input.totalAmount, input.paidAmount, input.paymentMethod);
  const row = (label: string, value: string) =>
    `<div class="info-row"><span class="label">${label}:</span> <span class="value">${value}</span></div>`;
  return `
          <div class="section">
            <div class="section-title">Payment Details</div>
            <div class="box">
              <div class="grid">
                ${row("Total Reservation Amount", peso(s.total))}
                ${row("Required Deposit (50%)", peso(s.deposit))}
                ${row("Amount Paid / Down Payment", peso(s.paid))}
                ${row("Remaining Balance", peso(s.balance))}
                ${row("Mode of Payment", s.method)}
                ${row("Payment Status", s.status)}
              </div>
            </div>
          </div>`;
}
