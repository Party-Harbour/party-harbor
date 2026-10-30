import { redirect } from "next/navigation";
import { getCurrentHost } from "@/lib/auth";

export default async function Home() {
  const host = await getCurrentHost();
  redirect(host ? "/dashboard" : "/login");
}
