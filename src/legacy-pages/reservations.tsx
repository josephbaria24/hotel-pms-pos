"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useSearch, useLocation } from "wouter";
import {
  useListReservations,
  useCreateReservation,
  useCancelReservation,
  useUpdateReservation,
  useDeleteReservation,
  useGetReservationContractData,
  useGetReservationBillData,
  useListRooms,
  useListGuests,
  useListPayments,
  getListReservationsQueryKey,
  type CreateReservationPayload,
  type Reservation,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Plus, XCircle, Loader2, CircleX, CalendarPlus, Ban,
  User, Users, Baby, Mail, Phone, MapPin, Wallet, 
  DoorOpen, PlusCircle, FileText, Info, CalendarDays,
  CreditCard, Tag, Search, MoreHorizontal, Eye, Pencil, Trash2, FileSpreadsheet
} from "lucide-react";
import { addDays, differenceInDays, format, parseISO } from "date-fns";
import { sileo } from "sileo";
import { formatPhDate, formatPhDateTime, formatPhTime, staysOverlap, todayYmdPh, ymdPh } from "@/lib/datetime";
import { ScrollableTablePane } from "@/components/layout/ScrollableTablePane";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  buildReservationExcelRows,
  downloadReservationsExcel,
  latestPaymentMethod,
} from "@/lib/reservation-excel";
import {
  RESERVATION_PAYMENT_METHODS,
  contractPaymentSectionHtml,
  peso,
  remainingBalance,
  requiredDeposit,
  reservationPaymentSummary,
  validateReservationPayment,
} from "@/lib/reservation-payment";

type ReservationsProps = {
  /** When true, hide the large page title (used inside Guests hub). */
  embedded?: boolean;
};

