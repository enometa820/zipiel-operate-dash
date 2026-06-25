"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const u = String(formData.get("username") ?? "");
  const p = String(formData.get("password") ?? "");

  if (u === process.env.APP_USER && p === process.env.APP_PASS) {
    const c = await cookies();
    c.set("seeding_auth", process.env.APP_SESSION_SECRET ?? "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
    redirect("/");
  }
  redirect("/login?error=1");
}

export async function logout() {
  const c = await cookies();
  c.delete("seeding_auth");
  redirect("/login");
}
