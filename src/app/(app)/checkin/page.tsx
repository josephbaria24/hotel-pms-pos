import { redirect } from "next/navigation";

export default function CheckinRedirect() {
  redirect("/guests?tab=stays");
}
