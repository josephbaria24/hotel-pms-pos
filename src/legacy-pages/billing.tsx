import { useState, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useSearch } from "wouter";
import {
  useListPayments,
  useCreatePayment,
  useUpdatePayment,
  useDeletePayment,
  useListReservations,
  getListPaymentsQueryKey,
  getListReservationsQueryKey
} from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Plus, Receipt, MoreVertical, Edit, Trash2, Loader2, Printer, X } from "lucide-react";
import { formatPhDateTime } from "@/lib/datetime";
import { ScrollableTablePane } from "@/components/layout/ScrollableTablePane";
import { useAuth } from "@/components/auth/AuthProvider";
import { NumberInput, numberOrZero } from "@/components/ui/number-input";

type PaymentLine = {
  id: string;
  label: string;
  amount: number | "";
};

function newPaymentLine(partial?: Partial<PaymentLine>): PaymentLine {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `line_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    label: partial?.label ?? "",
    amount: partial?.amount ?? "",
  };
}

export default function Billing() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const locationSearch = useSearch();

  const reservationQuery = useMemo(() => {
    const raw = locationSearch.startsWith("?") ? locationSearch.slice(1) : locationSearch;
    return new URLSearchParams(raw).get("reservation");
  }, [locationSearch]);

  const { data: payments, isLoading: isPaymentsLoading } = useListPayments();
  const { data: reservations } = useListReservations();

  const createPaymentMutation = useCreatePayment();
  const updatePaymentMutation = useUpdatePayment();
  const deletePaymentMutation = useDeletePayment();

  // Dialog States
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [selectedResId, setSelectedResId] = useState("");
  const [recordLines, setRecordLines] = useState<PaymentLine[]>(() => [newPaymentLine({ label: "Payment" })]);
  const [recordMethod, setRecordMethod] = useState("cash");
  const [recordRefNo, setRecordRefNo] = useState("");
  const [recordNote, setRecordNote] = useState("");

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editPaymentId, setEditPaymentId] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editMethod, setEditMethod] = useState("cash");
  const [editRefNo, setEditRefNo] = useState("");
  const [editNote, setEditNote] = useState("");

  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [activePayment, setActivePayment] = useState<any>(null);

  // Autofill amount when selecting reservation in Record Payment form
  useEffect(() => {
    if (selectedResId && reservations) {
      const res = reservations.find((r) => r.id === selectedResId);
      if (res) {
        const balance = Math.max(0, Number(res.balance || 0));
        setRecordLines((lines) => {
          if (lines.length === 0) return [newPaymentLine({ label: "Payment", amount: balance })];
          return lines.map((line, i) => (i === 0 ? { ...line, amount: balance } : line));
        });
      }
    }
  }, [selectedResId, reservations]);

  const openedFromQuery = useRef(false);
  useEffect(() => {
    if (!reservationQuery || openedFromQuery.current) return;
    openedFromQuery.current = true;
    setSelectedResId(reservationQuery);
    setIsRecordOpen(true);
  }, [reservationQuery]);

  const clearReservationQuery = () => {
    if (!reservationQuery) return;
    const raw = locationSearch.startsWith("?") ? locationSearch.slice(1) : locationSearch;
    const params = new URLSearchParams(raw);
    params.delete("reservation");
    const qs = params.toString();
    setLocation(qs ? `/billing?${qs}` : "/billing");
  };

  // Handle Record Payment Submit
  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResId) {
      toast({
        title: "Validation error",
        description: "Please select a reservation.",
        variant: "destructive",
      });
      return;
    }
    const lines = recordLines
      .map((line) => ({
        label: line.label.trim() || "Payment",
        amount: numberOrZero(line.amount),
      }))
      .filter((line) => line.amount > 0);
    if (lines.length === 0) {
      toast({
        title: "Validation error",
        description: "Add at least one payment item with an amount.",
        variant: "destructive",
      });
      return;
    }

    const total = lines.reduce((sum, line) => sum + line.amount, 0);
    const breakdown = lines
      .map((line) => `${line.label} ₱${line.amount.toFixed(2)}`)
      .join(" · ");
    const note = [breakdown, recordNote.trim()].filter(Boolean).join("\n");

    try {
      await createPaymentMutation.mutateAsync({
        data: {
          reservationId: selectedResId,
          amount: total,
          method: recordMethod,
          referenceNo: recordRefNo,
          note,
          receivedBy: user?.id,
        },
      });

      toast({
        title: "Success",
        description:
          lines.length === 1
            ? "Payment recorded successfully."
            : `Payment of ₱${total.toFixed(2)} recorded (${lines.length} items).`,
      });

      // Reset & Close
      setSelectedResId("");
      setRecordLines([newPaymentLine({ label: "Payment" })]);
      setRecordMethod("cash");
      setRecordRefNo("");
      setRecordNote("");
      setIsRecordOpen(false);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
    } catch (err: any) {
      toast({
        title: "Operation failed",
        description: err.message || "Failed to record payment.",
        variant: "destructive",
      });
    }
  };

  // Handle Edit Payment Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAmount || isNaN(Number(editAmount)) || Number(editAmount) <= 0) {
      toast({
        title: "Validation error",
        description: "Please enter a valid amount.",
        variant: "destructive",
      });
      return;
    }

    try {
      await updatePaymentMutation.mutateAsync({
        id: editPaymentId,
        data: {
          amount: Number(editAmount),
          method: editMethod,
          referenceNo: editRefNo,
          note: editNote,
        },
      });

      toast({
        title: "Success",
        description: "Payment updated successfully.",
      });

      setIsEditOpen(false);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
    } catch (err: any) {
      toast({
        title: "Operation failed",
        description: err.message || "Failed to update payment.",
        variant: "destructive",
      });
    }
  };

  // Handle Delete Payment
  const handleDeletePayment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this payment record? This will update the reservation balance.")) {
      return;
    }

    try {
      await deletePaymentMutation.mutateAsync(id);
      toast({
        title: "Success",
        description: "Payment record deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
    } catch (err: any) {
      toast({
        title: "Operation failed",
        description: err.message || "Failed to delete payment.",
        variant: "destructive",
      });
    }
  };

  // Open Edit Form Dialog
  const triggerEdit = (payment: any) => {
    setEditPaymentId(payment.id);
    setEditAmount(String(payment.amount));
    setEditMethod(payment.paymentMethod || "cash");
    setEditRefNo(payment.referenceNo || "");
    setEditNote(payment.note || "");
    setIsEditOpen(true);
  };

  // Open Receipt Print Dialog
  const triggerViewReceipt = (payment: any) => {
    setActivePayment(payment);
    setIsReceiptOpen(true);
  };

  // HTML print function
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
      } catch (e) {
        console.error(e);
      }
    };

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(cleanup, 1000);
      } catch (e) {
        console.error(e);
        cleanup();
      }
    };

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    } else {
      cleanup();
    }
  };

  const handlePrintReceipt = () => {
    if (!activePayment) return;
    const html = `
      <html>
      <head>
        <style>
          @page { size: auto; margin: 0; }
          body {
            font-family: 'Courier New', Courier, monospace;
            color: #111111;
            margin: 0;
            padding: 24px;
            background: #ffffff;
            font-size: 14px;
            line-height: 1.5;
          }
          .container {
            max-width: 380px;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            margin-bottom: 24px;
            border-bottom: 1px dashed #666;
            padding-bottom: 16px;
          }
          .title {
            font-size: 18px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 4px;
          }
          .subtitle {
            font-size: 12px;
            color: #666;
          }
          .receipt-label {
            font-size: 16px;
            font-weight: bold;
            margin-top: 12px;
            text-transform: uppercase;
          }
          .grid {
            margin-bottom: 20px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6px;
          }
          .label {
            color: #555;
          }
          .value {
            font-weight: bold;
            text-align: right;
          }
          .divider {
            border-top: 1px dashed #666;
            margin: 16px 0;
          }
          .total-row {
            font-size: 18px;
            font-weight: bold;
            border-top: 1px solid #111;
            border-bottom: 1px solid #111;
            padding: 8px 0;
            margin: 12px 0;
          }
          .footer {
            text-align: center;
            font-size: 12px;
            color: #666;
            margin-top: 32px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="title">PalawanSU Hotel</div>
            <div class="subtitle">Puerto Princesa City, Palawan</div>
            <div class="subtitle">Contact: (048) 433-2882</div>
            <div class="receipt-label">Official Receipt</div>
          </div>
          <div class="grid">
            <div class="row">
              <span class="label">Receipt No:</span>
              <span class="value">${activePayment.receiptNumber}</span>
            </div>
            <div class="row">
              <span class="label">Date:</span>
              <span class="value">${new Date(activePayment.createdAt).toLocaleString()}</span>
            </div>
            <div class="divider"></div>
            <div class="row">
              <span class="label">Guest Name:</span>
              <span class="value">${activePayment.guestName}</span>
            </div>
            <div class="row">
              <span class="label">Room Number:</span>
              <span class="value">${activePayment.roomNumber}</span>
            </div>
            <div class="row">
              <span class="label">Payment Method:</span>
              <span class="value" style="text-transform: uppercase;">${activePayment.paymentMethod}</span>
            </div>
            ${activePayment.referenceNo ? `
            <div class="row">
              <span class="label">Ref Number:</span>
              <span class="value">${activePayment.referenceNo}</span>
            </div>
            ` : ''}
            ${activePayment.note ? `
            <div class="row" style="flex-direction: column; align-items: flex-start; margin-top: 8px;">
              <span class="label">Note:</span>
              <span class="value" style="font-weight: normal; font-style: italic; text-align: left;">${activePayment.note}</span>
            </div>
            ` : ''}
            <div class="total-row">
              <div class="row">
                <span>AMOUNT PAID</span>
                <span>₱${Number(activePayment.amount).toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div class="footer">
            Thank you for your payment!<br>
            Have a wonderful stay!
          </div>
        </div>
      </body>
      </html>
    `;
    printHtml(html);
  };

  // Get active reservations that have check-in status or balance > 0
  const activeReservations = useMemo(() => {
    const list = reservations ?? [];
    const active = list.filter(
      (res) => res.status !== "checked_out" && res.status !== "cancelled",
    );
    const extra = reservationQuery ? list.find((r) => r.id === reservationQuery) : undefined;
    if (extra && !active.some((r) => r.id === extra.id)) return [extra, ...active];
    return active;
  }, [reservations, reservationQuery]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
          <p className="text-muted-foreground">Manage payments and receipts.</p>
        </div>
        <Button onClick={() => setIsRecordOpen(true)} type="button">
          <Plus className="w-4 h-4 mr-2" />
          Record Payment
        </Button>
      </div>

      <ScrollableTablePane offsetRem={12} minVh={30}>
        <Table>
          <TableHeader className="sticky top-0 z-[1] bg-card shadow-sm">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Receipt #</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPaymentsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-[100px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[100px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[150px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[50px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[80px]" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-4 w-[80px] ml-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-8 w-[40px] ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : payments?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No payments found.
                </TableCell>
              </TableRow>
            ) : (
              payments?.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{formatPhDateTime(payment.createdAt)}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{payment.receiptNumber}</TableCell>
                  <TableCell className="font-medium">{payment.guestName}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {payment.roomNumber}
                    </Badge>
                  </TableCell>
                  <TableCell className="uppercase text-xs font-semibold">{payment.paymentMethod}</TableCell>
                  <TableCell className="text-right font-medium text-emerald-600">
                    ₱{payment.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 p-0 cursor-pointer">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => triggerViewReceipt(payment)} className="cursor-pointer">
                          <Receipt className="mr-2 h-4 w-4" />
                          View Receipt
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => triggerEdit(payment)} className="cursor-pointer">
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Payment
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeletePayment(payment.id)}
                          className="text-destructive focus:text-destructive cursor-pointer"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Payment
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

      {/* Record Payment Dialog */}
      <Dialog
        open={isRecordOpen}
        onOpenChange={(open) => {
          setIsRecordOpen(open);
          if (!open) {
            clearReservationQuery();
            setRecordLines([newPaymentLine({ label: "Payment" })]);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-md min-w-0 overflow-x-hidden overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRecordSubmit} className="min-w-0 space-y-4">
            <div className="min-w-0 space-y-1">
              <label className="text-sm font-semibold">Select Reservation</label>
              <Select value={selectedResId} onValueChange={setSelectedResId}>
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="Select active booking" />
                </SelectTrigger>
                <SelectContent className="max-h-64 overflow-y-auto">
                  {activeReservations.length === 0 ? (
                    <SelectItem value="none" disabled>No active reservations</SelectItem>
                  ) : (
                    activeReservations
                      .filter((res) => Boolean(res.id?.trim()))
                      .map((res) => (
                      <SelectItem key={res.id} value={res.id} className="max-w-[min(100vw-3rem,28rem)]">
                        <SelectItemText>
                          {res.reservationNumber} · {res.guestName} · Rm {res.roomNumber} · ₱{res.balance.toFixed(2)}
                        </SelectItemText>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-semibold">Payment items</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setRecordLines((lines) => [...lines, newPaymentLine()])}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {recordLines.map((line) => (
                  <div key={line.id} className="flex min-w-0 items-center gap-2">
                    <Input
                      placeholder="Label, e.g. Room, Extra bed"
                      value={line.label}
                      onChange={(e) =>
                        setRecordLines((lines) =>
                          lines.map((item) =>
                            item.id === line.id ? { ...item, label: e.target.value } : item,
                          ),
                        )
                      }
                      className="min-w-0 flex-1"
                    />
                    <NumberInput
                      placeholder="0.00"
                      min={0}
                      step="0.01"
                      value={line.amount}
                      onValueChange={(value) =>
                        setRecordLines((lines) =>
                          lines.map((item) =>
                            item.id === line.id ? { ...item, amount: value } : item,
                          ),
                        )
                      }
                      className="w-[7.25rem] shrink-0"
                    />
                    {recordLines.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        aria-label="Remove payment item"
                        onClick={() =>
                          setRecordLines((lines) => lines.filter((item) => item.id !== line.id))
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="text-right text-sm font-semibold tabular-nums">
                Total ₱
                {recordLines
                  .reduce((sum, line) => sum + numberOrZero(line.amount), 0)
                  .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="min-w-0 space-y-1">
              <label className="text-sm font-semibold">Payment Method</label>
              <Select value={recordMethod} onValueChange={setRecordMethod}>
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="gcash">GCash</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="paymaya">PayMaya</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 space-y-1">
              <label className="text-sm font-semibold">Reference Number (Optional)</label>
              <Input
                placeholder="e.g. GCash Trans ID, Check No."
                value={recordRefNo}
                onChange={(e) => setRecordRefNo(e.target.value)}
              />
            </div>

            <div className="min-w-0 space-y-1">
              <label className="text-sm font-semibold">Note (Optional)</label>
              <Textarea
                placeholder="Add payment notes..."
                rows={2}
                value={recordNote}
                onChange={(e) => setRecordNote(e.target.value)}
              />
            </div>

            <DialogFooter className="min-w-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={createPaymentMutation.isPending}>
                {createPaymentMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Recording...
                  </>
                ) : (
                  "Record Payment"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md min-w-0 overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Edit Payment Record</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="min-w-0 space-y-4">
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-1">
                <label className="text-sm font-semibold">Amount (₱)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
              </div>

              <div className="min-w-0 space-y-1">
                <label className="text-sm font-semibold">Payment Method</label>
                <Select value={editMethod} onValueChange={setEditMethod}>
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="gcash">GCash</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="paymaya">PayMaya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold">Reference Number (Optional)</label>
              <Input
                placeholder="e.g. GCash Trans ID, Check No."
                value={editRefNo}
                onChange={(e) => setEditRefNo(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold">Note (Optional)</label>
              <Textarea
                placeholder="Add payment notes..."
                rows={2}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={updatePaymentMutation.isPending}>
                {updatePaymentMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Receipt Dialog */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="max-w-md bg-stone-50 border-stone-200">
          <DialogHeader>
            <DialogTitle className="text-stone-800">Official Receipt Preview</DialogTitle>
          </DialogHeader>

          {activePayment && (
            <div className="bg-white border border-stone-200 shadow-inner rounded p-6 font-mono text-xs text-stone-900 leading-relaxed max-w-sm mx-auto">
              <div className="text-center mb-4 border-b border-dashed border-stone-300 pb-4">
                <div className="text-sm font-bold uppercase tracking-wider">PalawanSU Hotel</div>
                <div className="text-[10px] text-stone-500">Puerto Princesa City, Palawan</div>
                <div className="text-[10px] text-stone-500">Contact: (048) 433-2882</div>
                <div className="text-xs font-bold uppercase mt-2">Official Receipt</div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-stone-500">Receipt No:</span>
                  <span className="font-bold">{activePayment.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Date:</span>
                  <span>{new Date(activePayment.createdAt).toLocaleString()}</span>
                </div>
                <div className="border-t border-dashed border-stone-300 my-2"></div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Guest Name:</span>
                  <span className="font-bold">{activePayment.guestName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Room Number:</span>
                  <span className="font-bold">{activePayment.roomNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Method:</span>
                  <span className="font-bold uppercase">{activePayment.paymentMethod}</span>
                </div>
                {activePayment.referenceNo && (
                  <div className="flex justify-between">
                    <span className="text-stone-500">Ref Number:</span>
                    <span className="font-bold">{activePayment.referenceNo}</span>
                  </div>
                )}
                {activePayment.note && (
                  <div className="mt-2 text-stone-600 bg-stone-50 p-2 rounded border border-stone-100 italic">
                    <span className="block text-[10px] text-stone-400 not-italic">Note:</span>
                    {activePayment.note}
                  </div>
                )}
                <div className="border-t border-stone-900 border-b py-2 my-2 font-bold text-sm flex justify-between">
                  <span>AMOUNT PAID</span>
                  <span>₱{Number(activePayment.amount).toFixed(2)}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-stone-500 mt-4">
                Thank you for your payment!<br />
                Have a wonderful stay!
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-between gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="border-stone-300 hover:bg-stone-100">Close</Button>
            </DialogClose>
            <Button onClick={handlePrintReceipt} type="button" className="bg-stone-900 hover:bg-stone-800 text-white">
              <Printer className="w-4 h-4 mr-2" />
              Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
