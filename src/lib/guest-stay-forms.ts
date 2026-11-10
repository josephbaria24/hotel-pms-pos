/**
 * Printable Guest Registration Form (check-in) and Checkout Form (check-out).
 * Guests sign to confirm reservation / departure details.
 */

import { formatPhDate, formatPhDateTime, formatPhTime } from "@/lib/datetime";
import {
  contractPaymentSectionHtml,
  peso,
  reservationPaymentSummary,
} from "@/lib/reservation-payment";

export type GuestStayFormData = {
  hotelName: string;
  hotelAddress?: string | null;
  hotelContactNumber?: string | null;
  reservationNumber: string;
  guestName: string;
  phone?: string | null;
  email?: string | null;
  nationality?: string | null;
  idType?: string | null;
  id_type?: string | null;
  idNumber?: string | null;
  id_number?: string | null;
  address?: string | null;
  roomNumber?: string | number | null;
  roomType?: string | null;
  roomRate?: number | null;
  checkInDate: string;
  checkOutDate: string;
  adults?: number | null;
  children?: number | null;
  totalAmount?: number | null;
  paidAmount?: number | null;
  paymentMethod?: string | null;
  notes?: string | null;
  actualCheckInAt?: string | null;
  actualCheckOutAt?: string | null;
  status?: string | null;
  currency?: string | null;
  balance?: number | null;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatAddressContact(address?: string | null, contact?: string | null) {
  return [address, contact].map((v) => String(v ?? "").trim()).filter(Boolean).join(" · ");
}

function idTypeLabel(data: GuestStayFormData) {
  const raw = String(data.idType ?? data.id_type ?? "").trim();
  return raw || "—";
}

function idNumberLabel(data: GuestStayFormData) {
  return String(data.idNumber ?? data.id_number ?? "").trim() || "—";
}

function sharedFormStyles() {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      color: #1a1a1a;
      margin: 0;
      padding: 0;
      line-height: 1.55;
      background: #fff;
    }
    .form-wrapper { max-width: 800px; margin: 0 auto; padding: 36px 48px; }
    .header {
      text-align: center;
      margin-bottom: 24px;
      border-bottom: 2px solid #1a1a1a;
      padding-bottom: 16px;
    }
    .hotel-name {
      font-size: 22px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .form-title {
      margin-top: 10px;
      font-size: 18px;
      font-weight: 700;
    }
    .muted { color: #666; font-size: 12px; margin-top: 4px; }
    .section { margin-top: 20px; }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #444;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
    }
    .section-title::after {
      content: "";
      flex: 1;
      height: 1px;
      background: #eee;
      margin-left: 12px;
    }
    .box {
      border: 1px solid #e5e7eb;
      padding: 16px 18px;
      border-radius: 8px;
      background: #fafafa;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 28px;
      font-size: 13px;
    }
    .info-row {
      display: flex;
      gap: 8px;
      border-bottom: 1px solid #f0f0f0;
      padding-bottom: 3px;
    }
    .info-row.span2 { grid-column: 1 / -1; border-bottom: none; }
    .label { font-weight: 700; color: #374151; min-width: 110px; }
    .value { font-weight: 400; color: #111; }
    .ack-list { margin: 0; padding-left: 18px; }
    .ack-list li {
      margin-bottom: 8px;
      text-align: justify;
      font-size: 13px;
      color: #374151;
    }
    .signature-section {
      margin-top: 48px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 48px;
    }
    .sig-box { text-align: center; }
    .sig-line { border-top: 1px solid #1a1a1a; margin-bottom: 8px; margin-top: 40px; }
    .sig-label {
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
    }
    .footer-info {
      margin-top: 32px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #9ca3af;
      border-top: 1px solid #f3f4f6;
      padding-top: 12px;
    }
    .banner {
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 6px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      font-size: 12px;
      color: #065f46;
      text-align: center;
    }
    .banner.checkout {
      background: #eff6ff;
      border-color: #bfdbfe;
      color: #1e3a8a;
    }
    @media print {
      .form-wrapper { padding: 16px; }
      .box { background: transparent; }
    }
  `;
}

function guestDetailsSection(data: GuestStayFormData) {
  return `
    <div class="section">
      <div class="section-title">Guest Details</div>
      <div class="box">
        <div class="grid">
          <div class="info-row"><span class="label">Full Name:</span> <span class="value">${escapeHtml(data.guestName)}</span></div>
          <div class="info-row"><span class="label">Phone:</span> <span class="value">${escapeHtml(data.phone || "—")}</span></div>
          <div class="info-row"><span class="label">Email:</span> <span class="value">${escapeHtml(data.email || "—")}</span></div>
          <div class="info-row"><span class="label">Nationality:</span> <span class="value">${escapeHtml(data.nationality || "—")}</span></div>
          <div class="info-row"><span class="label">ID Type:</span> <span class="value">${escapeHtml(idTypeLabel(data))}</span></div>
          <div class="info-row"><span class="label">ID Number:</span> <span class="value">${escapeHtml(idNumberLabel(data))}</span></div>
          <div class="info-row span2">
            <span class="label">Address:</span> <span class="value">${escapeHtml(data.address || "—")}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function stayDetailsSection(data: GuestStayFormData, opts?: { showRate?: boolean; showActualTimes?: boolean }) {
  const showRate = opts?.showRate !== false;
  const showActual = Boolean(opts?.showActualTimes);
  return `
    <div class="section">
      <div class="section-title">Stay / Reservation Details</div>
      <div class="box">
        <div class="grid">
          <div class="info-row"><span class="label">Reservation #:</span> <span class="value">${escapeHtml(data.reservationNumber)}</span></div>
          <div class="info-row"><span class="label">Room:</span> <span class="value">${escapeHtml(data.roomNumber ?? "—")}${data.roomType ? ` (${escapeHtml(data.roomType)})` : ""}</span></div>
          ${
            showRate
              ? `<div class="info-row"><span class="label">Nightly Rate:</span> <span class="value">${peso(Number(data.roomRate || 0))}</span></div>`
              : ""
          }
          <div class="info-row"><span class="label">Check-in Date:</span> <span class="value">${escapeHtml(data.checkInDate)}</span></div>
          <div class="info-row"><span class="label">Check-out Date:</span> <span class="value">${escapeHtml(data.checkOutDate)}</span></div>
          <div class="info-row"><span class="label">Guests:</span> <span class="value">${Number(data.adults ?? 1)} adult(s), ${Number(data.children ?? 0)} child(ren)</span></div>
          ${
            showActual && data.actualCheckInAt
              ? `<div class="info-row"><span class="label">Actual Check-in:</span> <span class="value">${escapeHtml(formatPhDateTime(data.actualCheckInAt))}</span></div>`
              : ""
          }
          ${
            showActual && data.actualCheckOutAt
              ? `<div class="info-row"><span class="label">Actual Check-out:</span> <span class="value">${escapeHtml(formatPhDateTime(data.actualCheckOutAt))}</span></div>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

/** Guest Registration Form — signed at check-in to confirm reservation details. */
export function buildGuestRegistrationFormHtml(data: GuestStayFormData) {
  const pay = reservationPaymentSummary(
    Number(data.totalAmount) || 0,
    Number(data.paidAmount) || 0,
    data.paymentMethod,
  );
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Guest Registration Form - ${escapeHtml(data.reservationNumber)}</title>
  <style>${sharedFormStyles()}</style>
</head>
<body>
  <div class="form-wrapper">
    <div class="header">
      <div class="hotel-name">${escapeHtml(data.hotelName)}</div>
      <div class="muted">${escapeHtml(formatAddressContact(data.hotelAddress, data.hotelContactNumber))}</div>
      <div class="form-title">Guest Registration Form</div>
      <div class="muted">Reservation #: ${escapeHtml(data.reservationNumber)}</div>
      <div class="banner">
        Please review the details below from your reservation. Sign to confirm they are correct.
      </div>
    </div>

    ${guestDetailsSection(data)}
    ${stayDetailsSection(data, { showRate: true })}

    ${contractPaymentSectionHtml({
      totalAmount: pay.total,
      paidAmount: pay.paid,
      paymentMethod: data.paymentMethod,
    })}

    <div class="section">
      <div class="section-title">Guest Confirmation</div>
      <div class="box">
        <ul class="ack-list">
          <li>I confirm that the guest and reservation details above are true and correct as provided during booking.</li>
          <li>I agree to comply with hotel house rules, quiet hours, and applicable charges during my stay.</li>
          <li>I authorize the hotel to process my personal information for accommodation and compliance purposes.</li>
          <li>I understand that damages or losses to hotel property caused by me or my companions may be charged to my account.</li>
        </ul>
      </div>
    </div>

    ${
      data.notes
        ? `<div class="section">
            <div class="section-title">Notes</div>
            <div class="box" style="font-size:13px;">${escapeHtml(data.notes)}</div>
          </div>`
        : ""
    }

    <div class="signature-section">
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">Guest Signature over Printed Name</div>
        <div class="muted" style="margin-top:6px;">Date: _______________</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">Front Desk Officer</div>
        <div class="muted" style="margin-top:6px;">Date: _______________</div>
      </div>
    </div>

    <div class="footer-info">
      <div>Generated: ${escapeHtml(formatPhDate(new Date()))} ${escapeHtml(formatPhTime(new Date()))}</div>
      <div>${escapeHtml(data.hotelName)} — Registration copy</div>
    </div>
  </div>
</body>
</html>`;
}

/** Checkout Form — signed at departure to acknowledge stay and settlement. */
export function buildCheckoutFormHtml(data: GuestStayFormData) {
  const total = Number(data.totalAmount) || 0;
  const paid = Number(data.paidAmount) || 0;
  const balance =
    data.balance != null ? Number(data.balance) : Math.max(0, total - paid);
  const pay = reservationPaymentSummary(total, paid, data.paymentMethod);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Guest Checkout Form - ${escapeHtml(data.reservationNumber)}</title>
  <style>${sharedFormStyles()}</style>
</head>
<body>
  <div class="form-wrapper">
    <div class="header">
      <div class="hotel-name">${escapeHtml(data.hotelName)}</div>
      <div class="muted">${escapeHtml(formatAddressContact(data.hotelAddress, data.hotelContactNumber))}</div>
      <div class="form-title">Guest Checkout Form</div>
      <div class="muted">Reservation #: ${escapeHtml(data.reservationNumber)}</div>
      <div class="banner checkout">
        Review stay and charges below. Sign to confirm checkout and that details are correct.
      </div>
    </div>

    ${guestDetailsSection(data)}
    ${stayDetailsSection(data, { showRate: true, showActualTimes: true })}

    <div class="section">
      <div class="section-title">Charges & Settlement</div>
      <div class="box">
        <div class="grid">
          <div class="info-row"><span class="label">Total Charges:</span> <span class="value">${peso(total)}</span></div>
          <div class="info-row"><span class="label">Amount Paid:</span> <span class="value">${peso(paid)}</span></div>
          <div class="info-row"><span class="label">Balance:</span> <span class="value">${peso(balance)}</span></div>
          <div class="info-row"><span class="label">Payment Status:</span> <span class="value">${escapeHtml(pay.status)}</span></div>
          <div class="info-row"><span class="label">Mode of Payment:</span> <span class="value">${escapeHtml(pay.method)}</span></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Checkout Acknowledgement</div>
      <div class="box">
        <ul class="ack-list">
          <li>I confirm that I have reviewed my stay details and the charges listed above.</li>
          <li>I acknowledge that I have vacated the room and returned keys/access cards (if any) to the front desk.</li>
          <li>I confirm that any remaining balance has been settled, or I agree to settle outstanding amounts as arranged with the hotel.</li>
          <li>I release the hotel from further claims related to this stay except for items already noted with the front desk.</li>
        </ul>
      </div>
    </div>

    ${
      data.notes
        ? `<div class="section">
            <div class="section-title">Notes</div>
            <div class="box" style="font-size:13px;">${escapeHtml(data.notes)}</div>
          </div>`
        : ""
    }

    <div class="signature-section">
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">Guest Signature over Printed Name</div>
        <div class="muted" style="margin-top:6px;">Date: _______________</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">Front Desk Officer</div>
        <div class="muted" style="margin-top:6px;">Date: _______________</div>
      </div>
    </div>

    <div class="footer-info">
      <div>Generated: ${escapeHtml(formatPhDate(new Date()))} ${escapeHtml(formatPhTime(new Date()))}</div>
      <div>${escapeHtml(data.hotelName)} — Checkout copy</div>
    </div>
  </div>
</body>
</html>`;
}
