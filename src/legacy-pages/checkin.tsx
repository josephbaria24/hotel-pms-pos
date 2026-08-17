import {
  useListReservations,
  useListRooms,
  useCheckIn,
  useCheckOut,
  useCancelReservation,
  useUpdateReservation,
  useGetReservationContractData,
  useGetReservationBillData,
  getListReservationsQueryKey,
  getListRoomsQueryKey,
  useGetSettings,
  type Reservation,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format, startOfMonth } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  Loader2,
  CircleX,
  LogIn,
  LogOut,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Ban,
  CalendarPlus,
  ArrowRightLeft,
  CalendarDays,
  CalendarRange,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useMemo, useState, useRef } from "react";
import { toast as sonnerToast } from "sonner";
import { sileo } from "sileo";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import { formatPhDate, formatPhDateTime, formatPhTime } from "@/lib/datetime";
import { ScrollableTablePane } from "@/components/layout/ScrollableTablePane";
import { cn } from "@/lib/utils";
import { countStaySummary, downloadStaySummaryPdf } from "@/lib/stays-summary-pdf";

/* ───────── UI Helpers matching Dashboard style ───────── */

const AVATAR_PALETTE = [
  "bg-rose-500/85 text-white",
  "bg-amber-500/85 text-white",
  "bg-emerald-500/85 text-white",
  "bg-sky-500/85 text-white",
  "bg-violet-500/85 text-white",
  "bg-fuchsia-500/85 text-white",
  "bg-teal-500/85 text-white",
  "bg-indigo-500/85 text-white",
];

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]!;
}

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "?"
  );
}

function GuestAvatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full text-xs font-semibold ring-2 ring-card shrink-0",
        avatarColor(name),
      )}
      style={{ width: size, height: size }}
      title={name}
    >
      {getInitials(name)}
    </span>
  );
}

function InnerCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-card p-3 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

type CheckInOutProps = {
  /** When true, hide the page title block (used inside Guests hub). */
  embedded?: boolean;
};

function formatRoomStatusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export default function CheckInOut({ embedded }: CheckInOutProps) {
  const { data: reservations, isLoading } = useListReservations();
  const { data: rooms = [] } = useListRooms();
  const { data: settings } = useGetSettings();
  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();
  const contractMutation = useGetReservationContractData();
  const billMutation = useGetReservationBillData();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const cancelReservationMutation = useCancelReservation();
  const updateReservationMutation = useUpdateReservation();
  const [arrivalsSearch, setArrivalsSearch] = useState("");
  const [departuresSearch, setDeparturesSearch] = useState("");
  const [viewRes, setViewRes] = useState<Reservation | null>(null);
  const [editRes, setEditRes] = useState<Reservation | null>(null);
  const [editResForm, setEditResForm] = useState({ checkInDate: "", checkOutDate: "", notes: "" });
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);
  const [isCheckOutDialogOpen, setIsCheckOutDialogOpen] = useState(false);
  /** Expected Arrivals: second-step cancel confirmation (type "confirm"). */
  const [arrivalCancelPromptRes, setArrivalCancelPromptRes] = useState<Reservation | null>(null);
  const [arrivalCancelConfirmWord, setArrivalCancelConfirmWord] = useState("");
  const [transferRes, setTransferRes] = useState<Reservation | null>(null);
  const [transferRoomId, setTransferRoomId] = useState("");
  const cancelTimeouts = useRef<Record<string, any>>({});

  const [targetReservationId, setTargetReservationId] = useState<string | null>(null);
  const [checkInMode, setCheckInMode] = useState<"now" | "custom">("now");
  const [checkOutMode, setCheckOutMode] = useState<"now" | "custom">("now");
  const [customDateTime, setCustomDateTime] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localTime = new Date(now.getTime() - offset * 60000);
    return localTime.toISOString().slice(0, 16);
  });
  const [customCheckOutDateTime, setCustomCheckOutDateTime] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localTime = new Date(now.getTime() - offset * 60000);
    return localTime.toISOString().slice(0, 16);
  });
  const [generatedBill, setGeneratedBill] = useState<any | null>(null);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<"cash" | "card" | "bank" | "e-wallet" | "others">("cash");
  const [billQrDataUrl, setBillQrDataUrl] = useState<string>("");
  const [isConsentDialogOpen, setIsConsentDialogOpen] = useState(false);
  const [consentForm, setConsentForm] = useState<any | null>(null);

  const targetReservation = useMemo(
    () => reservations?.find((r) => r.id === targetReservationId) ?? null,
    [reservations, targetReservationId],
  );

  useEffect(() => {
    if (!editRes) return;
    setEditResForm({
      checkInDate: editRes.checkInDate.slice(0, 10),
      checkOutDate: editRes.checkOutDate.slice(0, 10),
      notes: editRes.notes ?? "",
    });
  }, [editRes]);

  useEffect(() => {
    if (!arrivalCancelPromptRes) setArrivalCancelConfirmWord("");
  }, [arrivalCancelPromptRes]);

  const [transferRoomFilter, setTransferRoomFilter] = useState("");

  useEffect(() => {
    if (!transferRes) {
      setTransferRoomId("");
      setTransferRoomFilter("");
    }
  }, [transferRes]);

  const transferRoomChoices = useMemo(() => {
    if (!transferRes) return [];
    const currentId =
      (transferRes.roomId && transferRes.roomId.trim()) ||
      rooms.find((r) => r.roomNumber === transferRes.roomNumber)?.id ||
      "";
    return rooms.filter((r) => r.status === "available" && r.id !== currentId);
  }, [rooms, transferRes]);

  const transferRoomChoicesFiltered = useMemo(() => {
    const q = transferRoomFilter.trim().toLowerCase();
    if (!q) return transferRoomChoices;
    return transferRoomChoices.filter((r) => {
      const statusHay = `${r.status} ${formatRoomStatusLabel(r.status)}`.toLowerCase();
      const slotsHay = `${r.capacity} slot`.toLowerCase();
      return (
        r.roomNumber.toLowerCase().includes(q) ||
        (r.type || "").toLowerCase().includes(q) ||
        statusHay.includes(q) ||
        slotsHay.includes(q) ||
        String(r.capacity).includes(q)
      );
    });
  }, [transferRoomChoices, transferRoomFilter]);

  const arrivalCancelWordOk = arrivalCancelConfirmWord.trim().toLowerCase() === "confirm";

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
    if (cancelTimeouts.current[res.id]) {
      clearTimeout(cancelTimeouts.current[res.id]);
    }

    sonnerToast(`Cancelling reservation ${res.reservationNumber}`, {
      description: "Action will proceed in 3 seconds.",
      action: {
        label: "Undo",
        onClick: () => {
          if (cancelTimeouts.current[res.id]) {
            clearTimeout(cancelTimeouts.current[res.id]);
            delete cancelTimeouts.current[res.id];
            sonnerToast.success("Cancellation undone.", {
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

  const submitRoomTransfer = async () => {
    if (!transferRes || !transferRoomId.trim()) return;
    await sileo.promise(
      (async () => {
        await updateReservationMutation.mutateAsync({
          id: transferRes.id,
          roomId: transferRoomId.trim(),
        });
        await queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
        setTransferRes(null);
        setTransferRoomId("");
      })(),
      {
        loading: {
          title: "Transferring guest",
          description: "Updating reservation and room status…",
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
        },
        success: {
          title: "Room transfer complete",
          description: "The guest is now assigned to the selected room.",
          icon: <ArrowRightLeft className="h-4 w-4" />,
        },
        error: (error) => ({
          title: "Transfer failed",
          description: error instanceof Error ? error.message : "Please try again.",
          icon: <CircleX className="h-4 w-4" />,
        }),
      },
    );
  };

  const handleCheckIn = async (id: string, checkInAt?: string) => {
    await sileo.promise(
      checkInMutation.mutateAsync({ id, checkInAt }).then(async (result) => {
        await queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
        return result;
      }),
      {
        loading: {
          title: "Checking in guest",
          description: "Recording arrival and room occupancy...",
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
        },
        success: {
          title: "Check-in successful",
          description: "Guest is now checked in.",
          icon: <LogIn className="h-4 w-4" />,
        },
        error: () => ({
          title: "Failed to check in",
          description: "Please try again.",
          icon: <CircleX className="h-4 w-4" />,
        }),
      },
    );
  };

  const handleCheckOut = async (id: string, checkOutAt?: string, paymentMethod?: string) => {
    await sileo.promise(
      checkOutMutation.mutateAsync({ id, checkOutAt, paymentMethod }).then(async (result) => {
        await queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
        return result;
      }),
      {
        loading: {
          title: "Checking out guest",
          description: "Finalizing departure and room status...",
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
        },
        success: {
          title: "Check-out successful",
          description: "Guest is now checked out.",
          icon: <LogOut className="h-4 w-4" />,
        },
        error: () => ({
          title: "Failed to check out",
          description: "Please try again.",
          icon: <CircleX className="h-4 w-4" />,
        }),
      },
    );
  };

  const [dateFilterMode, setDateFilterMode] = useState<"all" | "specific">("all");
  const [filterDate, setFilterDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryFrom, setSummaryFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [summaryTo, setSummaryTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [summaryBusy, setSummaryBusy] = useState(false);

  const { arrivals, departures, inHouseCount, upcomingReservedCount } = useMemo(() => {
    const list = reservations ?? [];
    const arrivalsList = list.filter((r) => {
      if (r.status !== "reserved") return false;
      if (dateFilterMode === "specific") {
        return r.checkInDate.slice(0, 10) === filterDate;
      }
      return true;
    });
    const departuresList = list.filter((r) => {
      if (r.status !== "checked_in") return false;
      if (dateFilterMode === "specific") {
        return r.checkOutDate.slice(0, 10) === filterDate;
      }
      return true;
    });
    const inHouse = list.filter((r) => r.status === "checked_in").length;
    const upcoming = list.filter((r) => r.status === "reserved").length;
    return {
      arrivals: arrivalsList,
      departures: departuresList,
      inHouseCount: inHouse,
      upcomingReservedCount: upcoming,
    };
  }, [reservations, dateFilterMode, filterDate]);

  const summaryPreview = useMemo(() => {
    if (!summaryFrom || !summaryTo || summaryFrom > summaryTo) {
      return { reservations: 0, checkIns: 0, checkOuts: 0, occupiedRooms: 0 };
    }
    return countStaySummary(reservations ?? [], summaryFrom, summaryTo);
  }, [reservations, summaryFrom, summaryTo]);

  const openStaySummaryDialog = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    if (dateFilterMode === "specific") {
      setSummaryFrom(filterDate);
      setSummaryTo(filterDate);
    } else {
      setSummaryFrom(format(startOfMonth(new Date()), "yyyy-MM-dd"));
      setSummaryTo(today);
    }
    setSummaryOpen(true);
  };

  const handleDownloadStaySummary = () => {
    if (!summaryFrom || !summaryTo) {
      toast({
        title: "Choose both dates",
        description: "Pick a from and to date for the summary.",
        variant: "destructive",
      });
      return;
    }
    if (summaryFrom > summaryTo) {
      toast({
        title: "Invalid date range",
        description: "The from date must be on or before the to date.",
        variant: "destructive",
      });
      return;
    }
    setSummaryBusy(true);
    try {
      downloadStaySummaryPdf({
        hotel: {
          hotelName: settings?.hotelName || "PalawanSU Hotel",
          address: settings?.address,
          contactNumber: settings?.contactNumber,
          email: settings?.email,
        },
        from: summaryFrom,
        to: summaryTo,
        reservations: reservations ?? [],
        rooms,
      });
      toast({
        title: "Summary downloaded",
        description: `PDF saved for ${formatPhDate(summaryFrom)} – ${formatPhDate(summaryTo)}.`,
      });
      setSummaryOpen(false);
    } catch (error) {
      toast({
        title: "Could not create PDF",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSummaryBusy(false);
    }
  };

  const matchesStaysSearch = (res: Reservation, q: string) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      res.guestName.toLowerCase().includes(s) ||
      String(res.roomNumber).toLowerCase().includes(s) ||
      res.reservationNumber.toLowerCase().includes(s)
    );
  };

  const arrivalsFiltered = useMemo(
    () => arrivals.filter((r) => matchesStaysSearch(r, arrivalsSearch)),
    [arrivals, arrivalsSearch],
  );

  const departuresFiltered = useMemo(
    () => departures.filter((r) => matchesStaysSearch(r, departuresSearch)),
    [departures, departuresSearch],
  );

  const openCheckInDialog = (id: string) => {
    setTargetReservationId(id);
    setCheckInMode("now");
    setIsCheckInDialogOpen(true);
  };

  const openCheckOutDialog = (id: string) => {
    setTargetReservationId(id);
    setCheckOutMode("now");
    setCheckoutPaymentMethod("cash");
    setGeneratedBill(null);
    setIsCheckOutDialogOpen(true);
  };

  const confirmCheckIn = async () => {
    if (!targetReservationId) return;
    const checkInAt =
      checkInMode === "custom" && customDateTime
        ? new Date(customDateTime).toISOString()
        : new Date().toISOString();
    await handleCheckIn(targetReservationId, checkInAt);
    setIsCheckInDialogOpen(false);
    setTargetReservationId(null);
  };

  const confirmCheckOut = async () => {
    if (!targetReservationId) return;
    const checkOutAt =
      checkOutMode === "custom" && customCheckOutDateTime
        ? new Date(customCheckOutDateTime).toISOString()
        : new Date().toISOString();
    await handleCheckOut(targetReservationId, checkOutAt, checkoutPaymentMethod);
    setIsCheckOutDialogOpen(false);
    setTargetReservationId(null);
    setGeneratedBill(null);
  };

  const getCurrencySymbol = (currency: string) => (currency?.toLowerCase() === "peso" ? "₱" : "$");
  const formatAddressContact = (address?: string, contact?: string) => {
    const parts = [address?.trim(), contact?.trim()].filter(Boolean);
    return parts.length > 0 ? parts.join(" | ") : "-";
  };

  const buildBillHtml = (data: any, qrDataUrl?: string, activePaymentMethod?: string) => {
    const currency = getCurrencySymbol(data.currency);
    const balance = Number(data.balance);
    const hasSettlePayment = balance > 0 && activePaymentMethod;
    const totalPaid = Number(data.paidAmount) + (hasSettlePayment ? balance : 0);
    const finalBalance = balance - (hasSettlePayment ? balance : 0);

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
            margin-top: 1px; /* Optical adjustment */
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

          ${
            hasSettlePayment
              ? `
              <div class="item" style="border-left: 2px solid #10b981; padding-left: 6px;">
                <div>
                  <div class="name">Settlement - ${activePaymentMethod.toUpperCase()}</div>
                  <div class="desc">${formatPhDate(new Date().toISOString())} (Check-out)</div>
                </div>
                <div class="amt">-${currency}${Number(balance).toFixed(2)}</div>
              </div>
              `
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
    // Use an iframe instead of window.open() to avoid popup blockers.
    // Keep it offscreen (not display:none) so Chromium can still render/print.
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
        toast({
          title: "Print failed",
          description: "Could not create print document.",
          variant: "destructive",
        });
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
    
    // Wrap in a div with explicit padding to ensure margins in the captured image
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

  const generateBill = async () => {
    if (!targetReservationId) return;
    try {
      const data = await billMutation.mutateAsync({ id: targetReservationId });
      setGeneratedBill(data);
      const qrPayload = [
        `Reservation: ${data.reservationNumber}`,
        `Guest: ${data.guestName}`,
        `Room: ${data.roomNumber} (${data.roomType})`,
        `Stay: ${data.checkInDate} to ${data.checkOutDate}`,
        `Balance: ${getCurrencySymbol(data.currency)}${Number(data.balance).toFixed(2)}`,
      ].join("\n");
      const qr = await QRCode.toDataURL(qrPayload, {
        width: 256,
        margin: 1,
        color: { dark: "#111111", light: "#FFFFFF" },
      });
      setBillQrDataUrl(qr);
    } catch (error) {
      toast({
        title: "Failed to generate bill",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const printBill = () => {
    if (!generatedBill) return;
    const html = buildBillHtml(generatedBill, billQrDataUrl, checkoutPaymentMethod);
    printHtml(html);
  };

  const downloadBill = async () => {
    if (!generatedBill) return;

    const receiptW = 360;
    const receiptH = 740;

    const fullHtml = buildBillHtml(generatedBill, billQrDataUrl, checkoutPaymentMethod);
    const parsed = new DOMParser().parseFromString(fullHtml, "text/html");
    const styleEl = parsed.querySelector("style");
    const receiptEl = parsed.querySelector(".receipt");

    if (!receiptEl) {
      toast({
        title: "Download failed",
        description: "Could not build receipt preview for PDF.",
        variant: "destructive",
      });
      return;
    }

    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-10000px";
    container.style.top = "0";
    container.style.width = `${receiptW}px`;
    container.style.height = `${receiptH}px`;

    const cssText = styleEl?.textContent ?? "";
    container.innerHTML = `
      <style>
        ${cssText}
        .pdf-root {
          width: ${receiptW}px;
          height: ${receiptH}px;
          background: #f3f4f6;
          padding: 0;
          margin: 0;
          box-sizing: border-box;
        }
        .pdf-root .receipt {
          margin: 0 auto;
        }
      </style>
      <div class="pdf-root">
        ${receiptEl.outerHTML}
      </div>
    `;

    document.body.appendChild(container);

    try {
      const nodeToRender = container.querySelector(".pdf-root") as HTMLElement | null;
      if (!nodeToRender) throw new Error("Receipt node missing");

      const canvas = await html2canvas(nodeToRender, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#f3f4f6",
        width: receiptW,
        height: receiptH,
      });

      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `bill-${generatedBill.reservationNumber}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      toast({
        title: "Download failed",
        description: e instanceof Error ? e.message : "Could not generate bill image.",
        variant: "destructive",
      });
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

          <div class="section">
            <div class="section-title">Consent & Undertaking</div>
            <div class="box">
              <ul class="consent-list">
                <li>I confirm that all information provided is true and correct.</li>
                <li>I agree to comply with hotel rules, policies, and applicable charges.</li>
                <li>I authorize the hotel to process my personal information for booking and compliance purposes in accordance with data privacy laws.</li>
                <li>I understand that any damages or losses to hotel property caused by me or my guests may be charged to my account based on hotel policy.</li>
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
            <div>Generated on: ${formatPhDate(new Date())} at ${formatPhTime(new Date())}</div>
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
      toast({ title: "Consent contract ready", description: "Review, edit, then print or download." });
    } catch (error) {
      toast({
        title: "Failed to generate contract",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
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

  return (
    <div className={embedded ? "space-y-4" : "space-y-6"}>
      {!embedded ? (
        <div className="px-2 pt-2">
          <h1 className="text-3xl font-bold tracking-tight">Hostel Check In / Out</h1>
          <p className="text-muted-foreground">Manage resident arrivals and departures.</p>
        </div>
      ) : null}

      {/* Date Filter & View Controls Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-full border max-w-xs sm:max-w-none">
            <button
              type="button"
              onClick={() => setDateFilterMode("all")}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide transition-all outline-none",
                dateFilterMode === "all"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-foreground hover:bg-muted/80",
              )}
            >
              All Stays
            </button>
            <button
              type="button"
              onClick={() => setDateFilterMode("specific")}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide transition-all outline-none",
                dateFilterMode === "specific"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-foreground hover:bg-muted/80",
              )}
            >
              Filter by Date
            </button>
          </div>

          {dateFilterMode === "specific" && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
              <span className="text-xs font-medium text-muted-foreground">Select date:</span>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="h-9 w-[150px] rounded-full border bg-card text-xs shadow-sm cursor-pointer"
              />
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openStaySummaryDialog}
          className="h-9 shrink-0 self-start rounded-full px-4 text-xs font-semibold sm:self-auto"
        >
          <Download className="h-3.5 w-3.5" />
          Download Summary
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card px-3 py-2.5 shadow-sm">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {dateFilterMode === "specific" ? "Check-Ins (Date)" : "Check-Ins (Total)"}
          </p>
          <p className="text-2xl font-bold text-emerald-700 tabular-nums mt-0.5">{arrivals.length}</p>
        </div>
        <div className="rounded-xl border bg-card px-3 py-2.5 shadow-sm">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {dateFilterMode === "specific" ? "Check-Outs (Date)" : "Check-Outs (Total)"}
          </p>
          <p className="text-2xl font-bold text-blue-700 tabular-nums mt-0.5">{departures.length}</p>
        </div>
        <div className="rounded-xl border bg-card px-3 py-2.5 shadow-sm">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">In-house</p>
          <p className="text-2xl font-bold tabular-nums mt-0.5">{inHouseCount}</p>
        </div>
        <div className="rounded-xl border bg-card px-3 py-2.5 shadow-sm">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Dorm Reserved</p>
          <p className="text-2xl font-bold text-amber-700 tabular-nums mt-0.5">{upcomingReservedCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InnerCard className="bg-card">
          <div className="space-y-3 p-1">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold text-base sm:text-lg">
                <ArrowDownRight className="w-5 h-5 shrink-0" />
                Hostel Check-Ins
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {arrivalsSearch.trim()
                  ? `Showing ${arrivalsFiltered.length} of ${arrivals.length}`
                  : `${arrivals.length} expected`}
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter check-ins by resident, room, or #…"
                value={arrivalsSearch}
                onChange={(e) => setArrivalsSearch(e.target.value)}
                className="h-9 bg-background pl-9 text-xs"
                aria-label="Filter expected check-ins"
              />
            </div>

            <ScrollableTablePane frameless minVh={28} offsetRem={15} className="px-1 pt-2">
              <div className="space-y-3">
                {isLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : arrivals.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No expected check-ins found.</p>
                ) : arrivalsFiltered.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No check-ins match filter.</p>
                ) : (
                  arrivalsFiltered.map((res) => (
                    <div
                      key={res.id}
                      className="flex flex-col gap-3 p-3 border rounded-xl bg-background hover:bg-muted/10 transition-colors sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <GuestAvatar name={res.guestName} size={36} />
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{res.guestName}</div>
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{res.reservationNumber}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1 flex-wrap">
                            <Badge variant="outline" className="font-mono text-[10px] h-5 px-1.5">
                              Room {res.roomNumber}
                            </Badge>
                            <span className="text-[11px]">
                              In: {formatPhDate(res.checkInDate)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => openCheckInDialog(res.id)}
                          disabled={checkInMutation.isPending}
                          className="h-8 rounded-md bg-emerald-600 px-3 text-xs hover:bg-emerald-700"
                        >
                          Check In
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={() => handleGenerateConsentContract(res.id)}
                          disabled={contractMutation.isPending}
                          className="h-8 rounded-md px-3 text-xs"
                        >
                          <FileText className="w-3.5 h-3.5 mr-1.5" />
                          {contractMutation.isPending ? "Preparing..." : "Contract"}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" aria-label="More actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewRes(res)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setEditRes(res)}
                              disabled={res.status !== "reserved" && res.status !== "checked_in"}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            {res.status === "reserved" ? (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setArrivalCancelPromptRes(res)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Cancel booking
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollableTablePane>
          </div>
        </InnerCard>

        <InnerCard className="bg-card">
          <div className="space-y-3 p-1">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-blue-700 font-semibold text-base sm:text-lg">
                <ArrowUpRight className="w-5 h-5 shrink-0" />
                Hostel Check-Outs
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {departuresSearch.trim()
                  ? `Showing ${departuresFiltered.length} of ${departures.length}`
                  : `${departures.length} expected`}
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter check-outs by resident, room, or #…"
                value={departuresSearch}
                onChange={(e) => setDeparturesSearch(e.target.value)}
                className="h-9 bg-background pl-9 text-xs"
                aria-label="Filter expected check-outs"
              />
            </div>

            <ScrollableTablePane frameless minVh={28} offsetRem={15} className="px-1 pt-2">
              <div className="space-y-3">
                {isLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : departures.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No expected check-outs found.</p>
                ) : departuresFiltered.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No check-outs match filter.</p>
                ) : (
                  departuresFiltered.map((res) => (
                    <div
                      key={res.id}
                      className="flex flex-col gap-3 p-3 border rounded-xl bg-background hover:bg-muted/10 transition-colors sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <GuestAvatar name={res.guestName} size={36} />
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{res.guestName}</div>
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{res.reservationNumber}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1 flex-wrap">
                            <Badge variant="outline" className="font-mono text-[10px] h-5 px-1.5">
                              Room {res.roomNumber}
                            </Badge>
                            <span className="text-[11px]">
                              Out: {formatPhDate(res.checkOutDate)}
                            </span>
                            {res.balance > 0 && (
                              <span className="text-destructive font-medium border border-destructive/20 bg-destructive/10 px-1 rounded ml-1 text-[10px]">
                                Bal: ₱{res.balance.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => openCheckOutDialog(res.id)}
                          disabled={checkOutMutation.isPending}
                          className="h-8 border-blue-200 text-blue-700 hover:bg-blue-50 px-3 text-xs"
                        >
                          Check Out
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" aria-label="More actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewRes(res)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setEditRes(res)}
                              disabled={res.status !== "reserved" && res.status !== "checked_in"}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            {res.status === "checked_in" ? (
                              <DropdownMenuItem onClick={() => setTransferRes(res)}>
                                <ArrowRightLeft className="mr-2 h-4 w-4" />
                                Transfer room
                              </DropdownMenuItem>
                            ) : null}
                            {res.status === "reserved" ? (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleCancelWithUndo(res)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Cancel booking
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollableTablePane>
          </div>
        </InnerCard>
      </div>

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Download stay summary</DialogTitle>
            <DialogDescription>
              Choose a from and to date. The PDF lists reservations, check-ins, check-outs, and guests in each room for that range.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="stay-summary-from">From</Label>
                <Input
                  id="stay-summary-from"
                  type="date"
                  value={summaryFrom}
                  max={summaryTo || undefined}
                  onChange={(e) => setSummaryFrom(e.target.value)}
                  className="h-9 cursor-pointer"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stay-summary-to">To</Label>
                <Input
                  id="stay-summary-to"
                  type="date"
                  value={summaryTo}
                  min={summaryFrom || undefined}
                  onChange={(e) => setSummaryTo(e.target.value)}
                  className="h-9 cursor-pointer"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border bg-muted/30 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Reservations</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums">{summaryPreview.reservations}</p>
              </div>
              <div className="rounded-xl border bg-muted/30 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Check-ins</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-700">{summaryPreview.checkIns}</p>
              </div>
              <div className="rounded-xl border bg-muted/30 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Check-outs</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-blue-700">{summaryPreview.checkOuts}</p>
              </div>
              <div className="rounded-xl border bg-muted/30 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Rooms</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-700">{summaryPreview.occupiedRooms}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSummaryOpen(false)} disabled={summaryBusy}>
              Cancel
            </Button>
            <Button type="button" onClick={handleDownloadStaySummary} disabled={summaryBusy}>
              {summaryBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {summaryBusy ? "Preparing…" : "Download PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(transferRes)}
        onOpenChange={(o) => {
          if (!o) setTransferRes(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Transfer to another room</DialogTitle>
            <DialogDescription>
              Move this in-house guest from room{" "}
              <span className="font-mono font-medium text-foreground">{transferRes?.roomNumber}</span> to an
              available room. Rates on the booking are unchanged.
            </DialogDescription>
          </DialogHeader>
          {transferRes ? (
            <div className="space-y-3 py-1">
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <p className="font-medium">{transferRes.guestName}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{transferRes.reservationNumber}</p>
              </div>
              <div className="space-y-2">
                <Label>Destination room</Label>
                {transferRoomChoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No other available rooms right now. Free a room or finish check-out elsewhere, then try again.
                  </p>
                ) : (
                  <div className="rounded-lg border bg-card overflow-hidden">
                    {/* Sticky search */}
                    <div className="sticky top-0 z-[1] bg-card border-b px-2 py-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Filter rooms…"
                          value={transferRoomFilter}
                          onChange={(e) => setTransferRoomFilter(e.target.value)}
                          className="h-8 bg-background pl-8 text-xs"
                        />
                      </div>
                    </div>
                    {/* Scrollable room list */}
                    <div className="max-h-[220px] overflow-y-auto divide-y">
                      {transferRoomChoicesFiltered.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No rooms match your filter.</p>
                      ) : (
                        transferRoomChoicesFiltered.map((room) => (
                          <button
                            key={room.id}
                            type="button"
                            onClick={() => setTransferRoomId(room.id)}
                            className={`w-full flex items-start justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50 ${
                              transferRoomId === room.id
                                ? "bg-primary/10 ring-1 ring-inset ring-primary/30"
                                : ""
                            }`}
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div>
                                <span className="font-mono font-medium">{room.roomNumber}</span>
                                <span className="text-muted-foreground ml-1.5 capitalize">{room.type}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal capitalize">
                                  {formatRoomStatusLabel(room.status)}
                                </Badge>
                                <span className="tabular-nums">
                                  {room.capacity} guest slot{room.capacity === 1 ? "" : "s"}
                                </span>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0 tabular-nums pt-0.5">
                              ₱{room.pricePerNight.toLocaleString()}/night
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTransferRes(null)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={() => void submitRoomTransfer()}
              disabled={
                !transferRoomId.trim() ||
                transferRoomChoices.length === 0 ||
                updateReservationMutation.isPending
              }
            >
              {updateReservationMutation.isPending ? "Transferring…" : "Confirm transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewRes)} onOpenChange={(o) => !o && setViewRes(null)}>
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
                  <p>₱{viewRes.totalAmount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Balance</p>
                  <p>₱{viewRes.balance.toFixed(2)}</p>
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
                    <Label htmlFor="stays-er-ci">Check-in</Label>
                    <Input
                      id="stays-er-ci"
                      type="date"
                      value={editResForm.checkInDate}
                      onChange={(e) => setEditResForm((f) => ({ ...f, checkInDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stays-er-co">Check-out</Label>
                    <Input
                      id="stays-er-co"
                      type="date"
                      value={editResForm.checkOutDate}
                      onChange={(e) => setEditResForm((f) => ({ ...f, checkOutDate: e.target.value }))}
                    />
                  </div>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="stays-er-notes">Notes</Label>
                <Textarea
                  id="stays-er-notes"
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

      <AlertDialog
        open={Boolean(arrivalCancelPromptRes)}
        onOpenChange={(open) => {
          if (!open) setArrivalCancelPromptRes(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this arrival booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This starts the cancellation flow for{" "}
              <span className="font-mono font-semibold text-foreground">
                {arrivalCancelPromptRes?.reservationNumber}
              </span>
              . Type <span className="font-mono font-semibold text-foreground">confirm</span> below to
              continue. You will still have a few seconds to undo afterward.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={arrivalCancelConfirmWord}
            onChange={(e) => setArrivalCancelConfirmWord(e.target.value)}
            placeholder="confirm"
            className="font-mono"
            autoComplete="off"
            aria-label="Type confirm to proceed with cancellation"
          />
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Back</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!arrivalCancelWordOk || cancelReservationMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                const r = arrivalCancelPromptRes;
                setArrivalCancelPromptRes(null);
                if (r) handleCancelWithUndo(r);
              }}
            >
              Continue to cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isCheckInDialogOpen} onOpenChange={setIsCheckInDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Check-in Time</DialogTitle>
            <DialogDescription>
              {targetReservation
                ? `Set check-in time for ${targetReservation.guestName} (${targetReservation.roomNumber}).`
                : "Set check-in time."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={checkInMode === "now" ? "default" : "outline"}
                onClick={() => setCheckInMode("now")}
              >
                Now
              </Button>
              <Button
                type="button"
                variant={checkInMode === "custom" ? "default" : "outline"}
                onClick={() => setCheckInMode("custom")}
              >
                Custom
              </Button>
            </div>
            {checkInMode === "custom" && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Date & Time</label>
                <Input
                  type="datetime-local"
                  value={customDateTime}
                  onChange={(e) => setCustomDateTime(e.target.value)}
                />
              </div>
            )}
            {checkInMode === "now" && (
              <p className="text-xs text-muted-foreground">
                Check-in will be recorded at current time: {formatPhDateTime(new Date())}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCheckInDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmCheckIn} disabled={checkInMutation.isPending}>
              {checkInMutation.isPending ? "Saving..." : "Confirm Check-in"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCheckOutDialogOpen} onOpenChange={setIsCheckOutDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Check-out Time</DialogTitle>
            <DialogDescription>
              {targetReservation
                ? `Set check-out time for ${targetReservation.guestName} (${targetReservation.roomNumber}).`
                : "Set check-out time."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={checkOutMode === "now" ? "default" : "outline"}
                onClick={() => setCheckOutMode("now")}
              >
                Now
              </Button>
              <Button
                type="button"
                variant={checkOutMode === "custom" ? "default" : "outline"}
                onClick={() => setCheckOutMode("custom")}
              >
                Custom
              </Button>
            </div>
            {checkOutMode === "custom" && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Date & Time</label>
                <Input
                  type="datetime-local"
                  value={customCheckOutDateTime}
                  onChange={(e) => setCustomCheckOutDateTime(e.target.value)}
                />
              </div>
            )}
            {checkOutMode === "now" && (
              <p className="text-xs text-muted-foreground">
                Check-out will be recorded at current time: {formatPhDateTime(new Date())}
              </p>
            )}

            {/* Outstanding Balance & Payment Method Selector */}
            <div className="pt-2.5 border-t border-border/70 space-y-2">
              <div className="flex items-center justify-between text-xs bg-muted/40 rounded-xl p-2 border">
                <span className="font-semibold text-muted-foreground">Outstanding Balance:</span>
                <span className={cn(
                  "font-bold tabular-nums text-sm",
                  targetReservation && targetReservation.balance > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                )}>
                  ₱{targetReservation ? Number(targetReservation.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                </span>
              </div>

              {targetReservation && targetReservation.balance > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Select Settlement Method
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { value: "cash", label: "Cash", icon: "💵" },
                      { value: "card", label: "Card", icon: "💳" },
                      { value: "bank", label: "Bank", icon: "🏦" },
                      { value: "e-wallet", label: "E-Wallet", icon: "📱" },
                      { value: "others", label: "Others", icon: "⚙️" },
                    ].map((opt) => {
                      const isSelected = checkoutPaymentMethod === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setCheckoutPaymentMethod(opt.value as any)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-xl border p-2 text-left text-xs font-semibold transition-all hover:bg-muted/50 outline-none",
                            opt.value === "others" ? "col-span-2 justify-center" : "",
                            isSelected
                              ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary"
                              : "border-border bg-card text-foreground"
                          )}
                        >
                          <span className="text-sm leading-none">{opt.icon}</span>
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-border/70">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Generate bill statement before final checkout.</p>
                <Button type="button" size="sm" variant="outline" onClick={generateBill} disabled={billMutation.isPending}>
                  {billMutation.isPending ? "Generating..." : "Generate Bill"}
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" className="ml-1.5">
                    <path fill="currentColor" fillRule="evenodd" d="M7.099 1.25H16.9c1.017 0 1.717 0 2.306.204a3.8 3.8 0 0 1 2.348 2.412l-.713.234l.713-.234c.196.597.195 1.307.195 2.36v14.148c0 1.466-1.727 2.338-2.864 1.297a.196.196 0 0 0-.271 0l-.484.442c-.928.85-2.334.85-3.262 0a.907.907 0 0 0-1.238 0c-.928.85-2.334.85-3.262 0a.907.907 0 0 0-1.238 0c-.928.85-2.334.85-3.262 0l-.483-.442a.196.196 0 0 0-.272 0c-1.137 1.04-2.864.169-2.864-1.297V6.227c0-1.054 0-1.764.195-2.361a3.8 3.8 0 0 1 2.348-2.412c.59-.205 1.289-.204 2.306-.204m.146 1.5c-1.221 0-1.642.01-1.96.121A2.3 2.3 0 0 0 3.87 4.334c-.111.338-.12.784-.12 2.036v14.004c0 .12.059.192.134.227a.2.2 0 0 0 .11.018a.2.2 0 0 0 .107-.055a1.695 1.695 0 0 1 2.296 0l.483.442a.907.907 0 0 0 1.238 0a2.407 2.407 0 0 1 3.262 0a.907.907 0 0 0 1.238 0a2.407 2.407 0 0 1 3.262 0a.907.907 0 0 0 1.238 0l.483-.442a1.695 1.695 0 0 1 2.296 0c.043.04.08.052.108.055a.2.2 0 0 0 .109-.018c.075-.035.135-.108.135-.227V6.37c0-1.252-.01-1.698-.12-2.037a2.3 2.3 0 0 0-1.416-1.462c-.317-.11-.738-.12-1.959-.12zM15 7.44a.75.75 0 0 1 .06 1.06l-3.572 4a.75.75 0 0 1-1.119 0l-1.428-1.6a.75.75 0 0 1 1.118-1l.87.974l3.012-3.373A.75.75 0 0 1 15 7.44M6.75 15.5a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 0 1.5h-9a.75.75 0 0 1-.75-.75" clipRule="evenodd" />
                  </svg>
                </Button>
              </div>
              {generatedBill && (
                <div className="mt-2 rounded-md border border-border/70 p-2 text-xs space-y-1">
                  <div className="font-medium">Billing Preview</div>
                  <div className="flex justify-between">
                    <span>Total Charges</span>
                    <span>{getCurrencySymbol(generatedBill.currency)}{Number(generatedBill.totalAmount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Paid</span>
                    <span>{getCurrencySymbol(generatedBill.currency)}{Number(generatedBill.paidAmount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Balance Due</span>
                    <span>{getCurrencySymbol(generatedBill.currency)}{Number(generatedBill.balance).toFixed(2)}</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button type="button" size="sm" variant="outline" onClick={printBill}>Print Bill</Button>
                    <Button type="button" size="sm" variant="outline" onClick={downloadBill}>Download Bill</Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCheckOutDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmCheckOut} disabled={checkOutMutation.isPending}>
              {checkOutMutation.isPending ? "Saving..." : "Confirm Check-out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isConsentDialogOpen} onOpenChange={setIsConsentDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Consent Contract</DialogTitle>
            <DialogDescription>
              Review and edit fields before printing or downloading for physical signature.
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
                      onChange={(e) =>
                        setConsentForm((prev: any) => ({ ...prev, nationality: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>ID Type</Label>
                    <select
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={consentForm.idType ?? "Others"}
                      onChange={(e) => setConsentForm((prev: any) => ({ ...prev, idType: e.target.value }))}
                    >
                      <option value="School ID">School ID</option>
                      <option value="Gov. ID">Gov. ID</option>
                      <option value="Company ID">Company ID</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>ID Number (Optional)</Label>
                    <Input
                      value={consentForm.idNumber ?? ""}
                      onChange={(e) =>
                        setConsentForm((prev: any) => ({ ...prev, idNumber: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Address</Label>
                  <Input
                    value={consentForm.address ?? ""}
                    onChange={(e) => setConsentForm((prev: any) => ({ ...prev, address: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Room Number</Label>
                    <Input
                      value={consentForm.roomNumber ?? ""}
                      onChange={(e) =>
                        setConsentForm((prev: any) => ({ ...prev, roomNumber: e.target.value }))
                      }
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

                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Consent</div>
                  <ul className="list-disc pl-4 text-[11px] space-y-1 text-justify">
                    <li>I confirm that all information provided is true and correct.</li>
                    <li>I agree to comply with hotel rules, policies, and applicable charges.</li>
                  </ul>
                </div>

                <div className="pt-4 flex justify-between items-end">
                   <div className="text-center w-40">
                     <div className="border-b border-foreground h-8" />
                     <div className="text-[9px] mt-1 uppercase text-muted-foreground">Guest Signature</div>
                   </div>
                   <div className="text-[9px] text-muted-foreground">
                     {formatPhDateTime(new Date())}
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
    </div>
  );
}
