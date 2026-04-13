import type { Metadata } from "next";
import { RegistrationForm } from "./registration-form";

export const metadata: Metadata = {
  title: "Join BWL | Register as a Player",
  description: "Register to play in Baloch Warriors League tournaments.",
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen">
      <section className="border-b border-border/50 bg-card/30">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-12 text-center">
          <h1 className="text-3xl font-black tracking-tight">Join BWL</h1>
          <p className="text-muted-foreground mt-2">
            Register to participate in upcoming tournaments
          </p>
        </div>
      </section>

      <section className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <RegistrationForm />
      </section>
    </div>
  );
}
