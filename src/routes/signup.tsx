import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Bus, Mail, Lock, UserRound, Loader2, Phone, Truck } from "lucide-react";
import { toast } from "sonner";
import { getSession, signUpUser, type RegistrableRole } from "../lib/auth";

export const Route = createFileRoute("/signup")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;

    const session = getSession();
    if (session) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "Sign Up - PulseRide" },
      { name: "description", content: "Create a PulseRide account." },
    ],
  }),
  component: SignUpPage,
});

function SignUpPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<RegistrableRole>("student");
  const [name, setName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!name || !loginId || !phoneNumber || !password || !confirmPassword) {
      toast.error("Please fill all fields.");
      return;
    }

    if (role === "student" && !loginId.trim().toLowerCase().endsWith("@srmist.edu.in")) {
      toast.error("Student signup requires @srmist.edu.in email.");
      return;
    }

    if (!/^\+?[0-9]{10,15}$/.test(phoneNumber.trim())) {
      toast.error("Enter a valid phone number.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    window.setTimeout(async () => {
      try {
        await signUpUser({
          name,
          loginId,
          phoneNumber,
          role,
          password,
        });

        setLoading(false);
        toast.success("Signup submitted", {
          description: "Account created successfully. Approval will be requested when you login.",
        });
        navigate({ to: "/login" });
      } catch (error) {
        setLoading(false);
        toast.error("Unable to sign up", {
          description:
            error instanceof Error ? error.message : "Please check your details and try again.",
        });
      }
    }, 700);
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-[#04060f] px-4 py-10 text-slate-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.2),transparent_45%),radial-gradient(circle_at_80%_15%,rgba(6,182,212,0.12),transparent_40%),linear-gradient(160deg,#02040b,#050814_35%,#030712_70%,#02050c)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-size-[36px_36px] opacity-20" />

      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full max-w-lg"
      >
        <div className="rounded-3xl border border-slate-700/60 bg-slate-950/85 p-7 shadow-[0_18px_60px_-24px_rgba(15,23,42,0.9)] backdrop-blur-xl sm:p-9">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-cyan-500 shadow-[0_0_30px_rgba(56,189,248,0.35)]">
              <Bus className="h-7 w-7 text-white" strokeWidth={2.5} />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Create account</h1>
            <p className="mt-1 text-sm text-slate-400">Register as student or driver</p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-slate-700 bg-slate-900/60 p-1.5">
            <button
              type="button"
              onClick={() => setRole("student")}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                role === "student" ? "bg-cyan-500/20 text-cyan-200" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              Student Signup
            </button>
            <button
              type="button"
              onClick={() => setRole("driver")}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                role === "driver" ? "bg-cyan-500/20 text-cyan-200" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              Driver Signup
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            <InputRow
              icon={<UserRound className="h-4 w-4" />}
              label="Full name"
              placeholder="Enter your full name"
              value={name}
              onChange={setName}
              type="text"
            />
            <InputRow
              icon={role === "student" ? <Mail className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
              label={role === "student" ? "Student email" : "Driver login ID"}
              placeholder={role === "student" ? "name@srmist.edu.in" : "driver001"}
              value={loginId}
              onChange={setLoginId}
              type={role === "student" ? "email" : "text"}
            />
            <InputRow
              icon={<Phone className="h-4 w-4" />}
              label="Phone number"
              placeholder="e.g. +919876543210"
              value={phoneNumber}
              onChange={setPhoneNumber}
              type="tel"
            />
            <InputRow
              icon={<Lock className="h-4 w-4" />}
              label="Password"
              placeholder="Password"
              value={password}
              onChange={setPassword}
              type="password"
            />
            <InputRow
              icon={<Lock className="h-4 w-4" />}
              label="Confirm password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              type="password"
            />

            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-blue-500 to-cyan-500 px-4 py-3 text-sm font-bold text-white shadow-[0_8px_30px_-12px_rgba(56,189,248,0.9)] transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating account...
                </>
              ) : (
                "Sign up"
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => navigate({ to: "/login" })}
              className="font-semibold text-cyan-300 hover:text-cyan-200 hover:underline"
            >
              Login
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function InputRow({
  icon,
  label,
  placeholder,
  value,
  onChange,
  type,
}: {
  icon: ReactNode;
  label: string;
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
  type: "text" | "email" | "password" | "tel";
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </label>
      <div className="flex items-center gap-2.5 rounded-2xl border border-slate-700 bg-slate-900/85 px-3.5 py-3 transition-all focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-500/15">
        <span className="text-slate-400">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm font-medium text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
