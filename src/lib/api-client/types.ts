/** Domain types matching legacy @workspace/api-client-react UI expectations */

export type User = {
  id: string;
  username: string;
  fullName: string;
  role: "admin" | "staff" | string;
  isActive: boolean;
  password?: string;
  email?: string | null;
  onboardingCompleted?: boolean;
};

export type ClassroomUser = {
  id: string;
  email: string | null;
  fullName: string;
  username: string;
  role: string;
  isActive: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
  roomsCount: number;
  guestsCount: number;
  reservationsCount: number;
  checkinsCount: number;
  paymentsCount: number;
  posOrdersCount: number;
  posPaidCount: number;
};

export type OperationMode = "lab" | "shared";

export type Guest = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  contactNumber: string | null;
  email: string | null;
  address?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  nationality?: string | null;
  notes?: string | null;
  totalStays: number;
};

export type Room = {
  id: string;
  roomNumber: string;
  type: string;
  floor?: string | null;
  capacity: number;
  pricePerNight: number;
  status: string;
  notes?: string | null;
  condition: "clean" | "dirty" | string;
  doNotDisturb: boolean;
  assignedHousekeeperId: string | null;
};

export type RoomOption = {
  id: string;
  value: string;
  disablesRoom?: boolean;
};

export type Housekeeper = {
  id: string;
  name: string;
  phone: string | null;
  status: "active" | "inactive" | string;
};

export type Reservation = {
  id: string;
  reservationNumber: string;
  guestId: string;
  roomId: string;
  guestName: string;
  roomNumber: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  status: string;
  source?: string | null;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  notes: string | null;
  actualCheckInAt?: string | null;
  actualCheckOutAt?: string | null;
};

export type Payment = {
  id: string;
  reservationId: string;
  amount: number;
  paymentMethod: string;
  method?: string;
  referenceNo: string | null;
  note: string | null;
  receivedBy?: string | null;
  createdAt: string;
  receiptNumber: string;
  guestName: string;
  roomNumber: string;
};

export type Settings = {
  id: string;
  hotelName: string;
  address: string;
  contactNumber: string;
  email: string;
  checkInTime: string;
  checkOutTime: string;
  currency: string;
  taxRate: number;
};

export type ActivityItem = {
  id: string;
  type: "check_in" | "check_out" | "payment" | "reservation" | "cancellation" | string;
  guestName?: string;
  user?: string;
  reservationNumber?: string;
  description: string;
  timestamp: string;
};

export type CreateRoomPayload = {
  roomNumber: string;
  type: string;
  capacity: number;
  pricePerNight: number;
  status?: string;
};

export type CreateReservationPayload = {
  roomId: string;
  guestId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  address?: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  totalAmount: number;
  notes?: string | null;
};
