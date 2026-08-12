import { redirect } from "next/navigation";

export default function ReservationsRedirect() {
  redirect("/guests?tab=bookings");
}