export default function Reservations({ embedded }: ReservationsProps) {
  const [, setLocation] = useLocation();
  const { data: reservations, isLoading } = useListReservations();
  const { data: rooms = [] } = useListRooms();
  const { data: guests = [] } = useListGuests();
  const { data: payments = [] } = useListPayments();
  const createReservationMutation = useCreateReservation();
  const cancelReservationMutation = useCancelReservation();
  const updateReservationMutation = useUpdateReservation();
  const deleteReservationMutation = useDeleteReservation();
  const contractMutation = useGetReservationContractData();
  const billMutation = useGetReservationBillData();
  const [deleteConfirmRes, setDeleteConfirmRes] = useState<Reservation | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [targetReservationId, setTargetReservationId] = useState<string | null>(null);
  const [generatedBill, setGeneratedBill] = useState<any | null>(null);
  const [billQrDataUrl, setBillQrDataUrl] = useState<string>("");
  const [isConsentDialogOpen, setIsConsentDialogOpen] = useState(false);
  const [isBillDialogOpen, setIsBillDialogOpen] = useState(false);
  const [consentForm, setConsentForm] = useState<any | null>(null);

  const getCurrencySymbol = (currency: string) => (currency?.toLowerCase() === "peso" ? "₱" : "$");
  const formatAddressContact = (address?: string, contact?: string) => {
    const parts = [address?.trim(), contact?.trim()].filter(Boolean);
    return parts.length > 0 ? parts.join(" | ") : "-";
  };

  const buildBillHtml = (data: any, qrDataUrl?: string) => {
    const currency = getCurrencySymbol(data.currency);
    const balance = Number(data.balance);
    const totalPaid = Number(data.paidAmount);
    const finalBalance = balance;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>Billing Statement - ${data.reservationNumber}</title>
        <style>
          @page { margin: 0; }
          html, body { height: 100%; }
          body {
            font-family: Inter, Arial, sans-serif;
            color: #111;
            background: #f3f4f6;
            margin: 0;
            padding: 18px 10px;
          }
          .receipt {
            width: 360px;
            margin: 0 auto;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 18px;
            padding: 16px 14px;
            box-sizing: border-box;
            position: relative;
          }
          .notch {
            position: absolute;
            top: 160px;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: #f3f4f6;
            border: 1px solid #e5e7eb;
          }
          .notch.left { left: -12px; }
          .notch.right { right: -12px; }
          .brand h2 {
            font-size: 18px;
            margin: 0;
            line-height: 1;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .dots {
            display: inline-grid;
            grid-template-columns: repeat(3, 4px);
            grid-template-rows: repeat(3, 4px);
            gap: 2.5px;
            flex-shrink: 0;
            margin-top: 1px;
          }
          .dot {
            width: 4px;
            height: 4px;
            border-radius: 50%;
            background: #111;
          }
          .top {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 10px;
          }
          .small-meta {
            font-size: 10px;
            color: #6b7280;
            margin-top: 4px;
          }
          .rsvp {
            text-align: right;
            font-size: 10px;
            color: #6b7280;
            white-space: nowrap;
          }
          .title {
            text-align: center;
            font-weight: 700;
            margin: 5px 0 8px;
            letter-spacing: 0.2px;
            font-size: 22px;
          }
          .hr { border-top: 1px dashed #e5e7eb; margin: 12px 0; }
          .kv {
            display: grid;
            grid-template-columns: 1fr;
            gap: 6px;
            margin-top: 2px;
          }
          .kv-row {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 10px;
            font-size: 11px;
          }
          .kv-row .k { color: #6b7280; }
          .kv-row .v { font-weight: 600; text-align: right; }
          .section-title {
            font-size: 11px;
            color: #374151;
            font-weight: 700;
            margin-top: 6px;
            margin-bottom: 8px;
          }
          .item {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            padding: 7px 0;
            border-bottom: 1px solid #f3f4f6;
          }
          .item:last-child { border-bottom: 0; }
          .item .name { font-size: 11px; font-weight: 600; }
          .item .desc { font-size: 10px; color: #6b7280; margin-top: 2px; }
          .item .amt { font-size: 11px; font-weight: 700; white-space: nowrap; text-align: right; }
          .totals {
            margin-top: 10px;
            border-radius: 14px;
            border: 1px solid #e5e7eb;
            padding: 12px 12px;
          }
          .total-row {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 10px;
            padding: 4px 0;
            font-size: 11px;
            color: #374151;
          }
          .total-row strong { font-size: 24px; letter-spacing: 0.2px; }
          .total-row.total {
            margin-top: 6px;
            padding-top: 10px;
            border-top: 1px dashed #e5e7eb;
          }
          .footer {
            margin-top: 12px;
            font-size: 11px;
            color: #6b7280;
            text-align: center;
          }
          .qr {
            margin-top: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 128px;
            height: 128px;
            border: 1px dashed #cbd5e1;
            border-radius: 14px;
            margin-left: auto;
            margin-right: auto;
            overflow: hidden;
          }
          .qr span { font-size: 11px; color: #6b7280; }
          .qr img { width: 100%; height: 100%; object-fit: cover; display: block; }

          @media print {
            body { background: #fff; padding: 0; }
            .receipt { border-color: transparent; box-shadow: none; border-radius: 0; }
            .qr { border-color: #e5e7eb; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="notch left"></div>
          <div class="notch right"></div>
          <div class="top">
            <div class="brand">
              <h2>
                <span class="dots">
                  <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                  <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                  <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                </span>
                ${data.hotelName}
              </h2>
              <div class="small-meta">${formatAddressContact(data.hotelAddress, data.hotelContactNumber)}</div>
            </div>
            <div class="rsvp">
              <div><strong>Receipt</strong> #${data.reservationNumber}</div>
              <div>Printed: ${formatPhDateTime(new Date())}</div>
            </div>
          </div>

          <div class="title">Billing Statement</div>
          <div class="hr"></div>

          <div class="kv">
            <div class="kv-row">
              <div class="k">Guest</div>
              <div class="v">${data.guestName}</div>
            </div>
            <div class="kv-row">
              <div class="k">Room</div>
              <div class="v">${data.roomNumber} (${data.roomType})</div>
            </div>
            <div class="kv-row">
              <div class="k">Stay</div>
              <div class="v">${data.checkInDate} → ${data.checkOutDate}</div>
            </div>
            <div class="kv-row">
              <div class="k">Guests</div>
              <div class="v">${data.adults} adult(s), ${data.children} child(ren)</div>
            </div>
          </div>

          <div class="hr"></div>

          <div class="section-title">Summary</div>

          <div class="item">
            <div>
              <div class="name">Accommodation Charges</div>
              <div class="desc">${data.checkInDate} to ${data.checkOutDate}</div>
            </div>
            <div class="amt">${currency}${Number(data.totalAmount).toFixed(2)}</div>
          </div>

          ${
            Array.isArray(data.payments)
              ? data.payments
                  .map(
                    (p: any) => `
                    <div class="item">
                      <div>
                        <div class="name">Payment - ${p.paymentMethod.toUpperCase()}</div>
                        <div class="desc">${formatPhDate(p.createdAt)}</div>
                      </div>
                      <div class="amt">-${currency}${Number(p.amount).toFixed(2)}</div>
                    </div>
                  `,
                  )
                  .join("")
              : ""
          }

          <div class="totals">
            <div class="total-row">
              <span>Total Charges</span>
              <span>${currency}${Number(data.totalAmount).toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span>Total Paid</span>
              <span>${currency}${totalPaid.toFixed(2)}</span>
            </div>
            <div class="total-row total">
              <span>Balance Due</span>
              <strong>${currency}${finalBalance.toFixed(2)}</strong>
            </div>
          </div>

          <div class="qr">
            ${
              qrDataUrl
                ? `<img src="${qrDataUrl}" alt="Receipt QR code" />`
                : `<span>QR / Receipt</span>`
            }
          </div>

          <div class="footer">
            Thank you for staying with us.
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const printHtml = (html: string) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-10000px";
    iframe.style.top = "0";
    iframe.style.width = "420px";
    iframe.style.height = "760px";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";

    document.body.appendChild(iframe);

    const cleanup = () => {
      try {
        document.body.removeChild(iframe);
      } catch {
        // ignore
      }
    };

    let didPrint = false;
    const fallbackTimer = window.setTimeout(() => {
      if (didPrint) return;
      didPrint = true;
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(cleanup, 1500);
    }, 1500);

    iframe.onload = () => {
      if (didPrint) return;
      didPrint = true;
      window.clearTimeout(fallbackTimer);
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(cleanup, 1500);
    };

    try {
      iframe.srcdoc = html;
    } catch {
      const doc = iframe.contentDocument;
      if (!doc) {
        cleanup();
        toast.error("Could not create print document.");
        return;
      }
      doc.open();
      doc.write(html);
      doc.close();
    }
  };

  const downloadHtmlAsImage = async (html: string, filename: string, width = 860) => {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const bodyInner = parsed.body?.innerHTML ?? "";
    const styleInner = Array.from(parsed.querySelectorAll("style"))
      .map((el) => el.textContent ?? "")
      .join("\n");

    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-10000px";
    container.style.top = "0";
    container.style.width = `${width}px`;
    container.style.background = "#ffffff";
    container.style.padding = "0";
    container.style.margin = "0";
    container.style.overflow = "visible";
    
    container.innerHTML = `
      <style>
        ${styleInner}
        .canvas-capture-wrapper {
          padding: 60px !important;
          background: #ffffff !important;
          width: ${width}px !important;
          box-sizing: border-box !important;
        }
      </style>
      <div class="canvas-capture-wrapper">
        ${bodyInner}
      </div>
    `;
    document.body.appendChild(container);

    try {
      if (document.fonts?.ready) {
        await document.fonts.ready.catch(() => {});
      }
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${filename}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      try {
        document.body.removeChild(container);
      } catch {
        // ignore
      }
    }
  };

  const escapeHtml = (value: unknown) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const consentIdType = (data: any) => {
    const raw = data?.idType ?? data?.id_type;
    const s = raw != null ? String(raw).trim() : "";
    return s || "Others";
  };

  const buildConsentContractHtml = (data: any) => {
    const balance = Number(data.totalAmount) - Number(data.paidAmount);
    const idTypeLabel = consentIdType(data);
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>Guest Consent Contract - ${data.reservationNumber}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          body { 
            font-family: 'Inter', -apple-system, sans-serif; 
            color: #1a1a1a; 
            margin: 0; 
            padding: 0; 
            line-height: 1.6; 
            background: #ffffff;
          }
          .contract-wrapper {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 60px;
          }
          h1, h2, h3 { margin: 0; }
          .header { 
            text-align: center; 
            margin-bottom: 30px; 
            border-bottom: 2px solid #1a1a1a; 
            padding-bottom: 20px; 
          }
          .hotel-name { 
            font-size: 24px; 
            font-weight: 800; 
            text-transform: uppercase; 
            letter-spacing: 1px; 
            color: #000;
          }
          .contract-title { 
            margin-top: 12px; 
            font-size: 20px; 
            font-weight: 700; 
            color: #111;
          }
          .muted { color: #666; font-size: 13px; margin-top: 5px; }
          .section { margin-top: 25px; }
          .section-title { 
            font-size: 14px; 
            font-weight: 700; 
            text-transform: uppercase; 
            letter-spacing: 0.5px;
            color: #444;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
          }
          .section-title::after {
            content: "";
            flex: 1;
            height: 1px;
            background: #eee;
            margin-left: 15px;
          }
          .box { 
            border: 1px solid #e5e7eb; 
            padding: 20px; 
            border-radius: 8px; 
            background-color: #fafafa; 
          }
          .grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 12px 40px; 
            font-size: 14px; 
          }
          .info-row {
            display: flex;
            gap: 8px;
            border-bottom: 1px solid #f0f0f0;
            padding-bottom: 4px;
          }
          .label { font-weight: 700; color: #374151; min-width: 100px; }
          .value { font-weight: 400; color: #111; }
          .consent-list { 
            margin: 0; 
            padding-left: 20px; 
          }
          .consent-list li { 
            margin-bottom: 10px; 
            text-align: justify; 
            font-size: 14px; 
            color: #374151; 
          }
          .notes-container {
            margin-top: 10px;
          }
          .notes-line { 
            border-bottom: 1px solid #d1d5db; 
            min-height: 28px; 
            display: block; 
            width: 100%; 
            margin-top: 5px;
            font-size: 14px;
            color: #111;
          }
          .signature-section { 
            margin-top: 60px; 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 60px; 
          }
          .sig-box { 
            text-align: center; 
          }
          .sig-line { 
            border-top: 1px solid #1a1a1a; 
            margin-bottom: 10px; 
          }
          .sig-label { 
            font-size: 12px; 
            font-weight: 600; 
            color: #6b7280; 
            text-transform: uppercase; 
          }
          .footer-info { 
            margin-top: 40px; 
            display: flex; 
            justify-content: space-between; 
            font-size: 12px; 
            color: #9ca3af; 
            border-top: 1px solid #f3f4f6; 
            padding-top: 15px; 
          }
          @media print {
            .contract-wrapper { padding: 20px; }
            .box { background-color: transparent; }
          }
        </style>
      </head>
      <body>
        <div class="contract-wrapper">
          <div class="header">
            <div class="hotel-name">${escapeHtml(data.hotelName)}</div>
            <div class="muted">${escapeHtml(formatAddressContact(data.hotelAddress, data.hotelContactNumber))}</div>
            <div class="contract-title">Guest Consent Contract (New)</div>
            <div class="muted">Reservation #: ${escapeHtml(data.reservationNumber)}</div>
          </div>
          <div class="section">
            <div class="section-title">Guest Details</div>
            <div class="box">
              <div class="grid">
                <div class="info-row"><span class="label">Full Name:</span> <span class="value">${escapeHtml(data.guestName)}</span></div>
                <div class="info-row"><span class="label">Phone:</span> <span class="value">${escapeHtml(data.phone || "-")}</span></div>
                <div class="info-row"><span class="label">Email:</span> <span class="value">${escapeHtml(data.email || "-")}</span></div>
                <div class="info-row"><span class="label">Nationality:</span> <span class="value">${escapeHtml(data.nationality || "-")}</span></div>
                <div class="info-row"><span class="label">ID Type:</span> <span class="value">${escapeHtml(idTypeLabel)}</span></div>
                <div class="info-row"><span class="label">ID Number:</span> <span class="value">${escapeHtml(String(data.idNumber ?? data.id_number ?? "").trim() || "—")}</span></div>
                <div class="info-row" style="grid-column: 1 / span 2; border-bottom: none;">
                  <span class="label">Address:</span> <span class="value">${escapeHtml(data.address || "-")}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="section">
            <div class="section-title">Booking Details</div>
            <div class="box">
              <div class="grid">
                <div class="info-row"><span class="label">Room:</span> <span class="value">${data.roomNumber} (${data.roomType})</span></div>
                <div class="info-row"><span class="label">Nightly Rate:</span> <span class="value">P${Number(data.roomRate || 0).toFixed(2)}</span></div>
                <div class="info-row"><span class="label">Check-in Date:</span> <span class="value">${data.checkInDate}</span></div>
                <div class="info-row"><span class="label">Check-out Date:</span> <span class="value">${data.checkOutDate}</span></div>
                <div class="info-row"><span class="label">Guests:</span> <span class="value">${data.adults} adult(s), ${data.children} child(ren)</span></div>
                <div class="info-row"><span class="label">Balance Due:</span> <span class="value">P${balance.toFixed(2)}</span></div>
              </div>
            </div>
          </div>
          ${contractPaymentSectionHtml({
            totalAmount: Number(data.totalAmount) || 0,
            paidAmount: Number(data.paidAmount) || 0,
            paymentMethod: data.paymentMethod,
          })}
          <div class="section">
            <div class="section-title">Consent & Undertaking</div>
            <div class="box">
              <ul class="consent-list">
                <li>I confirm that all information provided is true and correct.</li>
                <li>I agree to comply with hostel rules, policies, and applicable charges.</li>
                <li>I authorize the hostel to process my personal information for booking and compliance purposes in accordance with data privacy laws.</li>
                <li>I understand that any damages or losses to hostel property caused by me or my guests may be charged to my account based on hostel policy.</li>
              </ul>
            </div>
          </div>
          <div class="section notes-container">
            <div class="label">Additional Notes:</div>
            <div class="notes-line">${data.notes || ""}</div>
          </div>
          <div class="signature-section">
            <div class="sig-box">
              <div class="sig-line"></div>
              <div class="sig-label">Guest Signature & Printed Name</div>
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
              <div class="sig-label">Front Desk Officer</div>
            </div>
          </div>
          <div class="footer-info">
            <div>Generated on: ${formatPhDate(new Date())}</div>
            <div>${data.hotelName} - Guest Copy</div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handleGenerateConsentContract = async (id: string) => {
    try {
      const data = await contractMutation.mutateAsync({ id });
      setConsentForm({
        ...data,
        notes: data.notes ?? "",
        idType: (data as any).idType || (data as any).id_type || "Others",
        idNumber: (data as any).idNumber || (data as any).id_number || "",
      });
      setIsConsentDialogOpen(true);
      toast.success("Consent contract ready for viewing");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate contract");
    }
  };

  const printConsentContract = () => {
    if (!consentForm) return;
    printHtml(buildConsentContractHtml(consentForm));
  };

  const downloadConsentContract = async () => {
    if (!consentForm) return;
    await downloadHtmlAsImage(
      buildConsentContractHtml({ ...consentForm }),
      `consent-contract-${consentForm.reservationNumber}`,
      860,
    );
  };

  const handleGenerateBill = async (id: string) => {
    try {
      setGeneratedBill(null);
      setIsBillDialogOpen(true);
      const data = await billMutation.mutateAsync({ id });
      setGeneratedBill(data);
      const qrPayload = [
        `Reservation: ${data.reservationNumber}`,
        `Guest: ${data.guestName}`,
        `Room: ${data.roomNumber} (${data.roomType})`,
        `Stay: ${data.checkInDate} to ${data.checkOutDate}`,
        `Balance: ${getCurrencySymbol(data.currency)}${Number(data.balance).toFixed(2)}`,
      ].join("\n");
      const QRCode = (await import("qrcode")).default;
      const qr = await QRCode.toDataURL(qrPayload, {
        width: 256,
        margin: 1,
        color: { dark: "#111111", light: "#FFFFFF" },
      });
      setBillQrDataUrl(qr);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate bill");
      setIsBillDialogOpen(false);
    }
  };

  const printBill = () => {
    if (!generatedBill) return;
    const html = buildBillHtml(generatedBill, billQrDataUrl);
    printHtml(html);
  };

  const downloadBill = async () => {
    if (!generatedBill) return;
    const html = buildBillHtml(generatedBill, billQrDataUrl);
    await downloadHtmlAsImage(html, `bill-${generatedBill.reservationNumber}`, 360);
  };

  const confirmDeleteReservation = async () => {
    if (!deleteConfirmRes) return;
    const booking = deleteConfirmRes;
    setDeleteConfirmRes(null);
    setDeleteConfirmText("");
    await sileo.promise(
      deleteReservationMutation.mutateAsync(booking.id),
      {
        loading: {
          title: "Deleting reservation",
          description: `Removing booking ${booking.reservationNumber}...`,
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
        },
        success: {
          title: "Reservation deleted",
          description: `The booking ${booking.reservationNumber} was successfully removed from the system.`,
          icon: <Trash2 className="h-4 w-4" />,
        },
        error: (error) => ({
          title: "Failed to delete reservation",
          description: error instanceof Error ? error.message : "Please try again.",
          icon: <CircleX className="h-4 w-4" />,
        }),
      }
    );
  };

  const deleteOk = deleteConfirmRes && deleteConfirmText.trim() === deleteConfirmRes.reservationNumber.trim();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createTab, setCreateTab] = useState<"stay" | "guest">("stay");
  const [guestHintOpen, setGuestHintOpen] = useState(false);
  const [useExistingGuest, setUseExistingGuest] = useState(true);
  const queryClient = useQueryClient();
  const search = useSearch();
  
  const initialSearch = useMemo(() => {
    const params = new URLSearchParams(search);
    return params.get("search") || "";
  }, [search]);

  const [searchTerm, setSearchTerm] = useState(initialSearch);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [madeOn, setMadeOn] = useState("");
  const [exporting, setExporting] = useState(false);
  const [paidTouched, setPaidTouched] = useState(false);
  const [viewRes, setViewRes] = useState<Reservation | null>(null);
  const [editRes, setEditRes] = useState<Reservation | null>(null);
  const [editResForm, setEditResForm] = useState({ checkInDate: "", checkOutDate: "", notes: "" });
  const [roomPickFilter, setRoomPickFilter] = useState("");
  const [guestPickFilter, setGuestPickFilter] = useState("");
  const cancelTimeouts = useRef<Record<string, any>>({});
  const createBodyRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (!editRes) return;
    setEditResForm({
      checkInDate: editRes.checkInDate.slice(0, 10),
      checkOutDate: editRes.checkOutDate.slice(0, 10),
      notes: editRes.notes ?? "",
    });
  }, [editRes]);



  // Sync state with URL if it changes (e.g. from redirection)
  useEffect(() => {
    if (initialSearch) {
      setSearchTerm(initialSearch);
    }
  }, [initialSearch]);
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [form, setForm] = useState<any>({
    roomId: "",
    guestId: "",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    address: "",
    checkInDate: today,
    checkOutDate: tomorrow,
    adults: "1",
    children: "",
    totalAmount: "",
    additionalFee: "",
    additionalFeeLabel: "",
    notes: "",
    amountPaid: "",
    paymentMethod: "cash",
  });

  useEffect(() => {
    if (!isCreateOpen) {
      setRoomPickFilter("");
      setGuestPickFilter("");
      setCreateTab("stay");
      setGuestHintOpen(false);
    }
  }, [isCreateOpen]);

  useEffect(() => {
    const room = rooms.find((r) => r.id === form.roomId);
    if (!room || !form.checkInDate || !form.checkOutDate) return;

    const start = new Date(form.checkInDate);
    const end = new Date(form.checkOutDate);

    // Calculate nights using date-fns
    const nights = differenceInDays(end, start);

    if (nights > 0) {
      const roomRate = room.pricePerNight || 0;
      const roomTotal = nights * roomRate;
      const extraFee = Number(form.additionalFee) || 0;
      const total = roomTotal + extraFee;

      setForm((prev: any) => {
        const next = { ...prev, totalAmount: total.toString() };
        if (!paidTouched) {
          next.amountPaid = requiredDeposit(total).toFixed(2);
        }
        return next;
      });
    }
  }, [form.roomId, form.checkInDate, form.checkOutDate, form.additionalFee, rooms, paidTouched]);

  const resetForm = () => {
    setForm({
      roomId: "",
      guestId: "",
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      address: "",
      checkInDate: today,
      checkOutDate: tomorrow,
      adults: "1",
      children: "",
      totalAmount: "",
      additionalFee: "",
      additionalFeeLabel: "",
      notes: "",
      amountPaid: "",
      paymentMethod: "cash",
    });
    setPaidTouched(false);
  };

  const bookingSearchParams = useMemo(() => {
    const raw = search.startsWith("?") ? search.slice(1) : search;
    return new URLSearchParams(raw);
  }, [search]);

  const appliedDeepLink = useRef("");
  useEffect(() => {
    const raw = bookingSearchParams.toString();
    const wantsNew = bookingSearchParams.get("new") === "1";
    const checkIn = bookingSearchParams.get("checkIn");
    const resId = bookingSearchParams.get("reservation");
    if (!wantsNew && !resId) {
      appliedDeepLink.current = raw;
      return;
    }
    if (wantsNew && appliedDeepLink.current !== `new:${raw}`) {
      appliedDeepLink.current = `new:${raw}`;
      if (checkIn && /^\d{4}-\d{2}-\d{2}$/.test(checkIn)) {
        const checkOut = format(addDays(parseISO(checkIn), 1), "yyyy-MM-dd");
        setForm((prev: any) => ({
          ...prev,
          checkInDate: checkIn,
          checkOutDate: checkOut,
        }));
      }
      setIsCreateOpen(true);
    }
    if (resId) {
      const found = (reservations ?? []).find((r) => r.id === resId);
      if (found && appliedDeepLink.current !== `res:${resId}`) {
        appliedDeepLink.current = `res:${resId}`;
        setViewRes(found);
      }
    }
  }, [bookingSearchParams, reservations]);

  const stripBookingParams = (keys: string[]) => {
    const p = new URLSearchParams(bookingSearchParams);
    let changed = false;
    for (const key of keys) {
      if (p.has(key)) {
        p.delete(key);
        changed = true;
      }
    }
    if (!changed) return;
    const qs = p.toString();
    setLocation(qs ? `/guests?${qs}` : "/guests");
  };

  const availableRooms = rooms.filter((room) => room.status === "available");

  const blockingReservations = useMemo(
    () =>
      (reservations ?? []).filter(
        (r) => r.status === "reserved" || r.status === "checked_in",
      ),
    [reservations],
  );

  const conflictForRoom = (roomId: string) => {
    if (!form.checkInDate || !form.checkOutDate) return null;
    return (
      blockingReservations.find(
        (r) =>
          r.roomId === roomId &&
          staysOverlap(
            form.checkInDate,
            form.checkOutDate,
            r.checkInDate,
            r.checkOutDate,
          ),
      ) ?? null
    );
  };

  const availableRoomsFiltered = useMemo(() => {
    const q = roomPickFilter.trim().toLowerCase();
    const list = rooms.filter((r) => r.status !== "maintenance");
    if (!q) return list;
    return list.filter(
      (r) =>
        r.roomNumber.toLowerCase().includes(q) ||
        (r.type || "").toLowerCase().includes(q),
    );
  }, [rooms, roomPickFilter]);

  useEffect(() => {
    if (!form.roomId || !form.checkInDate || !form.checkOutDate) return;
    const clash = conflictForRoom(form.roomId);
    if (!clash) return;
    setForm((prev: any) => ({ ...prev, roomId: "" }));
    sileo.error({
      title: "Room already reserved",
      description: `Room is booked ${formatPhDate(clash.checkInDate)} – ${formatPhDate(clash.checkOutDate)} for ${clash.guestName}. Choose another room or different dates.`,
      icon: <DoorOpen className="w-4 h-4" />,
    });
  }, [form.roomId, form.checkInDate, form.checkOutDate, blockingReservations]);

  const guestsFiltered = useMemo(() => {
    const q = guestPickFilter.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter(
      (g) =>
        g.fullName.toLowerCase().includes(q) ||
        (g.contactNumber || "").toLowerCase().includes(q) ||
        (g.email || "").toLowerCase().includes(q),
    );
  }, [guests, guestPickFilter]);

  const createReservation = async () => {
    // Client-side validation
    if (!form.roomId) {
      sileo.error({
        title: "Selection Required",
        description: "Please select a room to continue.",
        icon: <DoorOpen className="w-4 h-4" />
      });
      return;
    }

    if (useExistingGuest && !form.guestId) {
      setCreateTab("guest");
      requestAnimationFrame(() => {
        createBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      });
      window.setTimeout(() => setGuestHintOpen(true), 280);
      return;
    }

    if (!useExistingGuest && (!form.firstName?.trim() || !form.lastName?.trim())) {
      setCreateTab("guest");
      requestAnimationFrame(() => {
        createBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      });
      window.setTimeout(() => setGuestHintOpen(true), 280);
      return;
    }

    if (!form.checkInDate || !form.checkOutDate) {
      sileo.error({
        title: "Dates Required",
        description: "Please specify both check-in and check-out dates.",
        icon: <CalendarDays className="w-4 h-4" />
      });
      return;
    }

    const start = new Date(form.checkInDate);
    const end = new Date(form.checkOutDate);
    if (end <= start) {
      sileo.error({
        title: "Invalid Stay Duration",
        description: "The check-out date must be at least one day after check-in.",
        icon: <CalendarDays className="h-4 w-4" />
      });
      return;
    }

    const clash = conflictForRoom(form.roomId);
    if (clash) {
      sileo.error({
        title: "Room already reserved",
        description: `This room is booked ${formatPhDate(clash.checkInDate)} – ${formatPhDate(clash.checkOutDate)} for ${clash.guestName}. It cannot be reserved again on overlapping dates.`,
        icon: <DoorOpen className="w-4 h-4" />,
      });
      return;
    }

    const totalAmount = Number(form.totalAmount) || 0;
    const paidAmount = Number(form.amountPaid);
    const payError = validateReservationPayment(totalAmount, paidAmount);
    if (payError) {
      sileo.error({
        title: "Payment amount invalid",
        description: payError,
        icon: <Wallet className="w-4 h-4" />,
      });
      return;
    }
    if (paidAmount > 0 && !String(form.paymentMethod ?? "").trim()) {
      sileo.error({
        title: "Mode of payment required",
        description: "Select how the deposit or payment was received.",
        icon: <CreditCard className="w-4 h-4" />,
      });
      return;
    }

    const finalNotes = [
      form.notes,
      form.additionalFeeLabel ? `Additional Fee: ₱${form.additionalFee} (${form.additionalFeeLabel})` : ""
    ].filter(Boolean).join("\n");

    const payload: CreateReservationPayload = {
      roomId: form.roomId,
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      adults: Number(form.adults) || 1,
      children: Number(form.children) || 0,
      totalAmount,
      paidAmount,
      paymentMethod: paidAmount > 0 ? form.paymentMethod : undefined,
      notes: finalNotes,
      guestId: useExistingGuest ? form.guestId : undefined,
      firstName: useExistingGuest ? undefined : form.firstName,
      lastName: useExistingGuest ? undefined : form.lastName,
      phone: useExistingGuest ? undefined : form.phone,
      email: useExistingGuest ? undefined : form.email,
      address: useExistingGuest ? undefined : form.address,
    };

    const paySummary = reservationPaymentSummary(totalAmount, paidAmount, form.paymentMethod);

    await sileo.promise(
      createReservationMutation.mutateAsync(payload).then(async (result) => {
        await queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
        setIsCreateOpen(false);
        resetForm();
        return result;
      }),
      {
        loading: {
          title: "Creating reservation",
          description: "Saving guest and booking details...",
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
        },
        success: {
          title: "Reservation created",
          description: paySummary.depositMet || paySummary.paid <= 0
            ? `Booking is now ready for arrival. Payment status: ${paySummary.status}.`
            : `Booking saved. Payment is below the 50% deposit (${paySummary.status}).`,
          icon: <CalendarPlus className="h-4 w-4" />,
        },
        error: (error) => ({
          title: "Failed to create reservation",
          description: error instanceof Error ? error.message : "Please try again.",
          icon: <CircleX className="h-4 w-4" />,
        }),
      },
    );
  };

  const saveReservationEdit = async () => {
    if (!editRes) return;
    await sileo.promise(
      (async () => {
        if (editRes.status === "reserved") {
          await updateReservationMutation.mutateAsync({
            id: editRes.id,
            checkInDate: editResForm.checkInDate,
            checkOutDate: editResForm.checkOutDate,
            notes: editResForm.notes,
          });
        } else if (editRes.status === "checked_in") {
          await updateReservationMutation.mutateAsync({
            id: editRes.id,
            notes: editResForm.notes,
          });
        } else {
          throw new Error("This booking cannot be edited.");
        }
        await queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
        setEditRes(null);
      })(),
      {
        loading: {
          title: "Saving changes",
          description: "Updating reservation…",
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
        },
        success: {
          title: "Saved",
          description: "Reservation was updated.",
          icon: <CalendarPlus className="h-4 w-4" />,
        },
        error: (error) => ({
          title: "Update failed",
          description: error instanceof Error ? error.message : "Please try again.",
          icon: <CircleX className="h-4 w-4" />,
        }),
      },
    );
  };

  const runCancelReservation = async (id: string, reservationNumber: string) => {
    await sileo.promise(
      cancelReservationMutation.mutateAsync({ id }).then(async (result) => {
        await queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
        return result;
      }),
      {
        loading: {
          title: "Cancelling reservation",
          description: `Updating status for ${reservationNumber}...`,
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
        },
        success: {
          title: "Reservation cancelled",
          description: `The booking ${reservationNumber} was marked as cancelled.`,
          icon: <Ban className="h-4 w-4" />,
        },
        error: (error) => ({
          title: "Failed to cancel reservation",
          description: error instanceof Error ? error.message : "Please try again.",
          icon: <CircleX className="h-4 w-4" />,
        }),
      },
    );
  };

  const handleCancelWithUndo = (res: Reservation) => {
    // If there's already a pending cancel for this, clear it first
    if (cancelTimeouts.current[res.id]) {
      clearTimeout(cancelTimeouts.current[res.id]);
    }

    toast(`Cancelling reservation ${res.reservationNumber}`, {
      description: "Action will proceed in 3 seconds.",
      action: {
        label: "Undo",
        onClick: () => {
          if (cancelTimeouts.current[res.id]) {
            clearTimeout(cancelTimeouts.current[res.id]);
            delete cancelTimeouts.current[res.id];
            toast.success("Cancellation undone.", {
              description: `The booking ${res.reservationNumber} remains active.`
            });
          }
        },
      },
      duration: 3000,
    });

    cancelTimeouts.current[res.id] = setTimeout(async () => {
      delete cancelTimeouts.current[res.id];
      await runCancelReservation(res.id, res.reservationNumber);
    }, 3000);
  };


  const filteredReservations = useMemo(() => {
    if (!reservations) return [];
    const s = searchTerm.toLowerCase().trim();
    return reservations.filter((res) => {
      if (statusFilter !== "all" && res.status !== statusFilter) return false;
      if (dateFrom && res.checkOutDate.slice(0, 10) < dateFrom) return false;
      if (dateTo && res.checkInDate.slice(0, 10) > dateTo) return false;
      if (madeOn && ymdPh(res.createdAt ?? "") !== madeOn) return false;
      if (!s) return true;
      return (
        res.reservationNumber.toLowerCase().includes(s) ||
        res.guestName.toLowerCase().includes(s) ||
        res.roomNumber.toLowerCase().includes(s)
      );
    });
  }, [reservations, searchTerm, statusFilter, dateFrom, dateTo, madeOn]);

  const exportReservations = async () => {
    if (filteredReservations.length === 0) {
      sileo.error({
        title: "Nothing to export",
        description: "No reservations match the current filters.",
        icon: <FileSpreadsheet className="w-4 h-4" />,
      });
      return;
    }
    setExporting(true);
    try {
      const rows = buildReservationExcelRows(filteredReservations, guests, rooms, payments);
      const datePart = madeOn || todayYmdPh();
      await downloadReservationsExcel(rows, `Reservations_${datePart}.xlsx`);
      toast.success(`Exported ${rows.length} reservation${rows.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export Excel file");
    } finally {
      setExporting(false);
    }
  };

  const createPay = reservationPaymentSummary(
    Number(form.totalAmount) || 0,
    Number(form.amountPaid) || 0,
    form.paymentMethod,
  );

  return (
    <div className={embedded ? "space-y-3" : "space-y-6"}>
      <header className="flex min-w-0 flex-col gap-1.5">
        <div className="flex min-w-0 items-center justify-between gap-2">
          {!embedded ? (
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Reservations</h1>
              <p className="hidden text-sm text-muted-foreground sm:block">Manage all hotel reservations.</p>
            </div>
          ) : (
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight">Bookings</h2>
            </div>
          )}
          <Dialog
            open={isCreateOpen}
            onOpenChange={(open) => {
              setIsCreateOpen(open);
              if (!open) stripBookingParams(["new", "checkIn"]);
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 shrink-0 rounded-full px-2.5 sm:px-3">
                <Plus className="w-3.5 h-3.5 sm:mr-1" />
                <span className="sm:hidden">New</span>
                <span className="hidden sm:inline">New Reservation</span>
              </Button>
            </DialogTrigger>
          <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-4 overflow-hidden p-6 sm:max-h-[85dvh]">
            <DialogHeader className="shrink-0 pr-8">
              <DialogTitle className="text-2xl flex items-center gap-2">
                <CalendarPlus className="w-6 h-6 text-primary" />
                Create Reservation
              </DialogTitle>
              <DialogDescription>
                Secure a room and manage guest stay details in one place.
              </DialogDescription>
            </DialogHeader>

            <div
              ref={createBodyRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
            >
            <Tabs
              value={createTab}
              onValueChange={(value) => {
                setCreateTab(value as "stay" | "guest");
                if (value !== "guest") setGuestHintOpen(false);
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="stay" className="flex items-center gap-2">
                  <DoorOpen className="w-4 h-4" />
                  Stay Details
                </TabsTrigger>
                <TabsTrigger
                  value="guest"
                  className={cn(
                    "flex items-center gap-2",
                    guestHintOpen && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  )}
                >
                  <User className="w-4 h-4" />
                  Guest Information
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="stay"
                className="space-y-4 duration-300 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-left-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-lg p-4 bg-muted/30">
                  <div className="space-y-2 md:col-span-2">
                    <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-bold">
                      <DoorOpen className="w-3.5 h-3.5" />
                      Select Room
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Rooms already reserved or occupied on these dates stay listed but cannot be selected.
                    </p>
                    <div className="rounded-lg border bg-card overflow-hidden">
                      {/* Sticky search */}
                      <div className="sticky top-0 z-[1] bg-card border-b px-2 py-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Filter by room # or type…"
                            value={roomPickFilter}
                            onChange={(e) => setRoomPickFilter(e.target.value)}
                            className="h-8 bg-background pl-8 text-xs"
                          />
                        </div>
                      </div>
                      {/* Scrollable room list */}
                      <div className="max-h-[180px] overflow-y-auto divide-y">
                        {availableRoomsFiltered.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">No rooms match the filter.</p>
                        ) : (
                          availableRoomsFiltered.map((room) => {
                            const clash = conflictForRoom(room.id);
                            const unavailable = Boolean(clash);
                            const holdLabel =
                              clash?.status === "checked_in" ? "Occupied" : "Reserved";
                            return (
                            <button
                              key={room.id}
                              type="button"
                              disabled={unavailable}
                              onClick={() => {
                                if (unavailable) return;
                                setForm((prev: any) => ({ ...prev, roomId: room.id }));
                              }}
                              className={cn(
                                "w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                                unavailable
                                  ? "cursor-not-allowed bg-muted/40 text-muted-foreground"
                                  : "hover:bg-muted/50",
                                form.roomId === room.id && !unavailable
                                  ? "bg-primary/10 ring-1 ring-inset ring-primary/30"
                                  : "",
                              )}
                              title={
                                clash
                                  ? `${holdLabel} ${formatPhDate(clash.checkInDate)} – ${formatPhDate(clash.checkOutDate)} (${clash.guestName})`
                                  : undefined
                              }
                            >
                              <div className="min-w-0">
                                <span className="font-mono font-medium">{room.roomNumber}</span>
                                <span className="text-muted-foreground ml-1.5 capitalize">{room.type}</span>
                              </div>
                              <span className="text-xs shrink-0">
                                {clash ? (
                                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                                    {holdLabel}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">₱{room.pricePerNight.toLocaleString()}/night</span>
                                )}
                              </span>
                            </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-bold">
                      <CalendarDays className="w-3.5 h-3.5" />
                      Check-in Date
                    </Label>
                    <Input
                      type="date"
                      value={form.checkInDate}
                      onChange={(e) => setForm((prev: any) => ({ ...prev, checkInDate: e.target.value }))}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-bold">
                      <CalendarDays className="w-3.5 h-3.5" />
                      Check-out Date
                    </Label>
                    <Input
                      type="date"
                      value={form.checkOutDate}
                      onChange={(e) => setForm((prev: any) => ({ ...prev, checkOutDate: e.target.value }))}
                      className="bg-background"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-bold">
                      <Users className="w-3.5 h-3.5" />
                      Adults
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.adults}
                      onChange={(e) => setForm((prev: any) => ({ ...prev, adults: e.target.value }))}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-bold">
                      <Baby className="w-3.5 h-3.5" />
                      Children
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.children}
                      onChange={(e) => setForm((prev: any) => ({ ...prev, children: e.target.value }))}
                      placeholder="0"
                      className="bg-background"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-lg p-4 bg-primary/5 border-primary/20 shadow-sm">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-bold">
                      <PlusCircle className="w-3.5 h-3.5" />
                      Additional Fee (₱)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.additionalFee}
                      onChange={(e) => setForm((prev: any) => ({ ...prev, additionalFee: e.target.value }))}
                      placeholder="0.00"
                      className="bg-background border-primary/20 focus-visible:ring-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-bold">
                      <Tag className="w-3.5 h-3.5" />
                      Fee Description
                    </Label>
                    <Input
                      value={form.additionalFeeLabel}
                      onChange={(e) => setForm((prev: any) => ({ ...prev, additionalFeeLabel: e.target.value }))}
                      placeholder="e.g. Extra Bed, Early Check-in"
                      className="bg-background border-primary/20 focus-visible:ring-primary"
                    />
                  </div>

                  <div className="md:col-span-2 pt-2">
                    <div className="flex justify-between items-center bg-background p-4 rounded-lg border border-primary/30 shadow-inner">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Wallet className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Grand Total</p>
                          <p className="text-xs text-muted-foreground font-medium">Automatic calculation</p>
                        </div>
                      </div>
                      <div className="text-3xl font-black text-primary tracking-tight">
                        {peso(Number(form.totalAmount) || 0)}
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-3 rounded-lg border border-primary/20 bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Payment</p>
                      <Badge variant={createPay.status === "Fully Paid" ? "default" : "secondary"}>
                        {createPay.status}
                      </Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Required deposit (50%)</p>
                        <p className="font-semibold">{peso(createPay.deposit)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Remaining balance</p>
                        <p className="font-semibold">{peso(createPay.balance)}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold">
                          <Wallet className="w-3.5 h-3.5" />
                          Amount paid
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={form.amountPaid}
                          onChange={(e) => {
                            setPaidTouched(true);
                            setForm((prev: any) => ({ ...prev, amountPaid: e.target.value }));
                          }}
                          placeholder={createPay.deposit.toFixed(2)}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold">
                          <CreditCard className="w-3.5 h-3.5" />
                          Mode of payment
                        </Label>
                        <Select
                          value={form.paymentMethod || "cash"}
                          onValueChange={(value) => setForm((prev: any) => ({ ...prev, paymentMethod: value }))}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                          <SelectContent>
                            {RESERVATION_PAYMENT_METHODS.map((method) => (
                              <SelectItem key={method.value} value={method.value}>
                                <SelectItemText>{method.label}</SelectItemText>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {createPay.paid > 0 && createPay.paid < createPay.deposit ? (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Amount paid is below the 50% deposit. You can still save this booking; payment status will be Deposit Required.
                      </p>
                    ) : null}
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                value="guest"
                className="space-y-4 duration-300 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-right-6"
              >
                <div className="flex gap-2 p-1 bg-muted rounded-md mb-2">
                  <Button
                    type="button"
                    variant={useExistingGuest ? "secondary" : "ghost"}
                    className="flex-1 text-xs h-8 shadow-none"
                    onClick={() => setUseExistingGuest(true)}
                  >
                    Existing Guest Profile
                  </Button>
                  <Tooltip
                    open={guests.length === 0 && useExistingGuest ? true : undefined}
                    delayDuration={0}
                  >
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant={!useExistingGuest ? "secondary" : "ghost"}
                        className={cn(
                          "flex-1 text-xs h-8 shadow-none",
                          guests.length === 0 && useExistingGuest && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                        )}
                        onClick={() => {
                          setUseExistingGuest(false);
                          setGuestHintOpen(true);
                        }}
                      >
                        New Guest Entry
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      No saved guest profiles yet. Click here to enter a new guest.
                    </TooltipContent>
                  </Tooltip>
                </div>

                {useExistingGuest && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2.5 text-sm">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" />
                    <div className="min-w-0 text-sky-950 dark:text-sky-100">
                      {guests.length === 0 ? (
                        <>
                          <p className="font-medium">No existing guest profiles yet</p>
                          <p className="mt-0.5 text-xs text-sky-800/90 dark:text-sky-200/90">
                            Click <span className="font-semibold">New Guest Entry</span> above to add this guest’s name and contact details.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium">Choose a returning guest</p>
                          <p className="mt-0.5 text-xs text-sky-800/90 dark:text-sky-200/90">
                            Select someone from the list, or click <span className="font-semibold">New Guest Entry</span> for a first-time visitor.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                  {useExistingGuest ? (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-bold">
                        <Users className="w-3.5 h-3.5" />
                        Guest Search
                      </Label>
                      <Tooltip open={guestHintOpen} onOpenChange={setGuestHintOpen} delayDuration={0}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "rounded-lg border bg-card overflow-hidden transition-shadow",
                              guestHintOpen && "ring-2 ring-primary shadow-md",
                            )}
                          >
                        {/* Sticky search */}
                        <div className="sticky top-0 z-[1] bg-card border-b px-2 py-2">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="Filter by name, phone, email…"
                              value={guestPickFilter}
                              onChange={(e) => setGuestPickFilter(e.target.value)}
                              className="h-8 bg-background pl-8 text-xs"
                            />
                          </div>
                        </div>
                        {/* Scrollable guest list */}
                        <div className="max-h-[200px] overflow-y-auto divide-y">
                          {guestsFiltered.length === 0 ? (
                            <div className="px-3 py-5 text-center">
                              <p className="text-sm font-medium">
                                {guests.length === 0
                                  ? "No guest profiles saved yet"
                                  : "No guests match the filter"}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {guests.length === 0
                                  ? "Use New Guest Entry to create this guest now."
                                  : "Try a different search, or add them as a new guest."}
                              </p>
                              <Button
                                type="button"
                                size="sm"
                                className="mt-3"
                                onClick={() => {
                                  setUseExistingGuest(false);
                                  setGuestHintOpen(true);
                                }}
                              >
                                New Guest Entry
                              </Button>
                            </div>
                          ) : (
                            guestsFiltered.map((guest) => (
                              <button
                                key={guest.id}
                                type="button"
                                onClick={() => {
                                  setForm((prev: any) => ({ ...prev, guestId: guest.id }));
                                  setGuestHintOpen(false);
                                }}
                                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50 ${
                                  form.guestId === guest.id
                                    ? "bg-primary/10 ring-1 ring-inset ring-primary/30"
                                    : ""
                                }`}
                              >
                                <div className="min-w-0">
                                  <span className="font-medium truncate">{guest.fullName}</span>
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">{guest.contactNumber || guest.email || "No contact"}</span>
                              </button>
                            ))
                          )}
                        </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          Select a guest from this list to complete the reservation
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  ) : (
                    <Tooltip open={guestHintOpen} onOpenChange={setGuestHintOpen} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "grid grid-cols-1 md:grid-cols-2 gap-4 rounded-md transition-shadow",
                            guestHintOpen && "ring-2 ring-primary p-3 -m-1",
                          )}
                        >
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-bold">
                          <User className="w-3.5 h-3.5" /> First Name
                        </Label>
                        <Input
                          value={form.firstName || ""}
                          onChange={(e) => {
                            const firstName = e.target.value;
                            setForm((prev: any) => ({ ...prev, firstName }));
                            if (firstName.trim() && form.lastName?.trim()) setGuestHintOpen(false);
                          }}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-bold">
                          <User className="w-3.5 h-3.5" /> Last Name
                        </Label>
                        <Input
                          value={form.lastName || ""}
                          onChange={(e) => {
                            const lastName = e.target.value;
                            setForm((prev: any) => ({ ...prev, lastName }));
                            if (form.firstName?.trim() && lastName.trim()) setGuestHintOpen(false);
                          }}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-bold">
                          <Phone className="w-3.5 h-3.5" /> Phone
                        </Label>
                        <Input
                          value={form.phone || ""}
                          onChange={(e) => setForm((prev: any) => ({ ...prev, phone: e.target.value }))}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-bold">
                          <Mail className="w-3.5 h-3.5" /> Email
                        </Label>
                        <Input
                          type="email"
                          value={form.email || ""}
                          onChange={(e) => setForm((prev: any) => ({ ...prev, email: e.target.value }))}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-bold">
                          <MapPin className="w-3.5 h-3.5" /> Address (Optional)
                        </Label>
                        <Input
                          value={form.address || ""}
                          onChange={(e) => setForm((prev: any) => ({ ...prev, address: e.target.value }))}
                          className="bg-background"
                          placeholder="Full residential or business address"
                        />
                      </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        Enter the guest’s first and last name to continue
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-bold">
                    <FileText className="w-3.5 h-3.5" />
                    Reservation Notes
                  </Label>
                  <Textarea
                    value={form.notes || ""}
                    onChange={(e) => setForm((prev: any) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any special requests, arrival time, etc."
                    className="min-h-[80px] bg-background"
                  />
                </div>
              </TabsContent>
            </Tabs>
            </div>

            <DialogFooter className="mt-0 shrink-0 gap-2 border-t pt-4 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} className="flex-1 sm:flex-none">
                Discard Changes
              </Button>
              <Button type="button" onClick={createReservation} disabled={createReservationMutation.isPending} className="flex-1 sm:flex-none gap-2 px-8">
                {createReservationMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CalendarPlus className="w-4 h-4" />
                    Complete Reservation
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>

        <div className="grid w-full min-w-0 grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-end">
          <div className="relative col-span-2 min-w-0 sm:min-w-[11rem] sm:max-w-xs sm:flex-1">
            <Input
              placeholder="Search bookings..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
              }}
              className="h-8 w-full rounded-full bg-card pl-8 text-sm"
            />
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-full min-w-0 rounded-full bg-card text-xs sm:w-[8.75rem]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <SelectItemText>All statuses</SelectItemText>
              </SelectItem>
              <SelectItem value="reserved">
                <SelectItemText>Reserved</SelectItemText>
              </SelectItem>
              <SelectItem value="checked_in">
                <SelectItemText>Checked in</SelectItemText>
              </SelectItem>
              <SelectItem value="checked_out">
                <SelectItemText>Checked out</SelectItemText>
              </SelectItem>
              <SelectItem value="cancelled">
                <SelectItemText>Cancelled</SelectItemText>
              </SelectItem>
              <SelectItem value="no_show">
                <SelectItemText>No show</SelectItemText>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full min-w-0 rounded-full px-2 text-xs sm:w-auto sm:px-3"
            onClick={exportReservations}
            disabled={exporting || isLoading}
            title="Export currently listed reservations to Excel"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5 sm:mr-1" />
            )}
            <span className="truncate">Export</span>
          </Button>
          <div className="col-span-2 grid min-w-0 grid-cols-2 gap-1.5 sm:contents">
          <label className="col-span-2 min-w-0 sm:col-span-1 sm:w-[9.5rem]">
            <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Made on
            </span>
            <Input
              type="date"
              className="h-8 w-full min-w-0 max-w-full bg-card px-1.5 text-[12px] tabular-nums [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-datetime-edit]:min-w-0"
              value={madeOn}
              onChange={(e) => setMadeOn(e.target.value)}
              title="Reservations created on this date"
            />
          </label>
          <label className="min-w-0 sm:w-[9.5rem]">
            <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Stay from
            </span>
            <Input
              type="date"
              className="h-8 w-full min-w-0 max-w-full bg-card px-1.5 text-[12px] tabular-nums [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-datetime-edit]:min-w-0"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="Stay overlaps from"
            />
          </label>
          <label className="min-w-0 sm:w-[9.5rem]">
            <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Stay to
            </span>
            <Input
              type="date"
              className="h-8 w-full min-w-0 max-w-full bg-card px-1.5 text-[12px] tabular-nums [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-datetime-edit]:min-w-0"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="Stay overlaps to"
            />
          </label>
          </div>
        </div>
      </header>

      <ScrollableTablePane offsetRem={12.5} minVh={30}>
        <Table>
          <TableHeader className="sticky top-0 z-[1] bg-card shadow-sm">
            <TableRow>
              <TableHead>Reservation #</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Check In</TableHead>
              <TableHead>Check Out</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && filteredReservations.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-[80px] ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-[80px] ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredReservations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {searchTerm || statusFilter !== "all" || dateFrom || dateTo || madeOn
                    ? "No reservations match your filters."
                    : "No reservations found."}
                </TableCell>
              </TableRow>
            ) : (
              filteredReservations.map((res) => (
                <TableRow key={res.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{res.reservationNumber}</TableCell>
                  <TableCell className="font-medium">
                    {res.guestId ? (
                      <button
                        type="button"
                        title="Open guest folio"
                        onClick={() =>
                          setLocation(`/guests?tab=directory&guest=${encodeURIComponent(res.guestId)}`)
                        }
                        className="text-left font-medium hover:underline hover:text-primary transition-colors"
                      >
                        {res.guestName}
                      </button>
                    ) : (
                      res.guestName
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">{res.roomNumber}</Badge>
                  </TableCell>
                  <TableCell>{formatPhDate(res.checkInDate)}</TableCell>
                  <TableCell>{formatPhDate(res.checkOutDate)}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        res.status === 'checked_in' ? 'default' : 
                        res.status === 'reserved' ? 'secondary' : 
                        res.status === 'cancelled' ? 'destructive' : 'outline'
                      }
                    >
                      {res.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">₱{res.balance.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Reservation actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => setViewRes(res)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {(res.status === "reserved" || res.status === "checked_in") ? (
                          <DropdownMenuItem onClick={() => setEditRes(res)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Booking
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem onClick={() => handleGenerateBill(res.id)}>
                          <FileText className="mr-2 h-4 w-4" />
                          View Receipt
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleGenerateConsentContract(res.id)}>
                          <FileText className="mr-2 h-4 w-4" />
                          View Consent Contract
                        </DropdownMenuItem>
                        {res.status === "reserved" ? (
                          <DropdownMenuItem
                            className="text-amber-600 focus:text-amber-600"
                            onClick={() => handleCancelWithUndo(res)}
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            Cancel booking
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            setDeleteConfirmRes(res);
                            setDeleteConfirmText("");
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete booking
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollableTablePane>

      <Dialog
        open={Boolean(viewRes)}
        onOpenChange={(o) => {
          if (!o) {
            setViewRes(null);
            stripBookingParams(["reservation"]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reservation</DialogTitle>
            <DialogDescription>Booking summary (read-only).</DialogDescription>
          </DialogHeader>
          {viewRes ? (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground text-xs">Number</p>
                  <p className="font-mono font-medium">{viewRes.reservationNumber}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <p className="capitalize">{viewRes.status.replace(/_/g, " ")}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Guest</p>
                <p className="font-medium">{viewRes.guestName}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Room</p>
                <p className="font-mono">{viewRes.roomNumber}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground text-xs">Check-in</p>
                  <p>{formatPhDate(viewRes.checkInDate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Check-out</p>
                  <p>{formatPhDate(viewRes.checkOutDate)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground text-xs">Total</p>
                  <p>{peso(viewRes.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Required deposit (50%)</p>
                  <p>{peso(requiredDeposit(viewRes.totalAmount))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Amount paid</p>
                  <p>{peso(viewRes.paidAmount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Remaining balance</p>
                  <p>{peso(remainingBalance(viewRes.totalAmount, viewRes.paidAmount))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Mode of payment</p>
                  <p>{latestPaymentMethod(viewRes.id, payments) || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Payment status</p>
                  <p>{reservationPaymentSummary(viewRes.totalAmount, viewRes.paidAmount).status}</p>
                </div>
              </div>
              {viewRes.notes ? (
                <div>
                  <p className="text-muted-foreground text-xs">Notes</p>
                  <p className="whitespace-pre-wrap rounded-md border bg-muted/30 p-2 text-xs">{viewRes.notes}</p>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewRes(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editRes)} onOpenChange={(o) => !o && setEditRes(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit reservation</DialogTitle>
            <DialogDescription>
              {editRes?.status === "checked_in"
                ? "Only internal notes can be changed while the guest is in-house."
                : "Adjust stay dates and notes. Rates are unchanged."}
            </DialogDescription>
          </DialogHeader>
          {editRes ? (
            <div className="space-y-3 py-1">
              {editRes.status === "reserved" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="er-ci">Check-in</Label>
                    <Input
                      id="er-ci"
                      type="date"
                      value={editResForm.checkInDate}
                      onChange={(e) => setEditResForm((f) => ({ ...f, checkInDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="er-co">Check-out</Label>
                    <Input
                      id="er-co"
                      type="date"
                      value={editResForm.checkOutDate}
                      onChange={(e) => setEditResForm((f) => ({ ...f, checkOutDate: e.target.value }))}
                    />
                  </div>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="er-notes">Notes</Label>
                <Textarea
                  id="er-notes"
                  value={editResForm.notes}
                  onChange={(e) => setEditResForm((f) => ({ ...f, notes: e.target.value }))}
                  className="min-h-[100px]"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRes(null)}>
              Close
            </Button>
            <Button onClick={() => void saveReservationEdit()} disabled={updateReservationMutation.isPending}>
              {updateReservationMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bill Receipt Dialog */}
      <Dialog open={isBillDialogOpen} onOpenChange={setIsBillDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Billing Statement Receipt</DialogTitle>
            <DialogDescription>
              View, print or download the statement receipt for this reservation.
            </DialogDescription>
          </DialogHeader>
          {!generatedBill ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border bg-muted/40 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Guest Name:</span>
                  <span className="font-semibold">{generatedBill.guestName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Room:</span>
                  <span className="font-semibold">{generatedBill.roomNumber} ({generatedBill.roomType})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stay Dates:</span>
                  <span className="font-semibold">{generatedBill.checkInDate} to {generatedBill.checkOutDate}</span>
                </div>
                <div className="border-t my-2 pt-2 flex justify-between">
                  <span>Total Charges:</span>
                  <span className="font-bold">₱{Number(generatedBill.totalAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Paid:</span>
                  <span className="font-bold text-emerald-600">₱{Number(generatedBill.paidAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-black border-t border-dashed pt-2">
                  <span>Balance Due:</span>
                  <span className={Number(generatedBill.balance) > 0 ? "text-rose-600" : "text-emerald-600"}>
                    ₱{Number(generatedBill.balance).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setIsBillDialogOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={printBill} disabled={!generatedBill}>
              Print Bill
            </Button>
            <Button type="button" onClick={downloadBill} disabled={!generatedBill}>
              Download Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consent Contract Dialog */}
      <Dialog open={isConsentDialogOpen} onOpenChange={setIsConsentDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Consent Contract</DialogTitle>
            <DialogDescription>
              Review fields before printing or downloading for physical signature.
            </DialogDescription>
          </DialogHeader>
          {!consentForm ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Guest Name</Label>
                    <Input
                      value={consentForm.guestName ?? ""}
                      onChange={(e) => setConsentForm((prev: any) => ({ ...prev, guestName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone</Label>
                    <Input
                      value={consentForm.phone ?? ""}
                      onChange={(e) => setConsentForm((prev: any) => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input
                      value={consentForm.email ?? ""}
                      onChange={(e) => setConsentForm((prev: any) => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Nationality</Label>
                    <Input
                      value={consentForm.nationality ?? ""}
                      onChange={(e) => setConsentForm((prev: any) => ({ ...prev, nationality: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>ID Type</Label>
                    <Input
                      value={consentForm.idType ?? ""}
                      onChange={(e) => setConsentForm((prev: any) => ({ ...prev, idType: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>ID Number</Label>
                    <Input
                      value={consentForm.idNumber ?? ""}
                      onChange={(e) => setConsentForm((prev: any) => ({ ...prev, idNumber: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Room Number</Label>
                    <Input
                      value={consentForm.roomNumber ?? ""}
                      onChange={(e) => setConsentForm((prev: any) => ({ ...prev, roomNumber: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Room Type</Label>
                    <Input
                      value={consentForm.roomType ?? ""}
                      onChange={(e) => setConsentForm((prev: any) => ({ ...prev, roomType: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Additional Notes</Label>
                  <textarea
                    className="w-full min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={consentForm.notes ?? ""}
                    onChange={(e) => setConsentForm((prev: any) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="rounded-md border border-border p-5 bg-background text-sm space-y-4 max-h-[70vh] overflow-y-auto">
                <h4 className="font-semibold text-center border-b pb-2">Contract Preview</h4>
                <div className="text-center space-y-1">
                  <div className="font-bold text-lg uppercase">{consentForm.hotelName}</div>
                  <div className="text-[10px] text-muted-foreground">{formatAddressContact(consentForm.hotelAddress, consentForm.hotelContactNumber)}</div>
                  <div className="font-bold text-base mt-2">Guest Consent Contract</div>
                  <div className="text-[10px] text-muted-foreground">Reservation #: {consentForm.reservationNumber}</div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Guest Details</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex gap-2"><span className="font-semibold">Name:</span> <span>{consentForm.guestName}</span></div>
                    <div className="flex gap-2"><span className="font-semibold">Phone:</span> <span>{consentForm.phone || "-"}</span></div>
                    <div className="flex gap-2"><span className="font-semibold">Email:</span> <span>{consentForm.email || "-"}</span></div>
                    <div className="flex gap-2"><span className="font-semibold">Nationality:</span> <span>{consentForm.nationality || "-"}</span></div>
                    <div className="flex gap-2 col-span-2">
                      <span className="font-semibold">ID Type:</span>{" "}
                      <span>{consentIdType(consentForm)}</span>
                    </div>
                    <div className="flex gap-2 col-span-2">
                      <span className="font-semibold">ID Number:</span>{" "}
                      <span>{String(consentForm.idNumber ?? consentForm.id_number ?? "").trim() || "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Booking Details</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex gap-2"><span className="font-semibold">Room:</span> <span>{consentForm.roomNumber} ({consentForm.roomType})</span></div>
                    <div className="flex gap-2"><span className="font-semibold">Rate:</span> <span>P{Number(consentForm.roomRate || 0).toFixed(2)}</span></div>
                    <div className="flex gap-2"><span className="font-semibold">Check-in:</span> <span>{consentForm.checkInDate}</span></div>
                    <div className="flex gap-2"><span className="font-semibold">Check-out:</span> <span>{consentForm.checkOutDate}</span></div>
                  </div>
                </div>

                {(() => {
                  const pay = reservationPaymentSummary(
                    Number(consentForm.totalAmount) || 0,
                    Number(consentForm.paidAmount) || 0,
                    consentForm.paymentMethod,
                  );
                  return (
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Payment Details</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div className="flex gap-2"><span className="font-semibold">Total:</span> <span>{peso(pay.total)}</span></div>
                        <div className="flex gap-2"><span className="font-semibold">Required deposit (50%):</span> <span>{peso(pay.deposit)}</span></div>
                        <div className="flex gap-2"><span className="font-semibold">Amount paid:</span> <span>{peso(pay.paid)}</span></div>
                        <div className="flex gap-2"><span className="font-semibold">Remaining balance:</span> <span>{peso(pay.balance)}</span></div>
                        <div className="flex gap-2"><span className="font-semibold">Mode of payment:</span> <span>{pay.method}</span></div>
                        <div className="flex gap-2"><span className="font-semibold">Payment status:</span> <span>{pay.status}</span></div>
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Consent</div>
                  <ul className="list-disc pl-4 text-[11px] space-y-1 text-justify">
                    <li>I confirm that all information provided is true and correct.</li>
                    <li>I agree to comply with hostel rules, policies, and applicable charges.</li>
                  </ul>
                </div>

                <div className="pt-4 flex justify-between items-end">
                   <div className="text-center w-40">
                     <div className="border-b border-foreground h-8" />
                     <div className="text-[9px] mt-1 uppercase text-muted-foreground">Guest Signature</div>
                   </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={downloadConsentContract} disabled={!consentForm}>
              Download
            </Button>
            <Button type="button" onClick={printConsentContract} disabled={!consentForm}>
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Reservation Confirm Dialog */}
      <Dialog open={Boolean(deleteConfirmRes)} onOpenChange={(o) => !o && setDeleteConfirmRes(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Delete Reservation?
            </DialogTitle>
            <DialogDescription>
              This is a permanent action and cannot be undone. Associated payments and logs will be deleted, and the assigned room will be freed up if currently occupied or reserved.
            </DialogDescription>
          </DialogHeader>

          {deleteConfirmRes && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border bg-muted/40 p-4 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reservation Number:</span>
                  <span className="font-mono font-bold">{deleteConfirmRes.reservationNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Guest Name:</span>
                  <span className="font-semibold">{deleteConfirmRes.guestName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Room Number:</span>
                  <span className="font-semibold">{deleteConfirmRes.roomNumber}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  To confirm, type <span className="font-mono font-bold text-foreground selection:bg-primary/20">{deleteConfirmRes.reservationNumber}</span> below:
                </Label>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type reservation number"
                  className="font-mono"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirmRes(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteReservation}
              disabled={!deleteOk || deleteReservationMutation.isPending}
            >
              {deleteReservationMutation.isPending ? "Deleting..." : "Permanently Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
